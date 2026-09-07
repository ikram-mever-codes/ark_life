import axios from "axios";
import dotenv from "dotenv";

dotenv.config();
const DID_API_KEY = process.env.DID_API_KEY;
const DID_BASE_URL = "https://api.d-id.com";

if (!DID_API_KEY) {
  console.warn("[dIdService] DID_API_KEY is not set — D-ID calls will fail.");
}

// Isolated instance: does NOT inherit any axios.defaults mutations made
// elsewhere in the process, and explicitly disables proxy usage so an
// HTTP_PROXY/HTTPS_PROXY env var can't silently redirect this traffic.
const didClient = axios.create({
  baseURL: DID_BASE_URL,
  proxy: false,
  headers: { "Content-Type": "application/json" },
});

const getAuthHeaders = () => ({
  Authorization: `Basic ${DID_API_KEY}`,
});
import https from "node:https";

function didRequest(
  method: "GET" | "POST",
  path: string,
  body?: object,
): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = https.request(
      {
        hostname: "api.d-id.com",
        path,
        method,
        headers: {
          Authorization: `Basic ${DID_API_KEY}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          let parsed: any;
          try {
            parsed = JSON.parse(data);
          } catch {
            reject(
              new Error(
                `D-ID returned non-JSON (status ${res.statusCode}): ${data.slice(0, 300)}`,
              ),
            );
            return;
          }
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `D-ID request failed (status ${res.statusCode}): ${JSON.stringify(parsed)}`,
              ),
            );
            return;
          }
          resolve(parsed);
        });
      },
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

export const createDIDTalk = async (payload: {
  sourceUrl: string;
  audioUrl?: string;
  scriptText?: string;
  provider?: { type: string; voice_id: string };
}): Promise<string> => {
  const { sourceUrl, audioUrl, scriptText, provider } = payload;

  const body: any = {
    source_url: sourceUrl,
    config: { fluent: true, pad_audio: "0.0" },
  };

  if (audioUrl) {
    body.script = { type: "audio", audio_url: audioUrl };
  } else if (scriptText) {
    body.script = {
      type: "text",
      input: scriptText,
      provider: { type: "microsoft", voice_id: "en-US-JennyNeural" },
    };
  } else {
    throw new Error("Either audioUrl or scriptText must be provided.");
  }

  const result = await didRequest("POST", "/talks", body);
  return result.id;
};

export const checkDIDTalkStatus = async (
  talkId: string,
): Promise<{ status: string; result_url?: string }> => {
  const result = await didRequest("GET", `/talks/${talkId}`);
  return { status: result.status, result_url: result.result_url };
};
