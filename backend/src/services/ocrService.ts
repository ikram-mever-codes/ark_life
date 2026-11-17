// ═══════════════════════════════════════════════════════════════════════
// services/ocrService.ts — self-hosted OCR for scanned documents & photos
// ═══════════════════════════════════════════════════════════════════════
//
// Two engines, both 100% on our server (no third-party SaaS):
//
//   "cli"  System Tesseract + Poppler (fastest, best quality)
//            sudo apt-get install -y tesseract-ocr tesseract-ocr-ita \
//                 tesseract-ocr-eng poppler-utils
//   "js"   Built-in fallback: tesseract.js (WebAssembly) with bundled
//          Italian/English models, PDF pages rendered with pdfjs + canvas.
//          Works with `npm ci` only — no system packages needed.
//
// OCR_ENGINE=auto (default) uses "cli" when installed, otherwise "js", so
// OCR keeps working even if the server packages are missing.
//
// Images are cleaned up before recognition (EXIF auto-rotate, grayscale,
// contrast normalisation, upscaling of small photos) and page orientation
// is detected automatically, so phone photos of reports read correctly.
//
// Optional env vars:
//   OCR_ENGINE       auto | cli | js            (default auto)
//   OCR_LANGS        tesseract languages        (default ita+eng)
//   OCR_DPI          PDF render resolution      (default 200)
//   OCR_MAX_PAGES    max pages OCR'd per file   (default 40)
//   TESSERACT_PATH / PDFTOPPM_PATH             binary locations

import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const OCR_LANGS = process.env.OCR_LANGS || "ita+eng";
const OCR_DPI = Number(process.env.OCR_DPI) || 200;
export const OCR_MAX_PAGES = Number(process.env.OCR_MAX_PAGES) || 40;
const TESSERACT = process.env.TESSERACT_PATH || "tesseract";
const PDFTOPPM = process.env.PDFTOPPM_PATH || "pdftoppm";
const ENGINE_PREF = (process.env.OCR_ENGINE || "auto").toLowerCase();

/** Minimum meaningful characters before a page counts as "has text". */
export const MIN_CHARS_PER_PAGE = 40;

export type OcrEngine = "cli" | "js";

// ─── helpers ───────────────────────────────────────────────────────────
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
            return reject(new Error(`OCR tool "${cmd}" is not installed`));
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

export const meaningfulChars = (text: string) =>
  (text || "").replace(/[^\p{L}\p{N}]/gu, "").length;

/** Does a single page contain real text (vs. a scanned image)? */
export const pageHasText = (text: string) =>
  meaningfulChars(text) >= MIN_CHARS_PER_PAGE;

/** Whole-document check, kept for callers that only have the full text. */
export function hasUsableText(text: string, pageCount = 1): boolean {
  return (
    meaningfulChars(text) >=
    MIN_CHARS_PER_PAGE * Math.max(1, Math.min(pageCount, 5))
  );
}

/** Clean an image for OCR: EXIF rotate, grayscale, normalise, upscale. */
async function prepareImage(input: Buffer | string): Promise<Buffer> {
  const img = sharp(input, { failOn: "none" }).rotate(); // EXIF orientation
  const meta = await img.metadata();
  // EXIF orientations 5–8 swap width/height after auto-rotation.
  const width =
    (meta.orientation && meta.orientation >= 5 ? meta.height : meta.width) || 0;
  // Min→max contrast stretch. (The default 1st–99th percentile stretch
  // wipes out text on sparse, mostly-white pages, where text is <1% of
  // pixels — exactly what lab reports look like.)
  let pipeline = img.grayscale().normalise({ lower: 0, upper: 100 });
  // Small phone photos / low-res scans read much better when upscaled.
  if (width && width < 1600) {
    pipeline = pipeline.resize({ width: 2000, kernel: "lanczos3" });
  }
  return pipeline.sharpen().png().toBuffer();
}

// ─── engine detection ──────────────────────────────────────────────────
let cliStatus: Promise<{ ok: boolean; osd: boolean }> | null = null;

