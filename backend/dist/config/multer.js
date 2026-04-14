"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALLOWED_MIMES = exports.ALLOWED_EXT = exports.UPLOAD_BASE = exports.memoryUpload = void 0;
exports.getMemoryUploadDir = getMemoryUploadDir;
// config/multer.ts – secure file upload for Memory Vault (protected local directory)
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const multer_1 = __importDefault(require("multer"));
const UPLOAD_BASE = node_path_1.default.resolve(__dirname, "../../uploads/memory");
exports.UPLOAD_BASE = UPLOAD_BASE;
// Allowed MIME types for MVP (txt, md, pdf, docx, json, mp3, wav)
const ALLOWED_MIMES = {
    "text/plain": "txt",
    "text/markdown": "md",
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/json": "json",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "audio/x-wav": "wav",
};
exports.ALLOWED_MIMES = ALLOWED_MIMES;
const ALLOWED_EXT = new Set([
    "txt",
    "md",
    "pdf",
    "docx",
    "json",
    "mp3",
    "wav",
]);
exports.ALLOWED_EXT = ALLOWED_EXT;
function getMemoryUploadDir(userId) {
    const dir = node_path_1.default.join(UPLOAD_BASE, userId);
    if (!node_fs_1.default.existsSync(dir)) {
        node_fs_1.default.mkdirSync(dir, { recursive: true });
    }
    return dir;
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const userId = req.user?.id ?? req.user?._id?.toString();
        if (!userId) {
            return cb(new Error("User not authenticated"), "");
        }
        const dir = getMemoryUploadDir(userId);
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = ALLOWED_MIMES[file.mimetype] ||
            node_path_1.default.extname(file.originalname || "").slice(1).toLowerCase() ||
            "bin";
        const base = node_path_1.default.basename(file.originalname || "file", node_path_1.default.extname(file.originalname || "file"));
        const safe = base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
        cb(null, `${safe}_${Date.now()}.${ext}`);
    },
});
function fileFilter(req, file, cb) {
    const ext = ALLOWED_MIMES[file.mimetype] ||
        node_path_1.default.extname(file.originalname || "").slice(1).toLowerCase();
    if (!ext || !ALLOWED_EXT.has(ext)) {
        return cb(new Error(`Invalid file type. Allowed: ${[...ALLOWED_EXT].join(", ")}`));
    }
    cb(null, true);
}
exports.memoryUpload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
});
//# sourceMappingURL=multer.js.map