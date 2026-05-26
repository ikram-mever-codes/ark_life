// ═══════════════════════════════════════════════════════════════════════
// controllers/memory.controller.ts — DEBUG + SYNCHRONOUS INDEXING
// ═══════════════════════════════════════════════════════════════════════
// Critical changes:
//   1. Removed setImmediate — indexing runs INLINE during the request
//      so errors actually surface and the response only returns after
//      indexing is complete (or failed with a clear reason)
//   2. Heavy logging at every boundary so we can see exactly what runs
//   3. Response includes an `indexResult` field so the frontend immediately
//      knows whether indexing succeeded, without polling

import { Response } from "express";
import path from "node:path";
import { AuthRequest } from "../middleware/auth";
import MemoryVault from "../models/MemoryVault";
import { findTopChunksByKeyword } from "../services/keywordResearchService";
import { indexFile, indexNeuralBio } from "../services/memoryVaultService";
import Avatar from "../models/Avatar";
import MemoryChunk from "../models/MemoryChunk";
import fs from "fs";

const MAX_INDEXABLE_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const INDEXING_TIMEOUT_MS = 30_000; // 30 seconds — shorter since it's synchronous

const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`[${label}] timed out after ${ms}ms`)),
        ms,
      ),
    ),
  ]);
};

const markFileIndexError = async (
  vaultId: any,
  fileId: any,
  errMessage: string,
) => {
  try {
    await MemoryVault.updateOne(
      { _id: vaultId, "files._id": fileId },
      {
        $set: {
          "files.$.isIndexed": false,
          "files.$.indexError": String(errMessage).slice(0, 500),
        },
      },
    );
  } catch (e) {
    console.error("[Memory] Could not mark file index error:", e);
  }
};

const markFileIndexed = async (vaultId: any, fileId: any) => {
  try {
    await MemoryVault.updateOne(
      { _id: vaultId, "files._id": fileId },
      {
        $set: {
          "files.$.isIndexed": true,
          "files.$.indexError": null,
          "vectorConfig.isIndexed": true,
          "vectorConfig.lastIndexedAt": new Date(),
        },
      },
    );
  } catch (e) {
    console.error("[Memory] Could not mark file as indexed:", e);
  }
};

export class MemoryController {
  /** POST /add-memory — file upload and/or neuralBio */
  addMemory = async (req: AuthRequest, res: Response) => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("[addMemory] Request received");

    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const { neuralBio, avatarId } = req.body;
    console.log("[addMemory] userId:", userId);
    console.log("[addMemory] avatarId:", avatarId);
    console.log("[addMemory] has file:", !!(req as any).file);
    console.log("[addMemory] has neuralBio:", neuralBio !== undefined);

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
    let indexResult: { ok: boolean; error?: string } | null = null;

    // ─── Neural Bio (text) — still run in background since it's fast ───
    if (neuralBio !== undefined) {
      const bio = (neuralBio || "").trim();
      vault.neuralBio = bio || undefined;
      await vault.save();

      if (bio) {
        added.push("neuralBio");
        try {
          console.log("[addMemory] Indexing neural bio inline...");
          await withTimeout(
            indexNeuralBio(vault._id, userId, bio, avatarId),
            INDEXING_TIMEOUT_MS,
            "indexNeuralBio",
          );
          console.log("[addMemory] Bio indexed ✓");
        } catch (e: any) {
          console.error("[addMemory] Bio index error:", e.message);
        }
      }
    }