function checkCli() {
  if (!cliStatus) {
    cliStatus = (async () => {
      try {
        await run(PDFTOPPM, ["-v"], 10_000);
        const { stdout, stderr } = await run(TESSERACT, ["--list-langs"], 10_000);
        const langs = `${stdout}\n${stderr}`;
        const needed = OCR_LANGS.split("+");
        const ok = needed.every((l) => new RegExp(`^${l}$`, "m").test(langs));
        if (!ok) {
          console.warn(
            `[OCR] System tesseract is missing languages (${OCR_LANGS}); using built-in engine.`,
          );
        }
        return { ok, osd: /^osd$/m.test(langs) };
      } catch {
        return { ok: false, osd: false };
      }
    })();
  }
  return cliStatus;
}

export async function getOcrEngine(): Promise<OcrEngine> {
  if (ENGINE_PREF === "js") return "js";
  const cli = await checkCli();
  if (ENGINE_PREF === "cli" && !cli.ok) {
    throw new Error(
      "OCR_ENGINE=cli but tesseract/poppler are not installed on the server.",
    );
  }
  return cli.ok ? "cli" : "js";
}

/** True when some OCR engine is usable (always true with the JS fallback). */
export async function isOcrAvailable(): Promise<boolean> {
  try {
    await getOcrEngine();
    return true;
  } catch {
    return false;
  }
}

// ─── JS engine (tesseract.js) ──────────────────────────────────────────
let jsWorker: Promise<any> | null = null;

/** Bundled language models → one folder tesseract.js can read. */
function prepareLangDir(): string {
  const dir = path.join(os.tmpdir(), "arklife-tessdata");
  fsSync.mkdirSync(dir, { recursive: true });
  for (const lang of OCR_LANGS.split("+")) {
    const target = path.join(dir, `${lang}.traineddata.gz`);
    if (fsSync.existsSync(target)) continue;
    const pkgDir = path.dirname(
      require.resolve(`@tesseract.js-data/${lang}/package.json`),
    );
    const src = path.join(pkgDir, "4.0.0_best_int", `${lang}.traineddata.gz`);
    fsSync.copyFileSync(src, target);
  }
  return dir;
}

function getJsWorker() {
  if (!jsWorker) {
    jsWorker = (async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { createWorker } = require("tesseract.js");
      const langPath = prepareLangDir();
      const worker = await createWorker(OCR_LANGS.split("+"), 1, {
        langPath,
        cachePath: langPath,
        gzip: true,
        logger: () => {},
        // Optional dictionary files (special-words, user-words…) are not
        // bundled; tesseract.js reports them as errors but works fine.
        errorHandler: (e: unknown) => {
          if (!/special-words|user-words|user-patterns/.test(String(e))) {
            console.error("[OCR js]", e);
          }
        },
      });
      console.log("[OCR] Built-in OCR engine ready (tesseract.js)");
      return worker;
    })().catch((e) => {
      jsWorker = null; // allow a later retry
      throw e;
    });
  }
  return jsWorker;
}

// ─── recognise one image ───────────────────────────────────────────────
/** How "readable" OCR output is: count of real-looking words. */
function readability(text: string): { words: number; ratio: number } {
  const tokens = (text || "").split(/\s+/).filter(Boolean);
  const words = tokens.filter(
    (t) => /\p{L}{3,}/u.test(t) && /[aeiouàèéìòùy]/i.test(t),
  ).length;
  return { words, ratio: tokens.length ? words / tokens.length : 0 };
}
// Lab tables are mostly numbers/units, so a low word ratio alone is normal;
// enough real words is the main signal.
const looksReadable = (r: { words: number; ratio: number }) =>
  r.words >= 8 || (r.words >= 4 && r.ratio >= 0.4);

/**
 * Recognise an image; if the result looks like garbage (page scanned or
 * photographed sideways / upside down), retry at 90°, 270° and 180° and
 * keep the most readable result.
 */
async function ocrPreparedPng(png: Buffer, engine: OcrEngine): Promise<string> {
  const first = await recognizePng(png, engine);
  let best = { text: first, score: readability(first) };
  if (looksReadable(best.score)) return first;

  for (const angle of [90, 270, 180]) {
    const rotated = await sharp(png).rotate(angle).png().toBuffer();
    const text = await recognizePng(rotated, engine);
    const score = readability(text);
    if (score.words > best.score.words) best = { text, score };
    if (looksReadable(score)) break;
  }
  return best.text;
}

