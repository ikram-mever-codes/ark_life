// routes/memory.routes.ts
import { Router } from "express";
import memoryController from "../controllers/memory.controller";
import { authenticate } from "../middleware/auth";
import { memoryUpload } from "../config/multer";

const router = Router();

// All memory routes require auth (userId-scoped to prevent data leakage)
router.post(
  "/add-memory",
  authenticate,
  memoryUpload.single("file"),
  memoryController.addMemory,
);
router.get("/rag-query", authenticate, memoryController.ragQuery);
router.get("/vault", authenticate, memoryController.getVault);
router.delete("/files/:fileId", authenticate, memoryController.deleteMemory);

export default router;