    // ─── File Upload — INLINE indexing with full error visibility ───
    if ((req as any).file) {
      const file = (req as any).file as Express.Multer.File;
      const ext =
        path.extname(file.originalname).slice(1).toLowerCase() || "txt";

      let fileSize = 0;
      try {
        fileSize = fs.statSync(file.path).size;
      } catch {
        fileSize = 0;
      }

      console.log(
        `[addMemory] File: ${file.originalname} (${fileSize} bytes, type=${ext})`,
      );
      console.log(`[addMemory] File path: ${file.path}`);

      const isTooLarge = fileSize > MAX_INDEXABLE_FILE_BYTES;

      vault.files.push({
        fileName: file.originalname,
        fileType: ext as any,
        localPath: file.path,
        uploadDate: new Date(),
        isIndexed: false,
        avatarId: avatarId || null,
      } as any);

      await vault.save();
      const fileEntry = vault.files[vault.files.length - 1];
      added.push(`file:${fileEntry.fileName}`);

      if (isTooLarge) {
        const msg = `File exceeds ${MAX_INDEXABLE_FILE_BYTES / 1024 / 1024}MB indexing limit`;
        console.warn(`[addMemory] ${msg}`);
        await markFileIndexError(vault._id, fileEntry._id, msg);
        indexResult = { ok: false, error: msg };
      } else if (fileEntry._id) {
        // ═══ INLINE INDEXING ═══
        // Run synchronously inside the request so errors surface as
        // real 500s / response fields, not silent background failures.
        console.log(
          `[addMemory] >>> Starting inline indexing for ${fileEntry.fileName}`,
        );
        const startTime = Date.now();
        const startHeap = process.memoryUsage().heapUsed / 1024 / 1024;

        try {
          const r = await withTimeout(
            indexFile(
              vault._id,
              userId,
              fileEntry._id!,
              file.path,
              ext,
              avatarId,
            ),
            INDEXING_TIMEOUT_MS,
            "indexFile",
          );

          if (r?.ok) {
            await markFileIndexed(vault._id, fileEntry._id);
            const endHeap = process.memoryUsage().heapUsed / 1024 / 1024;
            const elapsed = Date.now() - startTime;
            console.log(
              `[addMemory] <<< Indexed ${fileEntry.fileName} in ${elapsed}ms. Heap: ${startHeap.toFixed(0)}MB → ${endHeap.toFixed(0)}MB`,
            );
            indexResult = { ok: true };
          } else {
            const msg = (r as any)?.error || "Indexer returned ok=false";
            console.error(`[addMemory] Indexer failed: ${msg}`);
            await markFileIndexError(vault._id, fileEntry._id, msg);
            indexResult = { ok: false, error: msg };
          }
        } catch (e: any) {
          const msg = e?.message || "Unknown indexing error";
          console.error(`[addMemory] Index exception: ${msg}`);
          console.error(e?.stack);
          await markFileIndexError(vault._id, fileEntry._id, msg);
          indexResult = { ok: false, error: msg };
        }
      }
    }

    // Link user's avatars to this vault
    await Avatar.updateMany(
      { userId, memoryVaultId: { $exists: false } },
      { $set: { memoryVaultId: vault._id } },
    );

    // Return fresh vault so frontend sees the latest state
    const freshVault = await MemoryVault.findById(vault._id).lean();
    console.log("[addMemory] Response ready, indexResult:", indexResult);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    return res.status(201).json({
      success: true,
      message: indexResult?.ok
        ? "Memory added and indexed successfully"
        : indexResult
          ? `Memory added but indexing failed: ${indexResult.error}`
          : "Memory added.",
      data: {
        vault: freshVault,
        added,
        indexResult,
      },
    });
  };

  /** DELETE /files/:fileId */
  deleteMemory = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const { fileId } = req.params;

    const vault = await MemoryVault.findOne({ userId });
    if (!vault) {
      return res
        .status(404)
        .json({ success: false, message: "Vault not found" });
    }

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
      if (file.localPath && fs.existsSync(file.localPath)) {
        fs.unlinkSync(file.localPath);
      }

      await MemoryChunk.deleteMany({
        fileId: file._id,
        userId: userId,
      });

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

  /** GET /rag-query?q=... */
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
    const chunks = await findTopChunksByKeyword(
      userId.toString(),
      q,
      undefined,
      topK,
    );

    return res.status(200).json({
      success: true,
      data: { query: q, chunks },
    });
  };

  /** GET /vault */
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
