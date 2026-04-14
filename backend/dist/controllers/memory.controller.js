"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryController = void 0;
const node_path_1 = __importDefault(require("node:path"));
const MemoryVault_1 = __importDefault(require("../models/MemoryVault"));
const embeddingService_1 = require("../services/embeddingService");
const memoryVaultService_1 = require("../services/memoryVaultService");
const Avatar_1 = __importDefault(require("../models/Avatar"));
const MemoryChunk_1 = __importDefault(require("../models/MemoryChunk"));
const fs_1 = __importDefault(require("fs"));
class MemoryController {
    constructor() {
        /** POST /add-memory – file upload (Multer) and/or neuralBio. Files stored in protected dir; background indexing. */
        // controllers/memory.controller.ts
        this.addMemory = async (req, res) => {
            const userId = req.user?._id;
            if (!userId) {
                return res
                    .status(401)
                    .json({ success: false, message: "Not authenticated" });
            }
            // Pick up avatarId from body to scope this memory
            const { neuralBio, avatarId } = req.body;
            let vault = await MemoryVault_1.default.findOne({ userId });
            if (!vault) {
                vault = await MemoryVault_1.default.create({
                    userId,
                    files: [],
                    vectorConfig: { indexName: "vector_index", isIndexed: false },
                    encryption: { algorithm: "AES-256-GCM", isQuantumReady: false },
                });
            }
            const added = [];
            // 1. Handle Neural Bio (Textual Memory)
            if (neuralBio !== undefined) {
                const bio = (neuralBio || "").trim();
                vault.neuralBio = bio || undefined;
                await vault.save();
                if (bio) {
                    added.push("neuralBio");
                    // Background Indexing with avatarId scoping
                    setImmediate(() => {
                        (0, memoryVaultService_1.indexNeuralBio)(vault._id, userId, bio, avatarId).catch((e) => console.error("[Memory] Bio Index Error", e));
                    });
                }
            }
            // 2. Handle File Uploads (Document Memory)
            if (req.file) {
                const file = req.file;
                const ext = node_path_1.default.extname(file.originalname).slice(1).toLowerCase() || "txt";
                vault.files.push({
                    fileName: file.originalname,
                    fileType: ext,
                    localPath: file.path,
                    uploadDate: new Date(),
                    isIndexed: false,
                    avatarId: avatarId || null, // Tag file in vault metadata
                });
                await vault.save();
                const fileEntry = vault.files[vault.files.length - 1];
                added.push(`file:${fileEntry.fileName}`);
                // Background Indexing with avatarId scoping
                if (fileEntry._id) {
                    setImmediate(() => {
                        (0, memoryVaultService_1.indexFile)(vault._id, userId, fileEntry._id, file.path, ext, avatarId)
                            .then(async (r) => {
                            if (r.ok) {
                                await MemoryVault_1.default.updateOne({ _id: vault._id, "files._id": fileEntry._id }, {
                                    $set: {
                                        "files.$.isIndexed": true,
                                        "vectorConfig.isIndexed": true,
                                        "vectorConfig.lastIndexedAt": new Date(),
                                    },
                                });
                            }
                        })
                            .catch((e) => console.error("[Memory] File Index Error", e));
                    });
                }
            }
            // Ensure all user avatars link to this central vault if not already
            await Avatar_1.default.updateMany({ userId, memoryVaultId: { $exists: false } }, { $set: { memoryVaultId: vault._id } });
            return res.status(201).json({
                success: true,
                message: added.length
                    ? "Memory added. Indexing in progress."
                    : "Vault updated.",
                data: { vault, added },
            });
        };
        /** DELETE /api/v1/memory/files/:fileId */
        /** DELETE /api/v1/memory/files/:fileId */
        this.deleteMemory = async (req, res) => {
            const userId = req.user?._id;
            const { fileId } = req.params;
            // Find vault and ensure ownership
            const vault = await MemoryVault_1.default.findOne({ userId });
            if (!vault) {
                return res
                    .status(404)
                    .json({ success: false, message: "Vault not found" });
            }
            // Find the file entry within the vault
            const fileIndex = vault.files.findIndex((f) => f._id?.toString() === fileId);
            if (fileIndex === -1) {
                return res
                    .status(404)
                    .json({ success: false, message: "File not found in vault" });
            }
            const file = vault.files[fileIndex];
            try {
                // 1. Remove physical file from disk
                if (file.localPath && fs_1.default.existsSync(file.localPath)) {
                    fs_1.default.unlinkSync(file.localPath);
                }
                // 2. Remove Vector Chunks (The "Memory Chunks")
                // This is the most important part for RAG cleanup
                await MemoryChunk_1.default.deleteMany({
                    fileId: file._id,
                    userId: userId, // Extra safety check
                });
                // 3. Remove metadata from Vault Array
                vault.files.splice(fileIndex, 1);
                await vault.save();
                return res.status(200).json({
                    success: true,
                    message: "Memory fragment and vector chunks purged",
                });
            }
            catch (error) {
                console.error("[Memory Delete Error]", error);
                return res
                    .status(500)
                    .json({ success: false, message: "Failed to purge memory" });
            }
        };
        /** GET /rag-query?q=... – vectorize query, similarity search, return top 3 chunks (userId-scoped) */
        this.ragQuery = async (req, res) => {
            const userId = req.user?._id;
            if (!userId) {
                return res
                    .status(401)
                    .json({ success: false, message: "Not authenticated" });
            }
            const q = req.query?.q?.trim();
            if (!q) {
                return res
                    .status(400)
                    .json({ success: false, message: "Query parameter 'q' is required" });
            }
            const topK = Math.min(parseInt(String(req.query?.topK), 10) || 3, 10);
            const chunks = await (0, embeddingService_1.findTopChunks)(userId.toString(), q, undefined, topK);
            return res.status(200).json({
                success: true,
                data: { query: q, chunks },
            });
        };
        /** GET /memory/vault – get current user's vault (files, neuralBio, vectorConfig status) */
        this.getVault = async (req, res) => {
            const userId = req.user?._id;
            if (!userId) {
                return res
                    .status(401)
                    .json({ success: false, message: "Not authenticated" });
            }
            let vault = await MemoryVault_1.default.findOne({ userId }).lean();
            if (!vault) {
                vault = (await MemoryVault_1.default.create({
                    userId,
                    files: [],
                    vectorConfig: { indexName: "vector_index", isIndexed: false },
                    encryption: { algorithm: "AES-256-GCM", isQuantumReady: false },
                })).toJSON();
            }
            return res.status(200).json({ success: true, data: { vault } });
        };
    }
}
exports.MemoryController = MemoryController;
exports.default = new MemoryController();
//# sourceMappingURL=memory.controller.js.map