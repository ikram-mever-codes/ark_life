"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.avatarUpload = exports.AVATAR_UPLOAD_BASE = void 0;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const multer_1 = __importDefault(require("multer"));
// Base directory for all avatar-specific assets
exports.AVATAR_UPLOAD_BASE = node_path_1.default.resolve(__dirname, "../../uploads/avatars");
if (!node_fs_1.default.existsSync(exports.AVATAR_UPLOAD_BASE)) {
    node_fs_1.default.mkdirSync(exports.AVATAR_UPLOAD_BASE, { recursive: true });
}
/** Helper to ensure subdirectory per avatarId exists */
function getAvatarDir(avatarId) {
    const dir = node_path_1.default.join(exports.AVATAR_UPLOAD_BASE, avatarId);
    if (!node_fs_1.default.existsSync(dir))
        node_fs_1.default.mkdirSync(dir, { recursive: true });
    return dir;
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const avatarId = req.params?.id;
        if (!avatarId)
            return cb(new Error("Avatar id required for upload"), "");
        cb(null, getAvatarDir(avatarId));
    },
    filename: (req, file, cb) => {
        const field = file.fieldname;
        // Default extensions based on asset type
        const ext = node_path_1.default.extname(file.originalname || "") ||
            (field === "voiceSample" ? ".wav" : ".jpg");
        const base = node_path_1.default.basename(file.originalname || "file", node_path_1.default.extname(file.originalname || "file"));
        // Clean filename for OS compatibility
        const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
        cb(null, `${field}_${safeBase}_${Date.now()}${ext}`);
    },
});
function fileFilter(req, file, cb) {
    const isImage = file.mimetype.startsWith("image/");
    const isAudio = [
        "audio/mpeg",
        "audio/wav",
        "audio/wave",
        "audio/x-wav",
        "audio/mp3",
    ].includes(file.mimetype);
    if (!isImage && !isAudio) {
        return cb(new Error("Invalid file type. Only images and audio (MP3/WAV) are accepted."));
    }
    cb(null, true);
}
exports.avatarUpload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
});
//# sourceMappingURL=multerAvatar.js.map