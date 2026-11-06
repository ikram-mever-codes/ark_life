// ═══════════════════════════════════════════════════════════════════════
// controllers/chat.controller.ts — ArkLife AI (Milestone 3 upgrade)
// ═══════════════════════════════════════════════════════════════════════
//
// What changed vs. Milestone 2 (see docs/AI_ARCHITECTURE.md):
//   1. Real system instruction: ArkLife health & well-being mentor, with the
//      avatar persona layered on top, safety rules and source labelling.
//   2. Conversation memory: the last N messages are sent as chat turns.
//   3. Document grounding: when the user's documents fit in the context
//      budget the FULL text of every document is provided (so questions like
//      "compare my last three blood tests" work); otherwise the most relevant
//      chunks are retrieved by keyword search. A catalogue of all documents
//      is always included so the AI knows what exists and what does not.
//   4. No more "1-2 sentences" limit; answers are concise but complete.
//   5. Sources used are returned to the UI.

import { Response } from "express";
import mongoose from "mongoose";
import { GoogleGenAI } from "@google/genai";
import { AuthRequest } from "../middleware/auth";
import Avatar from "../models/Avatar";
import Message from "../models/Message";
import User from "../models/User";
import MemoryVault from "../models/MemoryVault";
import MemoryChunk from "../models/MemoryChunk";
import { findTopChunksByKeyword } from "../services/keywordResearchService";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";
const HISTORY_MESSAGES = Number(process.env.CHAT_HISTORY_MESSAGES) || 16;
/** If all of the user's document text fits in this many characters, send it all. */
const FULL_CONTEXT_CHAR_LIMIT =
  Number(process.env.CHAT_FULL_CONTEXT_CHARS) || 120_000;
const TOP_K_CHUNKS = 10;

let ai: GoogleGenAI | null = null;
const getAi = () => {
  if (!ai) ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return ai;
};

const resolveMasterVideoUrl = (storedUrl: string | null | undefined): string =>
  storedUrl || "";

