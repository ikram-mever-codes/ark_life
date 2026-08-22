// ═══════════════════════════════════════════════════════════════════════
// controllers/chat.controller.ts — GEMINI INTERACTIONS API (MIGRATED)
// ═══════════════════════════════════════════════════════════════════════

import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Avatar from "../models/Avatar";
import Message from "../models/Message";
import User from "../models/User";
import { findTopChunksByKeyword } from "../services/keywordResearchService";
import { GoogleGenAI } from "@google/genai";

// Initialize official GenAI SDK (automatically uses process.env.GEMINI_API_KEY)
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const resolveMasterVideoUrl = (
  storedUrl: string | null | undefined,
): string => {
  if (!storedUrl) return "";
  if (storedUrl.startsWith("http")) return storedUrl;
  return storedUrl;
};

/**
 * Clean the user's message before feeding it to keyword search.
 */
const cleanQueryForSearch = (message: string): string => {
  return message
    .replace(/\S+\.(pdf|docx|txt|md|json|jpg|png|mp3|wav)\b/gi, "")
    .replace(
      /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/gi,
      "",
    )
    .replace(/\b[0-9a-f]{8,}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Build prompt instructions incorporating avatar persona and memory context.
 */
const buildPromptInstructions = (
  avatarName: string,
  avatarDescription: string | undefined,
  memoryContext: string,
  userMessage: string,
  neuralBio?: string,
): string => {
  const persona = [
    `You are ${avatarName}.`,
    avatarDescription ? `Persona: ${avatarDescription}.` : "",
    neuralBio ? `Background & personality: ${neuralBio}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (!memoryContext) {
    return `${persona}\n\nUser Question: ${userMessage}\n\nRespond in 1-2 short sentences, staying in character.`;
  }

  return `${persona}

IMPORTANT: Below is information extracted from documents and memories you already have access to. You have already read and processed this content. Treat it as your own knowledge.

=== YOUR KNOWLEDGE ===
${memoryContext}
=== END OF YOUR KNOWLEDGE ===

Answer the user's question using the information above. Do NOT say you cannot access files, read PDFs, or analyze documents — the relevant content is already extracted for you above. Simply answer from it naturally.

User Question: ${userMessage}

Respond in 1-2 short sentences, staying in character.`;
};

export class ChatController {
  interact = async (req: AuthRequest, res: Response) => {
    const { message, avatarId } = req.body;
    const userId = req.user?._id;

    try {
      const user = await User.findById(userId);
      // if (!user || user.credits <= 0) {
      //   return res
      //     .status(403)
      //     .json({ success: false, message: "Insufficient credits." });
      // }

      const avatar = await Avatar.findOne({ _id: avatarId, userId });
      if (!avatar || !avatar.heroImageUrl || !avatar.voiceId) {
        return res
          .status(404)
          .json({ success: false, message: "Avatar not fully ready." });
      }

      // 1. Save User Message
      await Message.create({ userId, avatarId, role: "user", text: message });

      // 2. Clean query + RAG retrieval
      const cleanedQuery = cleanQueryForSearch(message);
      console.log(`[Chat] Original query: "${message}"`);
      console.log(`[Chat] Cleaned query: "${cleanedQuery}"`);

      const memories = await findTopChunksByKeyword(
        userId.toString(),
        cleanedQuery || message,
        avatarId,
        3,
      );

      console.log(`[Chat] Retrieved ${memories.length} memory chunks:`);
      memories.forEach((m: any, i: number) => {
        const preview = m.text.slice(0, 150).replace(/\n/g, " ");
        console.log(
          `[Chat]    Chunk ${i + 1} (score ${m.score.toFixed(2)}): "${preview}..."`,
        );
      });

      const memoryContext = memories.map((m: any) => m.text).join("\n---\n");

      // 3. Construct input prompt
      const fullInput = buildPromptInstructions(
        avatar.name,
        avatar.description,
        memoryContext,
        message,
        avatar.description,
      );

      // 4. Call Interactions API using gemini-3.6-flash
      const interaction = await ai.interactions.create({
        model: "gemini-3.6-flash",
        input: fullInput,
      });

      const replyText = interaction.output_text || "";

      // 5. Master video & response payload
      const videoUrl = resolveMasterVideoUrl(avatar.masterVideoUrl);

      // 6. Save AI Message & decrement credits
      await Message.create({
        userId,
        avatarId,
        role: "avatar",
        text: replyText,
      });

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $inc: { credits: -1 } },
        { new: true },
      );

      return res.status(200).json({
        success: true,
        data: {
          reply: replyText,
          videoUrl: videoUrl,
          voiceId: avatar.voiceId,
          remainingCredits: updatedUser?.credits || 0,
        },
      });
    } catch (err: any) {
      console.error("Critical Chat Error:", err);
      const errStatus = typeof err.status === "number" ? err.status : 500;
      return res.status(errStatus).json({
        success: false,
        message: "Neural link timeout. Switch to text-only mode.",
      });
    }
  };

  getHistory = async (req: AuthRequest, res: Response) => {
    const { avatarId } = req.params;
    const history = await Message.find({ userId: req.user?._id, avatarId })
      .sort({ createdAt: 1 })
      .limit(50);
    return res.status(200).json({ success: true, data: history });
  };
}

export default new ChatController();
