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

    const extFromMime: Record<string, string> = {
      "audio/webm": ".webm",
      "audio/ogg": ".ogg",
      "audio/mp4": ".m4a",
      "audio/mpeg": ".mp3",
      "audio/wav": ".wav",
      "audio/x-wav": ".wav",
      "video/webm": ".webm",
    };

    const ext =
      path.extname(file.originalname || "") ||
      extFromMime[file.mimetype] ||
      (field === "voiceSample" ? ".webm" : ".jpg");

    const base = path.basename(
      file.originalname || "file",
      path.extname(file.originalname || "file"),
    );
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
  const isAudio =
    file.mimetype.startsWith("audio/") || // covers webm, ogg, mp4, mpeg, wav, x-wav, etc.
    file.mimetype === "video/webm"; // some browsers report recorded audio-only blobs as video/webm

  if (!isImage && !isAudio) {
    return cb(
      new Error(
        "Invalid file type. Only images and audio recordings are accepted.",
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
