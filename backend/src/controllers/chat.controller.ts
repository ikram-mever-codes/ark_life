// ═══════════════════════════════════════════════════════════════════════
// controllers/chat.controller.ts — IMPROVED PROMPT + QUERY CLEANING
// ═══════════════════════════════════════════════════════════════════════
// Changes:
//   1. System prompt now EXPLICITLY instructs GPT to answer from the
//      context instead of refusing with "I can't access files"
//   2. Query is cleaned before search — filenames/UUIDs stripped so
//      they don't poison keyword matching
//   3. Debug log shows the actual chunk text being used, so we can
//      see if chunks are garbage or gold

import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import Avatar from "../models/Avatar";
import Message from "../models/Message";
import User from "../models/User";
import { findTopChunksByKeyword } from "../services/keywordResearchService";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const resolveMasterVideoUrl = (
  storedUrl: string | null | undefined,
): string => {
  if (!storedUrl) return "";
  if (storedUrl.startsWith("http")) return storedUrl;
  return storedUrl;
};

/**
 * Clean the user's message before feeding it to keyword search.
 * Strips filenames, UUIDs, and other non-semantic tokens that would
 * otherwise poison the keyword matching.
 */
const cleanQueryForSearch = (message: string): string => {
  return (
    message
      // Remove filenames like "something.pdf", "file.docx"
      .replace(/\S+\.(pdf|docx|txt|md|json|jpg|png|mp3|wav)\b/gi, "")
      // Remove UUIDs like "1ed62f76-e85d-4eca-a0b8-8503776d71d0"
      .replace(
        /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/gi,
        "",
      )
      // Remove long hex strings (≥8 chars all hex)
      .replace(/\b[0-9a-f]{8,}\b/gi, "")
      // Collapse multiple spaces
      .replace(/\s+/g, " ")
      .trim()
  );
};

/**
 * Build a strong system prompt that ORDERS GPT to answer from context,
 * rather than suggesting it might be useful. Critical for getting GPT
 * past its "I can't access files" reflex.
 */
const buildSystemPrompt = (
  avatarName: string,
  avatarDescription: string | undefined,
  memoryContext: string,
): string => {
  const persona = avatarDescription
    ? `You are ${avatarName}. Persona: ${avatarDescription}.`
    : `You are ${avatarName}.`;

  if (!memoryContext) {
    return `${persona}\n\nRespond in 1-2 short sentences, staying in character.`;
  }

  // When we HAVE context, we must be assertive with GPT — without this,
  // it defaults to "I can't read files" when a filename appears in the query.
  return `${persona}

IMPORTANT: Below is information extracted from documents and memories you already have access to. You have already read and processed this content. Treat it as your own knowledge.

=== YOUR KNOWLEDGE ===
${memoryContext}
=== END OF YOUR KNOWLEDGE ===

Answer the user's question using the information above. Do NOT say you cannot access files, read PDFs, or analyze documents — the relevant content is already extracted for you above. Simply answer from it naturally.

Respond in 1-2 short sentences, staying in character.`;
};

export class ChatController {
  interact = async (req: AuthRequest, res: Response) => {
    const { message, avatarId } = req.body;
    const userId = req.user?._id;

    try {
      const user = await User.findById(userId);
      if (!user || user.credits <= 0) {
        return res
          .status(403)
          .json({ success: false, message: "Insufficient credits." });
      }

      const avatar = await Avatar.findOne({ _id: avatarId, userId });
      if (!avatar || !avatar.heroImageUrl || !avatar.voiceId) {
        return res
          .status(404)
          .json({ success: false, message: "Avatar not fully ready." });
      }

      // 1. Save User Message
      await Message.create({ userId, avatarId, role: "user", text: message });

      // 2. Clean query + keyword-based RAG retrieval
      const cleanedQuery = cleanQueryForSearch(message);
      console.log(`[Chat] Original query: "${message}"`);
      console.log(`[Chat] Cleaned query: "${cleanedQuery}"`);

      const memories = await findTopChunksByKeyword(
        userId.toString(),
        cleanedQuery || message, // fall back to original if cleaning left nothing
        avatarId,
        3,
      );

      // Show the actual chunk text being sent to GPT — critical for
      // debugging why RAG answers are bad
      console.log(`[Chat] Retrieved ${memories.length} memory chunks:`);
      memories.forEach((m: any, i: number) => {
        const preview = m.text.slice(0, 150).replace(/\n/g, " ");
        console.log(
          `[Chat]   Chunk ${i + 1} (score ${m.score.toFixed(2)}): "${preview}..."`,
        );
      });

      const memoryContext = memories.map((m: any) => m.text).join("\n---\n");

      // 3. Build strong system prompt + call GPT-4
      const systemPrompt = buildSystemPrompt(
        avatar.name,
        avatar.description,
        memoryContext,
      );

      const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 150, // slight bump so GPT has room to answer RAG questions
      });

      const replyText = completion.choices[0].message.content || "";

      // 4. Master video (no D-ID)
      const videoUrl = resolveMasterVideoUrl(avatar.masterVideoUrl);

      // 5. Save AI Message & decrement credits
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
      console.error("Critical Chat Error:", err.message);
      const errStatus =
        typeof err.response?.status === "number" ? err.response.status : 500;
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
