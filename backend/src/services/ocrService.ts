// ═══════════════════════════════════════════════════════════════════════
// services/ocrService.ts — self-hosted OCR (Tesseract) for scanned documents
// ═══════════════════════════════════════════════════════════════════════
//
// No third-party SaaS: everything runs on the ArkLife server.
//
// Server requirements (Ubuntu/Debian):
//   sudo apt-get install -y tesseract-ocr tesseract-ocr-ita tesseract-ocr-eng poppler-utils
//
//   - pdftoppm  (poppler-utils) renders PDF pages to PNG images
//   - tesseract                 recognises the text in each image
//
// Configuration (optional env vars):
//   OCR_LANGS        tesseract languages, default "ita+eng"
//   OCR_DPI          render resolution, default 200
//   OCR_MAX_PAGES    max pages OCR'd per document, default 40
//   TESSERACT_PATH   path to the tesseract binary, default "tesseract"
//   PDFTOPPM_PATH    path to the pdftoppm binary, default "pdftoppm"

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const OCR_LANGS = process.env.OCR_LANGS || "ita+eng";
const OCR_DPI = Number(process.env.OCR_DPI) || 200;
const OCR_MAX_PAGES = Number(process.env.OCR_MAX_PAGES) || 40;
const TESSERACT = process.env.TESSERACT_PATH || "tesseract";
const PDFTOPPM = process.env.PDFTOPPM_PATH || "pdftoppm";

/** Minimum meaningful characters per page before we consider a PDF "text-based". */
const MIN_CHARS_PER_PAGE = 40;

function run(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      cmd,
      args,
      { timeout: timeoutMs, maxBuffer: 32 * 1024 * 1024, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) {
          const e: any = err;
          if (e.code === "ENOENT") {
            return reject(
              new Error(
                `OCR tool "${cmd}" is not installed on the server. Install tesseract-ocr and poppler-utils.`,
              ),
            );
          }
          return reject(
            new Error(`${path.basename(cmd)} failed: ${stderr || err.message}`),
          );
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) });
      },
    );
  });
}

/**
 * Decide whether text extracted from a PDF is usable, or whether the PDF is
 * (mostly) a scan and needs OCR.
 */
export function hasUsableText(text: string, pageCount = 1): boolean {
  const meaningful = (text || "").replace(/[^\p{L}\p{N}]/gu, "").length;
  return meaningful >= MIN_CHARS_PER_PAGE * Math.max(1, Math.min(pageCount, 5));
}

/** True when both OCR binaries respond. Used for health checks / logs. */
export async function isOcrAvailable(): Promise<boolean> {
  try {
    await run(TESSERACT, ["--version"], 10_000);
    await run(PDFTOPPM, ["-v"], 10_000);
    return true;
  } catch {
    return false;
  }
}

async function ocrImage(imagePath: string): Promise<string> {
  // "stdout" makes tesseract print the recognised text instead of writing a file.
  // --psm 3 = fully automatic page segmentation (default, good for reports).
  const { stdout } = await run(
    TESSERACT,
    [imagePath, "stdout", "-l", OCR_LANGS, "--psm", "3"],
    120_000,
  );
  return stdout.trim();
}

/** OCR a single image file (jpg/png). */
export async function ocrImageFile(
  imagePath: string,
): Promise<{ text: string; pageCount: number }> {
  return { text: await ocrImage(imagePath), pageCount: 1 };
}

/**
 * OCR a (scanned) PDF: render each page to PNG, then run tesseract per page.
 * Pages are processed one at a time to keep memory usage low.
 */
export async function ocrPdf(
  pdfPath: string,
  onProgress?: (page: number, total: number) => void,
): Promise<{ text: string; pageCount: number; truncated: boolean }> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), "arklife-ocr-"));
  try {
    await run(
      PDFTOPPM,
      [
        "-r",
        String(OCR_DPI),
        "-gray",
        "-png",
        "-f",
        "1",
        "-l",
        String(OCR_MAX_PAGES),
        pdfPath,
        path.join(workDir, "page"),
      ],
      5 * 60_000,
    );

    const pages = (await fs.readdir(workDir))
      .filter((f) => f.endsWith(".png"))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    if (pages.length === 0) {
      throw new Error("OCR: the PDF could not be rendered to images");
    }

    const parts: string[] = [];
    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i + 1, pages.length);
      const text = await ocrImage(path.join(workDir, pages[i]));
      parts.push(`[Page ${i + 1}]\n${text}`);
      // Free disk space early.
      await fs.rm(path.join(workDir, pages[i]), { force: true });
    }

    return {
      text: parts.join("\n\n").trim(),
      pageCount: pages.length,
      truncated: pages.length >= OCR_MAX_PAGES,
    };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
