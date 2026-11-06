// ═══════════════════════════════════════════════════════════════════════
// controllers/memory.controller.ts — Documents & memory (Milestone 3)
// ═══════════════════════════════════════════════════════════════════════
//
// Uploads return immediately with status "processing"; the document pipeline
// (services/documentProcessingService.ts) runs in the background and moves
// each file to "indexed" or "failed". The frontend polls GET /vault.

import { Response } from "express";
import path from "node:path";
import fs from "node:fs";
import { AuthRequest } from "../middleware/auth";
import MemoryVault from "../models/MemoryVault";
import MemoryChunk from "../models/MemoryChunk";
import Avatar from "../models/Avatar";
import { findTopChunksByKeyword } from "../services/keywordResearchService";
import { indexNeuralBio } from "../services/memoryVaultService";
import {
  effectiveStatus,
  enqueueDocument,
} from "../services/documentProcessingService";
import { UPLOAD_BASE } from "../config/multer";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  json: "application/json; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg",
  png: "image/png",
  mp3: "audio/mpeg",
  wav: "audio/wav",
};

async function getOrCreateVault(userId: any) {
  let vault = await MemoryVault.findOne({ userId });
  if (!vault) {
    vault = await MemoryVault.create({
      userId,
      files: [],
      vectorConfig: { indexName: "vector_index", isIndexed: false },
      encryption: { algorithm: "AES-256-GCM", isQuantumReady: false },
    });
  }
  return vault;
}

/** Remove server paths before sending the vault to the browser. */
function toClientVault(vault: any) {
  if (!vault) return vault;
  const v = typeof vault.toObject === "function" ? vault.toObject() : vault;
  return {
    ...v,
    files: (v.files || []).map((f: any) => {
      const { localPath, ...rest } = f;
      return {
        ...rest,
        status: effectiveStatus(f),
        category: f.category || "personal",
        source: f.source || "upload",
      };
    }),
  };
}

export class MemoryController {
  /** POST /add-memory — file upload and/or neuralBio */
  addMemory = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const { neuralBio, avatarId } = req.body;
    const category = req.body.category === "clinical" ? "clinical" : "personal";
    const source = req.body.source === "fse" ? "fse" : "upload";

    // An avatarId must belong to the current user.
    if (avatarId) {
      const owns = await Avatar.exists({ _id: avatarId, userId });
      if (!owns) {
        return res
          .status(404)
          .json({ success: false, message: "Avatar not found" });
      }
    }

    const vault = await getOrCreateVault(userId);
    const added: string[] = [];

    // ─── Neural Bio (short text, indexed inline) ───
    if (neuralBio !== undefined) {
      const bio = String(neuralBio || "").trim();
      vault.neuralBio = bio || undefined;
      await vault.save();
      if (bio) {
        added.push("neuralBio");
        const r = await indexNeuralBio(vault._id as any, userId, bio, avatarId);
        if (!r.ok) console.error("[addMemory] Bio index error:", r.error);
      }
    }

    // ─── File upload → background pipeline ───
    let fileId: string | null = null;
    const file = (req as any).file as Express.Multer.File | undefined;
    if (file) {
      const ext = path.extname(file.filename).slice(1).toLowerCase() || "txt";

      vault.files.push({
        fileName: file.originalname,
        fileType: ext as any,
        localPath: file.path,
        uploadDate: new Date(),
        isIndexed: false,
        status: "processing",
        indexError: null,
        sizeBytes: file.size,
        mimeType: file.mimetype,
        // Clinical documents are user-wide; personal memories can be avatar-scoped.
        avatarId: category === "clinical" ? null : avatarId || null,
        category,
        source,
      } as any);
      await vault.save();

      const entry = vault.files[vault.files.length - 1];
      fileId = String(entry._id);
      added.push(`file:${entry.fileName}`);
      enqueueDocument(String(vault._id), fileId);
    }

    // Link user's avatars to this vault
    await Avatar.updateMany(
      { userId, memoryVaultId: { $exists: false } },
      { $set: { memoryVaultId: vault._id } },
    );

