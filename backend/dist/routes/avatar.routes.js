"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const avatar_controller_1 = __importDefault(require("../controllers/avatar.controller"));
const auth_1 = require("../middleware/auth");
const multerAvatar_1 = require("../config/multerAvatar");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// --- Core CRUD ---
router.post("/", avatar_controller_1.default.create);
router.get("/", avatar_controller_1.default.list);
router.get("/:id", avatar_controller_1.default.getOne);
router.patch("/:id", avatar_controller_1.default.update);
router.delete("/:id", avatar_controller_1.default.remove);
// --- Asset Management ---
router.post("/:id/upload", multerAvatar_1.avatarUpload.fields([
    { name: "photo", maxCount: 21 },
    { name: "voiceSample", maxCount: 10 },
]), avatar_controller_1.default.upload);
// New Routes for Asset Control
router.post("/:id/remove-asset", avatar_controller_1.default.removeAsset);
router.post("/:id/set-hero", avatar_controller_1.default.setHeroImage);
// --- Neural Synthesis ---
router.post("/:id/clone-voice", avatar_controller_1.default.cloneVoice);
router.post("/test-speech", avatar_controller_1.default.testSpeech);
exports.default = router;
//# sourceMappingURL=avatar.routes.js.map