async function recognizePng(png: Buffer, engine: OcrEngine): Promise<string> {
  if (engine === "js") {
    const worker = await getJsWorker();
    const { data } = await worker.recognize(png, { rotateAuto: true });
    return (data?.text || "").trim();
  }

  const tmp = path.join(
    os.tmpdir(),
    `arklife-ocr-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  );
  await fs.writeFile(tmp, png);
  try {
    // psm 3 = fully automatic layout. Tesseract's own orientation detection
    // (psm 1/OSD) mis-rotates sparse lab tables, so orientation is handled
    // by ocrPreparedPng's readability check instead (same for both engines).
    const { stdout } = await run(
      TESSERACT,
      [tmp, "stdout", "-l", OCR_LANGS, "--psm", "3"],
      180_000,
    );
    return stdout.trim();
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => {});
  }
}

/** OCR a single image file (jpg/png), e.g. a phone photo of a report. */
export async function ocrImageFile(
  imagePath: string,
): Promise<{ text: string; pageCount: number; engine: OcrEngine }> {
  const engine = await getOcrEngine();
  let png: Buffer;
  try {
    png = await prepareImage(imagePath);
  } catch {
    throw new Error(
      "This image format could not be read. Please upload a JPG or PNG photo.",
    );
  }
  return { text: await ocrPreparedPng(png, engine), pageCount: 1, engine };
}

// ─── PDF page rendering ────────────────────────────────────────────────
async function renderPdfPageCli(pdfPath: string, page: number): Promise<Buffer> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "arklife-pdf-"));
  try {
    await run(
      PDFTOPPM,
      [
        "-r", String(OCR_DPI), "-gray", "-png",
        "-f", String(page), "-l", String(page), "-singlefile",
        pdfPath, path.join(dir, "page"),
      ],
      120_000,
    );
    return await fs.readFile(path.join(dir, "page.png"));
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

let pdfjsMod: Promise<any> | null = null;
function loadPdfjs() {
  if (!pdfjsMod) {
    const dynamicImport = new Function("m", "return import(m)");
    pdfjsMod = dynamicImport("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsMod!;
}

/** Render selected PDF pages to PNG with pdfjs + @napi-rs/canvas. */
async function* renderPdfPagesJs(
  pdfPath: string,
  pages: number[],
): AsyncGenerator<{ page: number; png: Buffer }> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { createCanvas } = require("@napi-rs/canvas");
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const doc = await pdfjs.getDocument({
    data,
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  try {
    const scale = OCR_DPI / 72;
    for (const n of pages) {
      const page = await doc.getPage(n);
      try {
        const viewport = page.getViewport({ scale });
        const canvas = createCanvas(
          Math.ceil(viewport.width),
          Math.ceil(viewport.height),
        );
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport, canvas }).promise;
        yield { page: n, png: canvas.toBuffer("image/png") };
      } finally {
        page.cleanup();
      }
    }
  } finally {
    await doc.destroy().catch(() => {});
  }
}

/**
 * OCR specific pages of a PDF (1-based page numbers). Pages are processed
 * one at a time to keep memory low. Returns text per page.
 */
export async function ocrPdfPages(
  pdfPath: string,
  pages: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ texts: Map<number, string>; engine: OcrEngine }> {
  const engine = await getOcrEngine();
  const selected = pages.slice(0, OCR_MAX_PAGES);
  const texts = new Map<number, string>();

  if (engine === "cli") {
    for (let i = 0; i < selected.length; i++) {
      onProgress?.(i + 1, selected.length);
      const png = await prepareImage(await renderPdfPageCli(pdfPath, selected[i]));
      texts.set(selected[i], await ocrPreparedPng(png, engine));
    }
  } else {
    let i = 0;
    for await (const { page, png } of renderPdfPagesJs(pdfPath, selected)) {
      onProgress?.(++i, selected.length);
      texts.set(page, await ocrPreparedPng(await prepareImage(png), engine));
    }
  }
  return { texts, engine };
}

/** Number of pages of a PDF (used when text extraction failed entirely). */
export async function countPdfPages(pdfPath: string): Promise<number> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await fs.readFile(pdfPath));
  const doc = await pdfjs.getDocument({ data, disableWorker: true, verbosity: 0 })
    .promise;
  const n = doc.numPages;
  await doc.destroy().catch(() => {});
  return n;
}
