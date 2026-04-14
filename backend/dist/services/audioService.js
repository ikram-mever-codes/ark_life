"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateElevenLabsAudio = generateElevenLabsAudio;
const axios_1 = __importDefault(require("axios"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
async function generateElevenLabsAudio(voiceId, text) {
    const apiKey = process.env.ELEVENLABS_API_KEY?.replace(/[`'"]/g, "").trim();
    const tempPath = node_path_1.default.join(process.cwd(), "uploads/temp_audio", `audio_${Date.now()}.wav`);
    const response = await axios_1.default.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, { text, model_id: "eleven_monolingual_v1" }, { headers: { "xi-api-key": apiKey }, responseType: "stream" });
    const writer = node_fs_1.default.createWriteStream(tempPath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on("finish", () => resolve(tempPath));
        writer.on("error", reject);
    });
}
//# sourceMappingURL=audioService.js.map