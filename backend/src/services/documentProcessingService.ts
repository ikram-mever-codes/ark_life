// ═══════════════════════════════════════════════════════════════════════
// services/documentProcessingService.ts — Document pipeline (Milestone 3)
// ═══════════════════════════════════════════════════════════════════════
//
//   Upload → Processing → (OCR Processing if needed) → Indexed | Failed
//
//   PDF  → text extraction (pdfjs) → if no usable text → OCR (tesseract)
//   JPG/PNG → OCR (tesseract)
//   DOCX/TXT/MD/JSON → text extraction
//   → chunking → stored in MongoDB (MemoryChunk) → available to the AI
//
// Guarantees required by the M3 spec:
//   - Processing runs in the background; the upload request returns at once.
//   - Every document ends in "indexed" or "failed" (hard timeout per document).
//   - Failures store a readable error and can be retried (POST /files/:id/retry).
//   - Documents interrupted by a server restart are re-queued at boot.
//   - One document is processed at a time to keep server memory stable.

import fs from "node:fs";
import mongoose from "mongoose";
import MemoryVault, { DocumentStatus } from "../models/MemoryVault";
import MemoryChunk from "../models/MemoryChunk";
import { extractTextFromFile, chunkText } from "./textExtractionService";
import { hasUsableText, ocrImageFile, ocrPdf } from "./ocrService";
import { storeChunksAsText } from "./memoryVaultService";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
const DOCUMENT_TIMEOUT_MS =
  Number(process.env.DOCUMENT_TIMEOUT_MS) || 10 * 60_000; // 10 min (OCR is slow)
const IMAGE_TYPES = new Set(["jpg", "jpeg", "png"]);
const AUDIO_TYPES = new Set(["mp3", "wav", "audio"]);

type Job = { vaultId: string; fileId: string };

const queue: Job[] = [];
const queued = new Set<string>();
let running = false;

const key = (j: Job) => `${j.vaultId}:${j.fileId}`;

async function setFileFields(
  vaultId: string,
  fileId: string,
  fields: Record<string, unknown>,
) {
  const $set: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) $set[`files.$.${k}`] = v;
  await MemoryVault.updateOne({ _id: vaultId, "files._id": fileId }, { $set });
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    p.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () =>
          reject(
            new Error(
              `Processing took longer than ${Math.round(ms / 60000)} minutes and was stopped. Please retry.`,
            ),
          ),
        ms,
      );
    }),
  ]);
}

/** Add a document to the processing queue (no-op if already queued). */
export function enqueueDocument(vaultId: string, fileId: string): void {
  const job = { vaultId: String(vaultId), fileId: String(fileId) };
  if (queued.has(key(job))) return;
  queued.add(key(job));
  queue.push(job);
  void drain();
}

async function drain() {
  if (running) return;
  running = true;
  try {
    while (queue.length) {
      const job = queue.shift()!;
      try {
        await processDocument(job.vaultId, job.fileId);
      } catch (e: any) {
        console.error(`[Documents] Unexpected pipeline error:`, e);
      } finally {
        queued.delete(key(job));
      }
    }
  } finally {
    running = false;
  }
}

async function extractWithOcrFallback(
  vaultId: string,
  fileId: string,
  filePath: string,
  fileType: string,
): Promise<{ text: string; pageCount?: number; ocrUsed: boolean }> {
  if (AUDIO_TYPES.has(fileType)) {
    throw new Error(
      "Audio files are stored but not transcribed in this version.",
    );
  }

  if (IMAGE_TYPES.has(fileType)) {
    await setFileFields(vaultId, fileId, { status: "ocr_processing" });
    const r = await ocrImageFile(filePath);
    return { text: r.text, pageCount: 1, ocrUsed: true };
  }

  const extracted = await extractTextFromFile(filePath, fileType);

  if (fileType !== "pdf") {
    if (!extracted.ok) throw new Error(extracted.error);
    return { text: extracted.text, ocrUsed: false };
  }

  // PDF: use the embedded text if it is meaningful, otherwise OCR.
  if (
    extracted.ok &&
    hasUsableText(extracted.text, extracted.pageCount ?? 1)
  ) {
    return {
      text: extracted.text,
      pageCount: extracted.pageCount,
      ocrUsed: false,
    };
  }

  console.log(
    `[Documents] ${fileId}: no usable embedded text → running OCR` +
      (extracted.ok ? "" : ` (extract error: ${extracted.error})`),
  );
  await setFileFields(vaultId, fileId, { status: "ocr_processing" });
  let ocr: Awaited<ReturnType<typeof ocrPdf>>;
  try {
    ocr = await ocrPdf(filePath);
  } catch (e: any) {
    const msg = String(e?.message || "");
    // Keep "OCR not installed" visible to the admin; otherwise a friendly message.
    if (msg.includes("not installed")) throw e;
    console.error(`[Documents] ${fileId}: OCR failed: ${msg}`);
    throw new Error(
      extracted.ok
        ? "OCR could not read this scanned document. Please try a clearer scan."
        : "This file could not be opened as a PDF. It may be damaged or password-protected.",
    );
  }
  return {
    text: ocr.truncated
      ? `${ocr.text}\n\n[Note: only the first ${ocr.pageCount} pages were OCR-processed]`
      : ocr.text,
    pageCount: ocr.pageCount,
    ocrUsed: true,
  };
}

