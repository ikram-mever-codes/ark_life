// controllers/memory.controller.ts – add-memory (upload + neuralBio), RAG query, status
import { Response } from "express";
import path from "node:path";
import { AuthRequest } from "../middleware/auth";
import MemoryVault from "../models/MemoryVault";
import { getMemoryUploadDir } from "../config/multer";
import { findTopChunks } from "../services/embeddingService";
import { indexFile, indexNeuralBio } from "../services/memoryVaultService";
import Avatar from "../models/Avatar";
import MemoryChunk from "../models/MemoryChunk";
import fs from "fs";

export class MemoryController {
  /** POST /add-memory – file upload (Multer) and/or neuralBio. Files stored in protected dir; background indexing. */
  // controllers/memory.controller.ts

  addMemory = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Pick up avatarId from body to scope this memory
    const { neuralBio, avatarId } = req.body;

    let vault = await MemoryVault.findOne({ userId });
    if (!vault) {
      vault = await MemoryVault.create({
        userId,
        files: [],
        vectorConfig: { indexName: "vector_index", isIndexed: false },
        encryption: { algorithm: "AES-256-GCM", isQuantumReady: false },
      });
    }

    const added: string[] = [];

    // 1. Handle Neural Bio (Textual Memory)
    if (neuralBio !== undefined) {
      const bio = (neuralBio || "").trim();
      vault.neuralBio = bio || undefined;
      await vault.save();

      if (bio) {
        added.push("neuralBio");
        // Background Indexing with avatarId scoping
        setImmediate(() => {
          indexNeuralBio(vault!._id, userId, bio, avatarId).catch((e) =>
            console.error("[Memory] Bio Index Error", e),
          );
        });
      }
    }

    // 2. Handle File Uploads (Document Memory)
    if ((req as any).file) {
      const file = (req as any).file as Express.Multer.File;
      const ext =
        path.extname(file.originalname).slice(1).toLowerCase() || "txt";

      vault.files.push({
        fileName: file.originalname,
        fileType: ext as any,
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
          indexFile(
            vault!._id,
            userId,
            fileEntry._id!,
            file.path,
            ext,
            avatarId,
          )
            .then(async (r) => {
              if (r.ok) {
                await MemoryVault.updateOne(
                  { _id: vault!._id, "files._id": fileEntry._id },
                  {
                    $set: {
                      "files.$.isIndexed": true,
                      "vectorConfig.isIndexed": true,
                      "vectorConfig.lastIndexedAt": new Date(),
                    },
                  },
                );
              }
            })
            .catch((e) => console.error("[Memory] File Index Error", e));
        });
      }
    }

    // Ensure all user avatars link to this central vault if not already
    await Avatar.updateMany(
      { userId, memoryVaultId: { $exists: false } },
      { $set: { memoryVaultId: vault._id } },
    );

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
  deleteMemory = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const { fileId } = req.params;

    // Find vault and ensure ownership
    const vault = await MemoryVault.findOne({ userId });
    if (!vault) {
      return res
        .status(404)
        .json({ success: false, message: "Vault not found" });
    }

    // Find the file entry within the vault
    const fileIndex = vault.files.findIndex(
      (f) => f._id?.toString() === fileId,
    );
    if (fileIndex === -1) {
      return res
        .status(404)
        .json({ success: false, message: "File not found in vault" });
    }

    const file = vault.files[fileIndex];

    try {
      // 1. Remove physical file from disk
      if (file.localPath && fs.existsSync(file.localPath)) {
        fs.unlinkSync(file.localPath);
      }

      // 2. Remove Vector Chunks (The "Memory Chunks")
      // This is the most important part for RAG cleanup
      await MemoryChunk.deleteMany({
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
    } catch (error) {
      console.error("[Memory Delete Error]", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to purge memory" });
    }
  };
  /** GET /rag-query?q=... – vectorize query, similarity search, return top 3 chunks (userId-scoped) */
  ragQuery = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const q = (req.query?.q as string)?.trim();
    if (!q) {
      return res
        .status(400)
        .json({ success: false, message: "Query parameter 'q' is required" });
    }

    const topK = Math.min(parseInt(String(req.query?.topK), 10) || 3, 10);
    const chunks = await findTopChunks(userId.toString(), q, undefined, topK);

    return res.status(200).json({
      success: true,
      data: { query: q, chunks },
    });
  };

  /** GET /memory/vault – get current user's vault (files, neuralBio, vectorConfig status) */
  getVault = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    let vault = await MemoryVault.findOne({ userId }).lean();
    if (!vault) {
      vault = (
        await MemoryVault.create({
          userId,
          files: [],
          vectorConfig: { indexName: "vector_index", isIndexed: false },
          encryption: { algorithm: "AES-256-GCM", isQuantumReady: false },
        })
      ).toJSON();
    }

    return res.status(200).json({ success: true, data: { vault } });
  };
}

export default new MemoryController();