    const freshVault = await MemoryVault.findById(vault._id).lean();
    return res.status(201).json({
      success: true,
      message: file
        ? "Document uploaded. Processing has started."
        : "Memory saved.",
      data: { vault: toClientVault(freshVault), added, fileId },
    });
  };

  /** GET /files/:fileId/content — authenticated file stream for the viewer */
  getFileContent = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const vault = await MemoryVault.findOne({ userId });
    const file = vault?.files.find((f) => String(f._id) === req.params.fileId);
    if (!file || !file.localPath) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    // Path traversal guard: the file must live inside the uploads directory.
    const resolved = path.resolve(file.localPath);
    if (!resolved.startsWith(path.resolve(UPLOAD_BASE))) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (!fs.existsSync(resolved)) {
      return res
        .status(404)
        .json({ success: false, message: "File missing on server" });
    }

    const type = String(file.fileType).toLowerCase();
    res.setHeader(
      "Content-Type",
      CONTENT_TYPES[type] || "application/octet-stream",
    );
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.fileName)}"`,
    );
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    fs.createReadStream(resolved).pipe(res);
  };

  /** GET /files/:fileId/text — extracted (indexed) text, e.g. for DOCX/OCR preview */
  getFileText = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const vault = await MemoryVault.findOne({ userId }, { files: 1 }).lean();
    const file = (vault?.files as any[])?.find(
      (f) => String(f._id) === req.params.fileId,
    );
    if (!file) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }
    const chunks = await MemoryChunk.find(
      { userId, fileId: file._id },
      { text: 1, chunkIndex: 1 },
    )
      .sort({ chunkIndex: 1, _id: 1 })
      .lean();
    return res.status(200).json({
      success: true,
      data: {
        fileId: String(file._id),
        ocrUsed: !!file.ocrUsed,
        text: chunks.map((c: any) => c.text).join("\n"),
      },
    });
  };

  /** POST /files/:fileId/retry — re-run processing for a failed document */
  retryFile = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const vault = await MemoryVault.findOne({ userId });
    const file = vault?.files.find((f) => String(f._id) === req.params.fileId);
    if (!vault || !file) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }

    await MemoryVault.updateOne(
      { _id: vault._id, "files._id": file._id },
      {
        $set: {
          "files.$.status": "processing",
          "files.$.indexError": null,
          "files.$.isIndexed": false,
        },
      },
    );
    enqueueDocument(String(vault._id), String(file._id));
    return res
      .status(202)
      .json({ success: true, message: "Processing restarted" });
  };

  /** PATCH /files/:fileId — change category (e.g. move an old upload to Clinical) */
  updateFile = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const category = req.body?.category;
    if (category !== "clinical" && category !== "personal") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid category" });
    }
    const $set: Record<string, unknown> = { "files.$.category": category };
    // Clinical documents are user-wide (not tied to one avatar).
    if (category === "clinical") $set["files.$.avatarId"] = null;

    const r = await MemoryVault.updateOne(
      { userId, "files._id": req.params.fileId },
      { $set },
    );
    if (!r.matchedCount) {
      return res
        .status(404)
        .json({ success: false, message: "Document not found" });
    }
    if (category === "clinical") {
      await MemoryChunk.updateMany(
        { userId, fileId: req.params.fileId },
        { $set: { avatarId: null } },
      );
    }
    return res.status(200).json({ success: true, message: "Document updated" });
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

      await MemoryChunk.deleteMany({ fileId: file._id, userId });

      vault.files.splice(fileIndex, 1);
      await vault.save();

      return res
        .status(200)
        .json({ success: true, message: "Document deleted" });
    } catch (error) {
      console.error("[Memory Delete Error]", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to delete document" });
    }
  };

  /** GET /rag-query?q=... (debug / testing) */
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

    return res.status(200).json({ success: true, data: { query: q, chunks } });
  };

  /** GET /vault */
  getVault = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    if (!userId) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    const vault = await getOrCreateVault(userId);
    return res
      .status(200)
      .json({ success: true, data: { vault: toClientVault(vault) } });
  };
}

export default new MemoryController();