/** Clean the user's message before feeding it to keyword search. */
const cleanQueryForSearch = (message: string): string =>
  message
    .replace(/\S+\.(pdf|docx|txt|md|json|jpg|png|mp3|wav)\b/gi, "")
    .replace(
      /\b[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}\b/gi,
      "",
    )
    .replace(/\b[0-9a-f]{8,}\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

const fmtDate = (d?: Date | string | null) =>
  d ? new Date(d).toISOString().slice(0, 10) : "unknown date";

type DocMeta = {
  id: string;
  name: string;
  category: string;
  source: string;
  uploaded: Date;
};

function buildSystemInstruction(opts: {
  avatarName: string;
  persona?: string;
  userFirstName?: string;
  neuralBio?: string;
}): string {
  return `You are ${opts.avatarName}, the personal AI companion inside ArkLife, a platform for health, longevity and personal memory.

ROLE
- You are a knowledgeable, warm and practical well-being mentor: general health, nutrition, supplements, sleep, exercise, stress and lifestyle.
- You also help the user understand their own clinical documents (blood tests, lab and specialist reports) that they uploaded to ArkLife.
- You can talk about any everyday topic like a capable general-purpose assistant. Use your general knowledge freely.
${opts.persona ? `\nPERSONA (adopt this style and character)\n${opts.persona}\n` : ""}${opts.userFirstName ? `\nThe user's first name is ${opts.userFirstName}.` : ""}${opts.neuralBio ? `\nBACKGROUND THE USER SHARED ABOUT THEMSELVES\n${opts.neuralBio}\n` : ""}
LANGUAGE
- Always reply in the language the user writes in (usually Italian).

USING THE USER'S DOCUMENTS
- The "USER DOCUMENTS" section (when present) contains text extracted from the user's own files. It is the ONLY source for facts about the user's documents.
- When you state something taken from the documents, name the document (and its date if known), e.g. "Nelle analisi del sangue del 12/03/2026 …". Quote values exactly with their units and reference ranges.
- Clearly separate the two kinds of information:
  • facts from the user's documents → introduce them with "📄 Dai tuoi documenti:" (or "📄 From your documents:" in English);
  • general medical/scientific knowledge → introduce it with "💡 Conoscenza generale:" (or "💡 General knowledge:").
- NEVER invent values, dates, diagnoses or documents. If the requested information is not in the provided documents, say so plainly (e.g. "Non trovo questo dato nei documenti caricati") and, if useful, list which documents you do have.
- When comparing several reports, use a short table or list showing each value per date and point out the largest changes and any value outside its reference range.
- Some text may come from OCR of scanned documents and may contain recognition errors; if a value looks implausible, say it should be double-checked on the original.

SAFETY
- You are not a doctor and do not replace one. Do not give diagnoses or prescribe medication or dosages. For anything abnormal, worrying or urgent, recommend discussing it with a doctor; for emergencies, tell the user to call 112.
- Supplement advice must be general, mention possible interactions, and suggest checking with a healthcare professional.

STYLE
- Be natural and conversational. Typical answers are 2–6 sentences; give longer, structured answers only for analyses, comparisons or when the user asks for detail.
- Your replies may be read aloud by a voice, so avoid very long lists unless needed.
- Keep track of the conversation: refer back to what was said earlier when relevant.`;
}

/**
 * Build the document context for this question.
 * Returns the text block to send and the list of documents used.
 */
async function buildDocumentContext(
  userId: mongoose.Types.ObjectId,
  avatarId: string,
  query: string,
): Promise<{ context: string; sources: DocMeta[]; mode: string }> {
  const vault = await MemoryVault.findOne({ userId }, { files: 1 }).lean();
  const files = ((vault?.files as any[]) || []).filter(
    (f) =>
      (f.status === "indexed" || (!f.status && f.isIndexed)) &&
      (!f.avatarId || String(f.avatarId) === String(avatarId)),
  );
  if (files.length === 0) return { context: "", sources: [], mode: "none" };

  const meta = new Map<string, DocMeta>(
    files.map((f) => [
      String(f._id),
      {
        id: String(f._id),
        name: f.fileName,
        category: f.category || "personal",
        source: f.source || "upload",
        uploaded: f.uploadDate,
      },
    ]),
  );

  const catalog = [...meta.values()]
    .sort((a, b) => +new Date(b.uploaded) - +new Date(a.uploaded))
    .map(
      (d) =>
        `- ${d.name} (${d.category === "clinical" ? "clinical document" : "personal memory"}, uploaded ${fmtDate(d.uploaded)}${d.source === "fse" ? ", imported from Fascicolo Sanitario" : ""})`,
    )
    .join("\n");

  const chunks = await MemoryChunk.find(
    { userId, source: "file", fileId: { $in: [...meta.keys()].map((id) => new mongoose.Types.ObjectId(id)) } },
    { text: 1, fileId: 1, chunkIndex: 1 },
  )
    .sort({ fileId: 1, chunkIndex: 1, _id: 1 })
    .lean();

  const totalChars = chunks.reduce((n, c: any) => n + c.text.length, 0);

  // ── Mode A: everything fits → send full documents (best accuracy) ──
  if (totalChars <= FULL_CONTEXT_CHAR_LIMIT) {
    const byFile = new Map<string, string[]>();
    for (const c of chunks as any[]) {
      const id = String(c.fileId);
      if (!byFile.has(id)) byFile.set(id, []);
      byFile.get(id)!.push(c.text);
    }
    const docs = [...byFile.entries()]
      .map(([id, parts]) => ({ m: meta.get(id)!, text: parts.join("\n") }))
      .filter((d) => d.m)
      .sort((a, b) => +new Date(b.m.uploaded) - +new Date(a.m.uploaded));

    const body = docs
      .map(
        (d) =>
          `### DOCUMENT: ${d.m.name} — uploaded ${fmtDate(d.m.uploaded)} (${d.m.category})\n${d.text}`,
      )
      .join("\n\n");

    return {
      context: `DOCUMENT CATALOGUE (all documents the user has uploaded):\n${catalog}\n\n${body}`,
      sources: docs.map((d) => d.m),
      mode: "full",
    };
  }

  // ── Mode B: too much text → keyword retrieval of the best chunks ──
  const top = await findTopChunksByKeyword(
    String(userId),
    query,
    avatarId,
    TOP_K_CHUNKS,
  );
  const fileTop = top.filter((c) => c.fileId && meta.has(c.fileId));
  const body = fileTop
    .map((c) => {
      const m = meta.get(c.fileId!)!;
      return `### EXCERPT from "${m.name}" (uploaded ${fmtDate(m.uploaded)})\n${c.text}`;
    })
    .join("\n\n");

  const used = new Map<string, DocMeta>();
  fileTop.forEach((c) => used.set(c.fileId!, meta.get(c.fileId!)!));

  return {
    context:
      `DOCUMENT CATALOGUE (all documents the user has uploaded):\n${catalog}\n\n` +
      (body
        ? `RELEVANT EXCERPTS (only part of the documents is shown):\n${body}`
        : "No excerpt matched this question. If the user asks about document content, say you could not find it and suggest naming the document or value."),
    sources: [...used.values()],
    mode: "excerpts",
  };
}

