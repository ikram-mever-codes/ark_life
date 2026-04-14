// config/multer.ts – secure file upload for Memory Vault (protected local directory)
import path from "node:path";
import fs from "node:fs";
import multer from "multer";

const UPLOAD_BASE = path.resolve(__dirname, "../../uploads/memory");

// Allowed MIME types for MVP (txt, md, pdf, docx, json, mp3, wav)
const ALLOWED_MIMES: Record<string, string> = {
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

const ALLOWED_EXT = new Set([
  "txt",
  "md",
  "pdf",
  "docx",
  "json",
  "mp3",
  "wav",
]);

export function getMemoryUploadDir(userId: string): string {
  const dir = path.join(UPLOAD_BASE, userId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = (req as any).user?.id ?? (req as any).user?._id?.toString();
    if (!userId) {
      return cb(new Error("User not authenticated"), "");
    }
    const dir = getMemoryUploadDir(userId);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext =
      ALLOWED_MIMES[file.mimetype] ||
      path.extname(file.originalname || "").slice(1).toLowerCase() ||
      "bin";
    const base = path.basename(file.originalname || "file", path.extname(file.originalname || "file"));
    const safe = base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
    cb(null, `${safe}_${Date.now()}.${ext}`);
  },
});

function fileFilter(
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const ext =
    ALLOWED_MIMES[file.mimetype] ||
    path.extname(file.originalname || "").slice(1).toLowerCase();
  if (!ext || !ALLOWED_EXT.has(ext)) {
    return cb(
      new Error(
        `Invalid file type. Allowed: ${[...ALLOWED_EXT].join(", ")}`,
      ) as any,
    );
  }
  cb(null, true);
}

export const memoryUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
});

export { UPLOAD_BASE, ALLOWED_EXT, ALLOWED_MIMES };
