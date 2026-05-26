import { spawn } from "child_process";
import path from "path";
import fs from "fs";

const SADTALKER_PATH = "D:/Production Projects/SadTalker"; // Update this to your path
const CONDA_ENV_NAME = "sadtalker";

export const generateAvatarVideo = (
  sourceImage: string,
  drivenAudio: string,
  outputDir: string,
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const resultFilename = `result_${Date.now()}.mp4`;
    const outputPath = path.join(outputDir, resultFilename);

    console.log("[SadTalker] Starting Synthesis...");

    const child = spawn("conda", [
      "run",
      "-n",
      CONDA_ENV_NAME,
      "python",
      path.join(SADTALKER_PATH, "inference.py"),
      "--driven_audio",
      drivenAudio,
      "--source_image",
      sourceImage,
      "--result_dir",
      outputDir,
      "--still",
      "--preprocess",
      "full",
      "--enhancer",
      "gfpgan",
    ]);

    child.stdout.on("data", (data) => {
      console.log(`[SadTalker Log]: ${data}`);
    });

    child.stderr.on("data", (data) => {
      // Note: Some AI libraries print progress to stderr
      console.error(`[SadTalker Error/Warning]: ${data}`);
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log("[SadTalker] Synthesis Complete.");
        // We look for the generated file in the result directory
        resolve(outputPath);
      } else {
        reject(new Error(`SadTalker process exited with code ${code}`));
      }
    });
  });
};
