"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractTextFromFile = extractTextFromFile;
exports.chunkText = chunkText;
// services/textExtractionService.ts – extract raw text from PDF, DOCX, TXT, MD, JSON
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const pdf_parse_1 = require("pdf-parse");
const mammoth_1 = __importDefault(require("mammoth"));
const TEXT_EXTENSIONS = new Set(["txt", "md", "json", "pdf", "docx"]);
const AUDIO_EXTENSIONS = new Set(["mp3", "wav"]);
async function extractTextFromFile(filePath, fileType) {
    const ext = (fileType || node_path_1.default.extname(filePath).slice(1)).toLowerCase();
    if (!TEXT_EXTENSIONS.has(ext) && !AUDIO_EXTENSIONS.has(ext)) {
        return { ok: false, error: `Unsupported type for text extraction: ${ext}` };
    }
    if (AUDIO_EXTENSIONS.has(ext)) {
        return {
            ok: false,
            error: "Audio (mp3/wav) must be transcribed with Whisper first. Not implemented in this MVP.",
        };
    }
    try {
        const buffer = await promises_1.default.readFile(filePath);
        if (ext === "pdf") {
            const parser = new pdf_parse_1.PDFParse({ data: new Uint8Array(buffer) });
            try {
                const result = await parser.getText();
                return { ok: true, text: (result?.text || "").trim() };
            }
            finally {
                await parser.destroy();
            }
        }
        if (ext === "docx") {
            const result = await mammoth_1.default.extractRawText({ buffer });
            return { ok: true, text: (result?.value || "").trim() };
        }
        if (ext === "txt" || ext === "md") {
            const text = buffer.toString("utf-8");
            return { ok: true, text: text.trim() };
        }
        if (ext === "json") {
            const text = buffer.toString("utf-8");
            const parsed = JSON.parse(text);
            const stringified = typeof parsed === "string" ? parsed : JSON.stringify(parsed);
            return { ok: true, text: stringified.trim() };
        }
        return { ok: false, error: `Unhandled type: ${ext}` };
    }
    catch (err) {
        return { ok: false, error: err?.message || "Failed to extract text" };
    }
}
/** Split text into chunks (e.g. for embedding). Simple sentence/paragraph boundary split. */
function chunkText(text, maxChunkSize = 1000, overlap = 100) {
    if (!text || text.length <= maxChunkSize)
        return text ? [text] : [];
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        let end = Math.min(start + maxChunkSize, text.length);
        if (end < text.length) {
            const slice = text.slice(start, end);
            const lastBreak = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf(" "));
            if (lastBreak > maxChunkSize / 2)
                end = start + lastBreak + 1;
        }
        chunks.push(text.slice(start, end).trim());
        start = end - overlap;
        if (start >= text.length)
            break;
    }
    return chunks.filter((c) => c.length > 0);
}
//# sourceMappingURL=textExtractionService.js.map