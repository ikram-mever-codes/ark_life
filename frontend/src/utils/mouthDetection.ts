import * as faceapi from "face-api.js";

let modelsLoaded = false;

const MODEL_URL =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@latest/model";

/**
 * Load the minimum set of face-api models needed for mouth detection.
 * Idempotent — safe to call multiple times.
 */
async function ensureModelsLoaded() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
  ]);
  modelsLoaded = true;
}

export interface MouthCoords {
  x: number; // normalized 0-1 (left edge of mouth box)
  y: number; // normalized 0-1 (top edge of mouth box)
  width: number; // normalized 0-1 (box width)
  height: number; // normalized 0-1 (box height)
}

/**
 * Detect mouth coordinates in a given image URL.
 *
 * Returns normalized (0-1) bounding box so the frontend can render
 * the mouth overlay at the correct position regardless of display size.
 *
 * Uses a padded bounding box around the 20-point mouth landmark set
 * (face-api.js landmarks 48-67). Padding accounts for mouth opening
 * movement during the animation.
 *
 * Falls back to a sensible default (lower-center of face) if no face
 * is detected — the demo still works, just with less precise anchoring.
 */
export async function detectMouthCoords(
  imageUrl: string,
): Promise<MouthCoords> {
  await ensureModelsLoaded();

  // Load image into a DOM element so face-api can process it.
  // crossOrigin is required for Cloudinary URLs to avoid canvas taint.
  const img = await loadImage(imageUrl);

  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks();

  // Fallback: no face detected → assume mouth is in lower-center of image.
  if (!detection) {
    console.warn("[MouthDetection] No face found, using fallback coords");
    return {
      x: 0.375, // 37.5% from left
      y: 0.65, // 65% down
      width: 0.25, // 25% of image width
      height: 0.08, // 8% of image height
    };
  }

  const mouth = detection.landmarks.getMouth(); // 20 points around the mouth
  const xs = mouth.map((p) => p.x);
  const ys = mouth.map((p) => p.y);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rawWidth = maxX - minX;
  const rawHeight = maxY - minY;

  // Add padding so the overlay has room to expand when "talking" without
  // clipping. 20% horizontal padding, 80% vertical padding — vertical gets
  // more because the oval grows vertically during amplitude peaks.
  const padX = rawWidth * 0.2;
  const padY = rawHeight * 0.8;

  const paddedX = Math.max(0, minX - padX);
  const paddedY = Math.max(0, minY - padY);
  const paddedW = Math.min(img.width - paddedX, rawWidth + padX * 2);
  const paddedH = Math.min(img.height - paddedY, rawHeight + padY * 2);

  // Normalize to 0-1 range
  return {
    x: paddedX / img.width,
    y: paddedY / img.height,
    width: paddedW / img.width,
    height: paddedH / img.height,
  };
}

/**
 * Promise-wrapped image loader with CORS support.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
