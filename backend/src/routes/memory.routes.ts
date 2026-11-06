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
  (err: any, req: any, res: any, next: any) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  },
  memoryController.addMemory,
);
router.get("/rag-query", authenticate, memoryController.ragQuery);
router.get("/vault", authenticate, memoryController.getVault);
router.get(
  "/files/:fileId/content",
  authenticate,
  memoryController.getFileContent,
);
router.get("/files/:fileId/text", authenticate, memoryController.getFileText);
router.post("/files/:fileId/retry", authenticate, memoryController.retryFile);
router.patch("/files/:fileId", authenticate, memoryController.updateFile);
router.delete("/files/:fileId", authenticate, memoryController.deleteMemory);

export default router;