export class ChatController {
  interact = async (req: AuthRequest, res: Response) => {
    const { message, avatarId } = req.body;
    const userId = req.user?._id as mongoose.Types.ObjectId;

    if (!message || typeof message !== "string" || !message.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Message is required." });
    }
    if (message.length > 8000) {
      return res
        .status(400)
        .json({ success: false, message: "Message is too long." });
    }

    try {
      const [user, avatar] = await Promise.all([
        User.findById(userId),
        Avatar.findOne({ _id: avatarId, userId }),
      ]);
      if (!avatar || !avatar.heroImageUrl || !avatar.voiceId) {
        return res
          .status(404)
          .json({ success: false, message: "Avatar not fully ready." });
      }

      // 1. Conversation history (before saving the new message)
      const history = await Message.find({ userId, avatarId })
        .sort({ createdAt: -1 })
        .limit(HISTORY_MESSAGES)
        .lean();
      history.reverse();

      await Message.create({ userId, avatarId, role: "user", text: message });

      // 2. Document context
      const vault = await MemoryVault.findOne(
        { userId },
        { neuralBio: 1 },
      ).lean();
      const { context, sources, mode } = await buildDocumentContext(
        userId,
        String(avatarId),
        cleanQueryForSearch(message) || message,
      );
      console.log(
        `[Chat] model=${MODEL} history=${history.length} docMode=${mode} sources=${sources.length}`,
      );

      // 3. Build turns: history + current message (with document context)
      const contents: Array<{ role: "user" | "model"; parts: { text: string }[] }> =
        [];
      for (const m of history as any[]) {
        const role = m.role === "user" ? "user" : "model";
        const last = contents[contents.length - 1];
        // Gemini expects alternating roles; merge consecutive same-role turns.
        if (last && last.role === role) last.parts[0].text += `\n${m.text}`;
        else contents.push({ role, parts: [{ text: String(m.text || "") }] });
      }
      if (contents.length && contents[0].role === "model") contents.shift();

      const currentTurn = context
        ? `USER DOCUMENTS (extracted text — the only source for facts about the user's documents)\n<<<\n${context}\n>>>\n\nUSER MESSAGE:\n${message}`
        : `(The user has no processed documents yet.)\n\nUSER MESSAGE:\n${message}`;

      const last = contents[contents.length - 1];
      if (last && last.role === "user") last.parts[0].text += `\n\n${currentTurn}`;
      else contents.push({ role: "user", parts: [{ text: currentTurn }] });

      // 4. Call Gemini
      const response = await getAi().models.generateContent({
        model: MODEL,
        contents,
        config: {
          systemInstruction: buildSystemInstruction({
            avatarName: avatar.name,
            persona: avatar.description,
            userFirstName: user?.firstName,
            neuralBio: vault?.neuralBio,
          }),
          temperature: 0.5,
          // No maxOutputTokens: Gemini 3 "thinking" tokens count against it
          // and a low cap truncates answers mid-sentence.
        },
      });
      const finish = response.candidates?.[0]?.finishReason;
      if (finish && finish !== "STOP") {
        console.warn(`[Chat] Gemini finishReason=${finish}`);
      }

      const replyText =
        (response.text || "").trim() ||
        "Mi dispiace, non sono riuscito a generare una risposta. Puoi riformulare la domanda?";

      // 5. Save reply & decrement credits (never below zero)
      await Message.create({ userId, avatarId, role: "avatar", text: replyText });
      await User.updateOne(
        { _id: userId, credits: { $gt: 0 } },
        { $inc: { credits: -1 } },
      );
      const updatedUser = await User.findById(userId, { credits: 1 }).lean();

      return res.status(200).json({
        success: true,
        data: {
          reply: replyText,
          videoUrl: resolveMasterVideoUrl(avatar.masterVideoUrl),
          voiceId: avatar.voiceId,
          remainingCredits: updatedUser?.credits || 0,
          sources: sources.map((s) => ({
            fileId: s.id,
            fileName: s.name,
            category: s.category,
          })),
        },
      });
    } catch (err: any) {
      console.error("Critical Chat Error:", err?.message || err);
      const status = typeof err?.status === "number" ? err.status : 500;
      return res.status(status >= 400 && status < 600 ? status : 500).json({
        success: false,
        message:
          status === 429
            ? "The AI service is busy (rate limit). Please try again in a moment."
            : "The AI service is temporarily unavailable. Please try again.",
      });
    }
  };

  getHistory = async (req: AuthRequest, res: Response) => {
    const { avatarId } = req.params;
    const history = await Message.find({ userId: req.user?._id, avatarId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    history.reverse();
    return res.status(200).json({ success: true, data: history });
  };
}

export default new ChatController();
