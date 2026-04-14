// services/memoryVaultService.ts – orchestrate extract -> vectorize -> store; update isIndexed
import mongoose from "mongoose";
import MemoryVault from "../models/MemoryVault";
import MemoryChunk from "../models/MemoryChunk";
import { extractTextFromFile, chunkText } from "./textExtractionService";
import { storeChunks } from "./embeddingService";
import path from "node:path";

const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
/** Index a single file: extract text -> chunk -> embed -> store; update file and vault isIndexed */

export async function indexFile(
  vaultId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  fileId: mongoose.Types.ObjectId,
  localPath: string,
  fileType: string,
  avatarId?: string, // Added avatarId support
): Promise<{ ok: true } | { ok: false; error: string }> {
  const vault = await MemoryVault.findById(vaultId);
  if (!vault || vault.userId.toString() !== userId.toString()) {
    return { ok: false, error: "Vault not found" };
  }

  // 1. Text Extraction
  const extracted = await extractTextFromFile(localPath, fileType);
  if (!extracted.ok) {
    return { ok: false, error: extracted.error || "Extract failed" };
  }

  // 2. Chunking
  const chunks = chunkText(extracted.text, CHUNK_SIZE, CHUNK_OVERLAP);
  if (chunks.length === 0) {
    return { ok: false, error: "No text extracted from file" };
  }

  // 3. Vector Storage with Avatar Scoping
  // Passing avatarId as the 6th argument to storeChunks
  await storeChunks(
    userId,
    vaultId,
    "file",
    chunks,
    fileId,
    avatarId, // This tags every chunk with the selected Avatar
  );

  // 4. Update indexing status in the Vault
  const files = vault.files as any[];
  const fileIndex = files.findIndex(
    (f) => f._id.toString() === fileId.toString(),
  );

  if (fileIndex >= 0) {
    files[fileIndex].isIndexed = true;
    // Ensure the file entry in the vault also knows its avatarId
    if (avatarId) {
      files[fileIndex].avatarId = new mongoose.Types.ObjectId(avatarId);
    }
  }

  vault.vectorConfig.isIndexed = true;
  vault.vectorConfig.lastIndexedAt = new Date();
  await vault.save();

  return { ok: true };
}
/** Index neural bio: chunk -> embed -> store; set vault.vectorConfig.isIndexed */
export async function indexNeuralBio(
  vaultId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId,
  neuralBio: string,
  avatarId?: string, // Added avatarId support
): Promise<{ ok: true } | { ok: false; error: string }> {
  const vault = await MemoryVault.findById(vaultId);
  if (!vault || vault.userId.toString() !== userId.toString()) {
    return { ok: false, error: "Vault not found" };
  }

  const text = (neuralBio || "").trim();
  if (!text) return { ok: false, error: "Neural bio is empty" };

  // 1. CLEAR PREVIOUS BIO CHUNKS (Avoid duplicates)
  // We only clear chunks for this specific user/vault that came from 'neuralBio'
  await MemoryChunk.deleteMany({
    userId,
    memoryVaultId: vaultId,
    source: "neuralBio",
    avatarId: avatarId || null,
  });

  // 2. CHUNK THE NEW TEXT
  const chunks = chunkText(text, CHUNK_SIZE, CHUNK_OVERLAP);

  // 3. STORE WITH AVATAR SCOPING
  // Passing avatarId as the 6th argument to match the updated storeChunks signature
  await storeChunks(userId, vaultId, "neuralBio", chunks, undefined, avatarId);

  // 4. UPDATE VAULT STATUS
  vault.vectorConfig.isIndexed = true;
  vault.vectorConfig.lastIndexedAt = new Date();
  await vault.save();

  return { ok: true };
}
/** Remove all chunks for a vault (e.g. before re-indexing). */
export async function clearVaultChunks(
  vaultId: mongoose.Types.ObjectId,
): Promise<void> {
  await MemoryChunk.deleteMany({ memoryVaultId: vaultId });
}
