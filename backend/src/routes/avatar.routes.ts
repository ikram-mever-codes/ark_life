import { Router } from "express";
import avatarController from "../controllers/avatar.controller";
import { authenticate } from "../middleware/auth";
import { avatarUpload } from "../config/multerAvatar";

const router = Router();

router.get("/test-replicate", avatarController.generateTestAvatar);
// router.get("/delete", avatarController.clearAllVoices);
router.use(authenticate);

// --- Core CRUD ---
router.post("/", avatarController.create);
router.get("/", avatarController.list);
router.get("/:id", avatarController.getOne);
router.patch("/:id", avatarController.update);
router.delete("/:id", avatarController.remove);
router.post("/:id/mouth-coords", avatarController.setMouthCoords);
// --- Asset Management ---
router.post(
  "/:id/upload",
  avatarUpload.fields([
    { name: "photo", maxCount: 20 },
    { name: "voiceSample", maxCount: 10 },
  ]),
  (err: any, req: any, res: any, next: any) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next();
  },
  avatarController.upload,
);

// New Routes for Asset Control
router.post("/:id/remove-asset", avatarController.removeAsset);
router.post("/:id/set-hero", avatarController.setHeroImage);

// --- Neural Synthesis ---
router.post("/:id/clone-voice", avatarController.cloneVoice);
router.post("/test-speech", avatarController.testSpeech);

export default router;
