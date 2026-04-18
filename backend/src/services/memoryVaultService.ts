// ═══════════════════════════════════════════════════════════════════════
// services/memoryVaultService.ts — KEYWORD SEARCH VERSION
// ═══════════════════════════════════════════════════════════════════════
//
// Workaround: instead of calling storeChunks() (which generates OpenAI
// embeddings and crashes on various edge cases), we write chunks
// directly to MongoDB as plain text. The keyword search service
// reads them back at chat time.
//
// The old embedding code still exists in embeddingService.ts but is
// no longer called from here — kept as dead code for easy rollback.

import mongoose from "mongoose";
import MemoryVault from "../models/MemoryVault";
import MemoryChunk from "../models/MemoryChunk";
import { extractTextFromFile, chunkText } from "./textExtractionService";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;

/**
 * Write chunks directly to MongoDB as plain text.
 * No embedding generation. No OpenAI calls. No vector indexing.
 * This is the bypass that eliminates the RAG pipeline's failure modes.
 */
async function storeChunksAsText(
  userId: mongoose.Types.ObjectId,
  vaultId: mongoose.Types.ObjectId,
  source: "file" | "neuralBio",
  chunks: string[],
  fileId?: mongoose.Types.ObjectId,
  avatarId?: string,
): Promise<void> {
  if (chunks.length === 0) return;

  const avatarObjectId = avatarId
    ? new mongoose.Types.ObjectId(avatarId)
    : null;

  // Insert in batches so MongoDB doesn't choke on very long documents
  const BATCH_SIZE = 50;
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE).map((text, idx) => ({
      userId,
      memoryVaultId: vaultId,
      source,
      text,
      fileId: fileId || null,
      avatarId: avatarObjectId,
      chunkIndex: i + idx,
      // embedding field left empty — not used in keyword mode
    }));

    await MemoryChunk.insertMany(batch, { ordered: false });
  }

  console.log(
    `[MemoryVault] Stored ${chunks.length} chunks (source=${source}, avatar=${avatarId || "none"})`,
  );
}

/**
 * Index a file: extract text → chunk → store as plain text.
 * Returns quickly; no long-running embedding step.
 */
export async function indexFile(
  vaultId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  fileId: mongoose.Types.ObjectId,
  localPath: string,
  fileType: string,
  avatarId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const vault = await MemoryVault.findById(vaultId);
  if (!vault || vault.userId.toString() !== userId.toString()) {
    return { ok: false, error: "Vault not found" };
  }

  // 1. Text Extraction
  console.log(`[indexFile] Extracting text from ${localPath}`);
  const extracted = await extractTextFromFile(localPath, fileType);
  if (!extracted.ok) {
    return { ok: false, error: extracted.error || "Extract failed" };
  }
  console.log(`[indexFile] Extracted ${extracted.text.length} chars`);

  // 2. Chunking
  const chunks = chunkText(extracted.text, CHUNK_SIZE, CHUNK_OVERLAP);
  if (chunks.length === 0) {
    return { ok: false, error: "No text extracted from file" };
  }
  console.log(`[indexFile] Chunked into ${chunks.length} pieces`);

  // 3. Store chunks (plain text — no embeddings)
  try {
    await storeChunksAsText(userId, vaultId, "file", chunks, fileId, avatarId);
  } catch (e: any) {
    return { ok: false, error: `Storage failed: ${e.message}` };
  }

  // 4. Mark indexed
  const files = vault.files as any[];
  const fileIndex = files.findIndex(
    (f) => f._id.toString() === fileId.toString(),
  );
  if (fileIndex >= 0) {
    files[fileIndex].isIndexed = true;
    if (avatarId) {
      files[fileIndex].avatarId = new mongoose.Types.ObjectId(avatarId);
    }
  }
  vault.vectorConfig.isIndexed = true;
  vault.vectorConfig.lastIndexedAt = new Date();
  await vault.save();

  console.log(`[indexFile] ✓ Complete for ${localPath}`);
  return { ok: true };
}

/**
 * Index the user's bio text.
 */
export async function indexNeuralBio(
  vaultId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  neuralBio: string,
  avatarId?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const vault = await MemoryVault.findById(vaultId);
  if (!vault || vault.userId.toString() !== userId.toString()) {
    return { ok: false, error: "Vault not found" };
  }

  const text = (neuralBio || "").trim();
  if (!text) return { ok: false, error: "Neural bio is empty" };

  // Clear previous bio chunks to avoid duplicates
  await MemoryChunk.deleteMany({
    userId,
    memoryVaultId: vaultId,
    source: "neuralBio",
    avatarId: avatarId ? new mongoose.Types.ObjectId(avatarId) : null,
  });

  const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

  try {
    await storeChunksAsText(
      userId,
      vaultId,
      "neuralBio",
      chunks,
      undefined,
      avatarId,
    );
  } catch (e: any) {
    return { ok: false, error: `Storage failed: ${e.message}` };
  }

  vault.vectorConfig.isIndexed = true;
  vault.vectorConfig.lastIndexedAt = new Date();
  await vault.save();

  return { ok: true };
}

/**
 * Remove all chunks for a vault.
 */
export async function clearVaultChunks(
  vaultId: mongoose.Types.ObjectId,
): Promise<void> {
  await MemoryChunk.deleteMany({ memoryVaultId: vaultId });
}
