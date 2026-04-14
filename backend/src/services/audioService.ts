import axios from "axios";
import fs from "node:fs";
import path from "node:path";

export async function generateElevenLabsAudio(
  voiceId: string,
  text: string,
): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.replace(/[`'"]/g, "").trim();
  const tempPath = path.join(
    process.cwd(),
    "uploads/temp_audio",
    `audio_${Date.now()}.wav`,
  );

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    { text, model_id: "eleven_monolingual_v1" },
    { headers: { "xi-api-key": apiKey }, responseType: "stream" },
  );

  const writer = fs.createWriteStream(tempPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", () => resolve(tempPath));
    writer.on("error", reject);
  });
}
