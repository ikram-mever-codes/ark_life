// ═══════════════════════════════════════════════════════════════════════
// services/textExtractionService.ts — FINAL v3 (pdfjs-dist v4 worker fix)
// ═══════════════════════════════════════════════════════════════════════
//
// Changes from previous version:
//   - REMOVED: pdfjs.GlobalWorkerOptions.workerSrc = false
//     (v4 rejects this — "Invalid workerSrc type")
//   - ADDED: useWorkerFetch: false + disableWorker: true in getDocument
//     options — the v4-compatible way to run in main thread

import fs from "node:fs/promises";
import path from "node:path";
import mammoth from "mammoth";

const TEXT_EXTENSIONS = new Set(["txt", "md", "json", "pdf", "docx"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav"]);
const MAX_EXTRACTED_TEXT_BYTES = 500 * 1024;

export type ExtractResult =
  | { text: string; ok: true }
  | { text?: string; ok: false; error: string };

let pdfjsPromise: Promise<any> | null = null;

/**
 * Load pdfjs-dist via real dynamic import (escaping TS CJS→require transpile).
 */
function loadPdfjs(): Promise<any> {
  if (!pdfjsPromise) {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const dynamicImport = new Function("m", "return import(m)");
    pdfjsPromise = (async () => {
      const candidates = [
        "pdfjs-dist/legacy/build/pdf.mjs",
        "pdfjs-dist/build/pdf.mjs",
        "pdfjs-dist",
      ];
      let lastErr: any = null;
      for (const mod of candidates) {
        try {
          return await dynamicImport(mod);
        } catch (e) {
          lastErr = e;
        }
      }
      throw new Error(
        `Could not import pdfjs-dist. Tried: ${candidates.join(", ")}. Last: ${lastErr?.message}`,
      );
    })();
  }
  return pdfjsPromise;
}

/**
 * Extract text from a PDF using pdfjs-dist page-by-page.
 *
 * pdfjs-dist v4 worker behavior:
 *   - We DON'T touch GlobalWorkerOptions (it rejects null/false values)
 *   - We pass disableWorker + useWorkerFetch in the getDocument options
 *     which is the v4-compatible way to run single-threaded
 */
async function extractPdfText(filePath: string): Promise<ExtractResult> {
  const pdfjs = await loadPdfjs();

  const buffer = await fs.readFile(filePath);
  const data = new Uint8Array(buffer);

  const loadingTask = pdfjs.getDocument({
    data,
    // v4-compatible way to skip the worker
    disableWorker: true,
    useWorkerFetch: false,
    // Memory-conservative flags
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
    disableAutoFetch: true,
    disableRange: true,
    // Silence pdfjs verbose logging
    verbosity: 0,
  });

  const doc = await loadingTask.promise;
  const numPages = doc.numPages;
  let assembledText = "";

  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (assembledText.length > MAX_EXTRACTED_TEXT_BYTES) {
        console.warn(
          `[PDF] Text exceeds ${MAX_EXTRACTED_TEXT_BYTES} bytes at page ${pageNum}, stopping`,
        );
        break;
      }

      const page = await doc.getPage(pageNum);
      try {
        const content = await page.getTextContent({
          includeMarkedContent: false,
        });

        const pageText = (content.items || [])
          .map((it: any) => ("str" in it ? it.str : ""))
          .join(" ");

        assembledText += pageText + "\n\n";
      } finally {
        try {
          page.cleanup();
        } catch {}
      }
    }

    return { ok: true, text: assembledText.trim() };
  } finally {
    try {
      await doc.destroy();
    } catch {}
    try {
      await loadingTask.destroy();
    } catch {}
  }
}

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
    if (ext === "pdf") {
      return await extractPdfText(filePath);
    }

    const buffer = await fs.readFile(filePath);

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

/**
 * Split text into chunks with infinite-loop guard.
 */
export function chunkText(
  text: string,
  maxChunkSize = 1000,
  overlap = 100,
): string[] {
  if (!text || text.length <= maxChunkSize) return text ? [text] : [];

  if (overlap >= maxChunkSize) {
    overlap = Math.floor(maxChunkSize / 4);
  }

  const chunks: string[] = [];
  let start = 0;
  let safetyCounter = 0;
  const maxIterations = Math.ceil(text.length / (maxChunkSize - overlap)) + 10;

  while (start < text.length) {
    if (++safetyCounter > maxIterations) {
      console.error("[chunkText] Safety break — infinite loop averted");
      break;
    }

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

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);

    const nextStart = end - overlap;
    if (nextStart <= start) {
      start = end;
    } else {
      start = nextStart;
    }

    if (start >= text.length) break;
  }

  return chunks;
}