/** Full pipeline for one document. Always ends in "indexed" or "failed". */
export async function processDocument(
  vaultId: string,
  fileId: string,
): Promise<{ ok: boolean; error?: string }> {
  const vault = await MemoryVault.findById(vaultId);
  const file = vault?.files.find((f) => String(f._id) === String(fileId));
  if (!vault || !file) return { ok: false, error: "Document not found" };

  const startedAt = Date.now();
  await setFileFields(vaultId, fileId, {
    status: "processing",
    indexError: null,
    isIndexed: false,
    processingStartedAt: new Date(),
  });

  try {
    if (!file.localPath || !fs.existsSync(file.localPath)) {
      throw new Error("The uploaded file is missing on the server.");
    }

    const result = await withTimeout(
      (async () => {
        const { text, pageCount, ocrUsed } = await extractWithOcrFallback(
          vaultId,
          fileId,
          file.localPath!,
          String(file.fileType).toLowerCase(),
        );

        if (!text || !hasUsableText(text, 1)) {
          throw new Error(
            ocrUsed
              ? "No readable text was found, even after OCR. The scan may be too low quality."
              : "No text could be extracted from this document.",
          );
        }

        const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

        // Replace previous chunks (retry / re-index must not duplicate data).
        await MemoryChunk.deleteMany({
          fileId: new mongoose.Types.ObjectId(fileId),
          userId: vault.userId,
        });
        await storeChunksAsText(
          vault.userId as mongoose.Types.ObjectId,
          vault._id as mongoose.Types.ObjectId,
          "file",
          chunks,
          new mongoose.Types.ObjectId(fileId),
          file.avatarId ? String(file.avatarId) : undefined,
        );
        return { chunkCount: chunks.length, pageCount, ocrUsed };
      })(),
      DOCUMENT_TIMEOUT_MS,
    );

    await setFileFields(vaultId, fileId, {
      status: "indexed" as DocumentStatus,
      isIndexed: true,
      indexError: null,
      ocrUsed: result.ocrUsed,
      pageCount: result.pageCount ?? null,
      chunkCount: result.chunkCount,
      processedAt: new Date(),
    });
    await MemoryVault.updateOne(
      { _id: vaultId },
      {
        $set: {
          "vectorConfig.isIndexed": true,
          "vectorConfig.lastIndexedAt": new Date(),
        },
      },
    );
    console.log(
      `[Documents] ✓ ${file.fileName} indexed (${result.chunkCount} chunks, ocr=${result.ocrUsed}) in ${Date.now() - startedAt}ms`,
    );
    return { ok: true };
  } catch (e: any) {
    const msg = String(e?.message || "Unknown processing error").slice(0, 500);
    console.error(`[Documents] ✗ ${file.fileName}: ${msg}`);
    await setFileFields(vaultId, fileId, {
      status: "failed" as DocumentStatus,
      isIndexed: false,
      indexError: msg,
      processedAt: new Date(),
    });
    return { ok: false, error: msg };
  }
}

/**
 * Status for documents created before Milestone 3 (no `status` field yet).
 */
export function effectiveStatus(file: {
  status?: string | null;
  isIndexed?: boolean;
}): DocumentStatus {
  if (file.status) return file.status as DocumentStatus;
  return file.isIndexed ? "indexed" : "failed";
}

/**
 * At boot: re-queue documents left in processing (server restart) and
 * documents from before M3 that were never indexed.
 */
export async function resumePendingDocuments(): Promise<void> {
  const vaults = await MemoryVault.find(
    {
      files: {
        $elemMatch: {
          $or: [
            { status: { $in: ["processing", "ocr_processing"] } },
            { status: { $exists: false }, isIndexed: { $ne: true } },
          ],
        },
      },
    },
    { files: 1 },
  ).lean();

  let count = 0;
  for (const v of vaults) {
    for (const f of v.files as any[]) {
      const pending =
        f.status === "processing" ||
        f.status === "ocr_processing" ||
        (!f.status && !f.isIndexed);
      if (pending) {
        enqueueDocument(String(v._id), String(f._id));
        count++;
      }
    }
  }
  if (count) console.log(`[Documents] Re-queued ${count} pending document(s)`);
}
