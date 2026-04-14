import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Avatar from "../models/Avatar";
import Message from "../models/Message";
import User from "../models/User";
import { findTopChunks } from "../services/embeddingService";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export class ChatController {
  /**
   * GET /api/v1/chat/history/:avatarId
   */
  getHistory = async (req: AuthRequest, res: Response) => {
    const { avatarId } = req.params;
    const userId = req.user?._id;

    try {
      const history = await Message.find({ userId, avatarId })
        .sort({ createdAt: 1 })
        .limit(50);

      return res.status(200).json({
        success: true,
        data: history,
      });
    } catch (err) {
      console.error("History Sync Error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve neural logs.",
      });
    }
  };

  /**
   * POST /api/v1/chat/interact
   * Implements Credit Guard and Atomic Deduction
   */
  interact = async (req: AuthRequest, res: Response) => {
    const { message, avatarId } = req.body;
    const userId = req.user?._id;

    try {
      // 1. Fetch User and verify credits
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      // 2. CREDIT GUARD: Block interaction if credits are zero
      if (user.credits <= 0) {
        return res.status(403).json({
          success: false,
          message: "Insufficient credits. Please upgrade your neural protocol.",
          isLocked: true,
        });
      }

      // 3. Fetch Identity Node
      const avatar = await Avatar.findOne({ _id: avatarId, userId });
      if (!avatar) {
        return res
          .status(404)
          .json({ success: false, message: "Identity not found." });
      }

      // 4. Save User Message
      await Message.create({
        userId,
        avatarId,
        role: "user",
        text: message,
      });

      // 5. RAG: Memory Retrieval
      const memories = await findTopChunks(
        userId.toString(),
        message,
        avatarId,
        3,
      );
      const memoryContext = memories.map((m: any) => m.text).join("\n---\n");

      // 6. Contextual History
      const recentChats = await Message.find({ userId, avatarId })
        .sort({ createdAt: -1 })
        .skip(1)
        .limit(5)
        .lean();

      const historySummary = recentChats
        .reverse()
        .map((m) => `${m.role === "user" ? "User" : avatar.name}: ${m.text}`)
        .join("\n");

      const systemPrompt = `
        You are ${avatar.name}. 
        Persona: ${avatar.description || "Helpful and authentic Digital Twin."}
        
        USE THESE MEMORIES TO INFORM YOUR KNOWLEDGE:
        ${memoryContext}

        RECENT CONVERSATION HISTORY:
        ${historySummary}
        
        GUIDELINES:
        - Respond as the persona.
        - Be concise but conversational.
      `;

      // 7. OpenAI Completion
      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 300,
        temperature: 0.7,
      });

      const replyText = completion.choices[0].message.content || "";

      // 8. Save AI Response
      await Message.create({
        userId,
        avatarId,
        role: "avatar",
        text: replyText,
      });

      // 9. ATOMIC CREDIT DEDUCTION
      // Decrement credits by 1 per message exchange
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { credits: -1 } },
        { new: true },
      );

      return res.status(200).json({
        success: true,
        data: {
          reply: replyText,
          voiceId: avatar.voiceId,
          name: avatar.name,
          remainingCredits: updatedUser?.credits || 0,
        },
      });
    } catch (err: any) {
      console.error("Neural Sync Error:", err);
      return res.status(500).json({
        success: false,
        message: "Neural link disrupted. Protocol terminated.",
      });
    }
  };
}

export default new ChatController();
