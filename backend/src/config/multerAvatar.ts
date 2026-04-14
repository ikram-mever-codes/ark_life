import path from "node:path";
import fs from "node:fs";
import multer from "multer";

// Base directory for all avatar-specific assets
export const AVATAR_UPLOAD_BASE = path.resolve(
  __dirname,
  "../../uploads/avatars",
);

if (!fs.existsSync(AVATAR_UPLOAD_BASE)) {
  fs.mkdirSync(AVATAR_UPLOAD_BASE, { recursive: true });
}

/** Helper to ensure subdirectory per avatarId exists */
function getAvatarDir(avatarId: string): string {
  const dir = path.join(AVATAR_UPLOAD_BASE, avatarId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const avatarId = (req as any).params?.id;
    if (!avatarId) return cb(new Error("Avatar id required for upload"), "");
    cb(null, getAvatarDir(avatarId));
  },
  filename: (req, file, cb) => {
    const field = file.fieldname;
    // Default extensions based on asset type
    const ext =
      path.extname(file.originalname || "") ||
      (field === "voiceSample" ? ".wav" : ".jpg");
    const base = path.basename(
      file.originalname || "file",
      path.extname(file.originalname || "file"),
    );

    // Clean filename for OS compatibility
    const safeBase = base.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
    cb(null, `${field}_${safeBase}_${Date.now()}${ext}`);
  },
});

function fileFilter(
  req: any,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) {
  const isImage = file.mimetype.startsWith("image/");
  const isAudio = [
    "audio/mpeg",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/mp3",
  ].includes(file.mimetype);

  if (!isImage && !isAudio) {
    return cb(
      new Error(
        "Invalid file type. Only images and audio (MP3/WAV) are accepted.",
      ) as any,
    );
  }
  cb(null, true);
}

export const avatarUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB limit
});
