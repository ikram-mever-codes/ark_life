// services/textExtractionService.ts – extract raw text from PDF, DOCX, TXT, MD, JSON
import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";

// 1. FAILSAFE IMPORT: Using 'any' to bypass the TS(2349) "not callable" error
import * as _pdf from "pdf-parse";
const pdf = _pdf as any;

// 2. DOMMatrix Polyfill: Necessary to prevent ReferenceError in Node environment
if (typeof (global as any).DOMMatrix === "undefined") {
  (global as any).DOMMatrix = class DOMMatrix {
    constructor(arg: any) {
      return arg;
    }
  };
}

const TEXT_EXTENSIONS = new Set(["txt", "md", "json", "pdf", "docx"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav"]);

export type ExtractResult =
  | { text: string; ok: true }
  | { text?: string; ok: false; error: string };

export async function extractTextFromFile(
  filePath: string,
  fileType: string,
): Promise<ExtractResult> {
  const ext = (fileType || path.extname(filePath).slice(1)).toLowerCase();

  if (!TEXT_EXTENSIONS.has(ext) && !AUDIO_EXTENSIONS.has(ext)) {
    return { ok: false, error: `Unsupported type for text extraction: ${ext}` };
  }

  if (AUDIO_EXTENSIONS.has(ext)) {
    return {
      ok: false,
      error:
        "Audio (mp3/wav) must be transcribed with Whisper first. Not implemented in this MVP.",
    };
  }

  try {
    const buffer = await fs.readFile(filePath);

    if (ext === "pdf") {
      try {
        // 3. LOGIC CHECK: Handles both CommonJS and ESM module exports
        const pdfData = await (pdf.default ? pdf.default(buffer) : pdf(buffer));
        return { ok: true, text: (pdfData?.text || "").trim() };
      } catch (pdfErr: any) {
        return { ok: false, error: `PDF Parse error: ${pdfErr.message}` };
      }
    }

    if (ext === "docx") {
      const result = await mammoth.extractRawText({ buffer });
      return { ok: true, text: (result?.value || "").trim() };
    }

    if (ext === "txt" || ext === "md") {
      const text = buffer.toString("utf-8");
      return { ok: true, text: text.trim() };
    }

    if (ext === "json") {
      const text = buffer.toString("utf-8");
      const parsed = JSON.parse(text);
      const stringified =
        typeof parsed === "string" ? parsed : JSON.stringify(parsed);
      return { ok: true, text: stringified.trim() };
    }

    return { ok: false, error: `Unhandled type: ${ext}` };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to extract text" };
  }
}

/** Split text into chunks (e.g. for embedding). Simple sentence/paragraph boundary split. */
export function chunkText(
  text: string,
  maxChunkSize = 1000,
  overlap = 100,
): string[] {
  if (!text || text.length <= maxChunkSize) return text ? [text] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + maxChunkSize, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastBreak = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf(" "),
      );
      if (lastBreak > maxChunkSize / 2) end = start + lastBreak + 1;
    }
    chunks.push(text.slice(start, end).trim());
    start = end - overlap;
    if (start >= text.length) break;
  }
  return chunks.filter((c) => c.length > 0);
}
