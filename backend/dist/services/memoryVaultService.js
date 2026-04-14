"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.indexFile = indexFile;
exports.indexNeuralBio = indexNeuralBio;
exports.clearVaultChunks = clearVaultChunks;
// services/memoryVaultService.ts – orchestrate extract -> vectorize -> store; update isIndexed
const mongoose_1 = __importDefault(require("mongoose"));
const MemoryVault_1 = __importDefault(require("../models/MemoryVault"));
const MemoryChunk_1 = __importDefault(require("../models/MemoryChunk"));
const textExtractionService_1 = require("./textExtractionService");
const embeddingService_1 = require("./embeddingService");
const CHUNK_SIZE = 800;
const CHUNK_OVERLAP = 100;
/** Index a single file: extract text -> chunk -> embed -> store; update file and vault isIndexed */
async function indexFile(vaultId, userId, fileId, localPath, fileType, avatarId) {
    const vault = await MemoryVault_1.default.findById(vaultId);
    if (!vault || vault.userId.toString() !== userId.toString()) {
        return { ok: false, error: "Vault not found" };
    }
    // 1. Text Extraction
    const extracted = await (0, textExtractionService_1.extractTextFromFile)(localPath, fileType);
    if (!extracted.ok) {
        return { ok: false, error: extracted.error || "Extract failed" };
    }
    // 2. Chunking
    const chunks = (0, textExtractionService_1.chunkText)(extracted.text, CHUNK_SIZE, CHUNK_OVERLAP);
    if (chunks.length === 0) {
        return { ok: false, error: "No text extracted from file" };
    }
    // 3. Vector Storage with Avatar Scoping
    // Passing avatarId as the 6th argument to storeChunks
    await (0, embeddingService_1.storeChunks)(userId, vaultId, "file", chunks, fileId, avatarId);
    // 4. Update indexing status in the Vault
    const files = vault.files;
    const fileIndex = files.findIndex((f) => f._id.toString() === fileId.toString());
    if (fileIndex >= 0) {
        files[fileIndex].isIndexed = true;
        // Ensure the file entry in the vault also knows its avatarId
        if (avatarId) {
            files[fileIndex].avatarId = new mongoose_1.default.Types.ObjectId(avatarId);
        }
    }
    vault.vectorConfig.isIndexed = true;
    vault.vectorConfig.lastIndexedAt = new Date();
    await vault.save();
    return { ok: true };
}
/** Index neural bio: chunk -> embed -> store; set vault.vectorConfig.isIndexed */
async function indexNeuralBio(vaultId, userId, neuralBio, avatarId) {
    const vault = await MemoryVault_1.default.findById(vaultId);
    if (!vault || vault.userId.toString() !== userId.toString()) {
        return { ok: false, error: "Vault not found" };
    }
    const text = (neuralBio || "").trim();
    if (!text)
        return { ok: false, error: "Neural bio is empty" };
    // 1. CLEAR PREVIOUS BIO CHUNKS (Avoid duplicates)
    // We only clear chunks for this specific user/vault that came from 'neuralBio'
    await MemoryChunk_1.default.deleteMany({
        userId,
        memoryVaultId: vaultId,
        source: "neuralBio",
        avatarId: avatarId || null,
    });
    // 2. CHUNK THE NEW TEXT
    const chunks = (0, textExtractionService_1.chunkText)(text, CHUNK_SIZE, CHUNK_OVERLAP);
    // 3. STORE WITH AVATAR SCOPING
    // Passing avatarId as the 6th argument to match the updated storeChunks signature
    await (0, embeddingService_1.storeChunks)(userId, vaultId, "neuralBio", chunks, undefined, avatarId);
    // 4. UPDATE VAULT STATUS
    vault.vectorConfig.isIndexed = true;
    vault.vectorConfig.lastIndexedAt = new Date();
    await vault.save();
    return { ok: true };
}
/** Remove all chunks for a vault (e.g. before re-indexing). */
async function clearVaultChunks(vaultId) {
    await MemoryChunk_1.default.deleteMany({ memoryVaultId: vaultId });
}
//# sourceMappingURL=memoryVaultService.js.map