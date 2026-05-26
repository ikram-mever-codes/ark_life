import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { AVATAR_UPLOAD_BASE } from "../config/multerAvatar";

/**
 * Generates a seamless looping "idle" video from a still image using ffmpeg.
 *
 * The filter applies a subtle breathing effect: a slow zoom-in followed by a
 * zoom-out back to the starting frame, so the video loops without a visible cut.
 * No D-ID / HeyGen credits required — fully local synthesis.
 *
 * @param heroImageSource  Local path OR remote URL (e.g. Cloudinary) of the hero image
 * @param avatarId         Avatar document id, used to place output under its folder
 * @returns                Public URL path of the generated MP4 (e.g. /uploads/avatars/{id}/master.mp4)
 */
export async function generateMasterLoop(
  heroImageSource: string,
  avatarId: string,
): Promise<string> {
  const avatarDir = path.join(AVATAR_UPLOAD_BASE, avatarId);
  if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
  }

  // Step 1: Resolve the hero image to a local file path.
  // If it's a remote URL (Cloudinary), we download it into the avatar's folder.
  let localImagePath: string;

  if (heroImageSource.startsWith("http")) {
    localImagePath = path.join(avatarDir, "hero_source.jpg");
    const response = await axios.get(heroImageSource, {
      responseType: "arraybuffer",
    });
    fs.writeFileSync(localImagePath, Buffer.from(response.data));
  } else {
    localImagePath = path.resolve(heroImageSource);
    if (!fs.existsSync(localImagePath)) {
      throw new Error(`Hero image not found at: ${localImagePath}`);
    }
  }

  const outputPath = path.join(avatarDir, "master.mp4");

  // Step 2: Build the ffmpeg "breathing" filter.
  //
  // zoompan runs for `d` frames. At 30 fps × 6 seconds = 180 frames total.
  // We zoom from 1.00 → ~1.04 in the first half, then back to 1.00 in the
  // second half using a triangular wave. This makes frame 0 == frame 179,
  // which means <video loop> plays without a visible jump.
  //
  // Key things happening in the filter chain:
  //   - scale=1280:-2  → upscale base image so zoompan has pixels to work with
  //     (prevents pixelation). -2 keeps aspect ratio, divisible by 2.
  //   - zoompan with a triangular zoom expression (in/out symmetric).
  //   - s=720x720      → final canvas size; change if you want different output.
  //   - format=yuv420p → required for broad browser compatibility.
  const totalFrames = 180; // 6 seconds @ 30 fps
  const halfFrames = totalFrames / 2;
  const maxZoom = 1.04;

  // Triangular zoom: rises to maxZoom at the midpoint, falls back to 1.0 at the end.
  // `on` is the current output frame number (0-indexed).
  const zoomExpr = `if(lte(on,${halfFrames}),1+${maxZoom - 1}*(on/${halfFrames}),1+${maxZoom - 1}*((${totalFrames}-on)/${halfFrames}))`;

  const filterComplex = [
    `scale=1280:-2`,
    `zoompan=z='${zoomExpr}':d=${totalFrames}:s=720x720:fps=30`,
    `format=yuv420p`,
  ].join(",");

  // Step 3: Run ffmpeg.
  const args = [
    "-y", // overwrite
    "-loop",
    "1",
    "-i",
    localImagePath,
    "-vf",
    filterComplex,
    "-t",
    "6", // 6 second output
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-preset",
    "veryfast",
    "-movflags",
    "+faststart", // lets the <video> tag start playback before full download
    outputPath,
  ];

  await runFfmpeg(args);

  // Step 4: Verify output exists and has non-zero size.
  if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
    throw new Error("Master loop generation produced no output file");
  }

  // Step 5: Return the public URL path.
  // AVATAR_UPLOAD_BASE is something like `uploads/avatars` on disk,
  // exposed at `/uploads/avatars` via express.static.
  const publicUrl = `/${path.posix.join(
    AVATAR_UPLOAD_BASE.replace(/\\/g, "/").replace(/^\/+/, ""),
    avatarId,
    "master.mp4",
  )}`;

  return publicUrl;
}

/**
 * Thin wrapper around `spawn` that rejects on non-zero exit codes
 * and surfaces ffmpeg stderr in the error message (invaluable for debugging).
 */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", args);

    let stderr = "";
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    proc.on("error", (err) => {
      reject(new Error(`ffmpeg spawn failed: ${err.message}`));
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `ffmpeg exited with code ${code}. stderr tail:\n${stderr.slice(-500)}`,
          ),
        );
      }
    });
  });
}
