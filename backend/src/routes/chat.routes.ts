import { Router } from "express";
import chatController from "../controllers/chat.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.post("/", authenticate, chatController.interact);

router.get("/history/:avatarId", authenticate, chatController.getHistory);

export default router;
