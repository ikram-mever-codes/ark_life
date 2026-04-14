"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateAvatarVideo = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const SADTALKER_PATH = "D:/Production Projects/SadTalker"; // Update this to your path
const CONDA_ENV_NAME = "sadtalker";
const generateAvatarVideo = (sourceImage, drivenAudio, outputDir) => {
    return new Promise((resolve, reject) => {
        const resultFilename = `result_${Date.now()}.mp4`;
        const outputPath = path_1.default.join(outputDir, resultFilename);
        console.log("[SadTalker] Starting Synthesis...");
        const child = (0, child_process_1.spawn)("conda", [
            "run",
            "-n",
            CONDA_ENV_NAME,
            "python",
            path_1.default.join(SADTALKER_PATH, "inference.py"),
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
            }
            else {
                reject(new Error(`SadTalker process exited with code ${code}`));
            }
        });
    });
};
exports.generateAvatarVideo = generateAvatarVideo;
//# sourceMappingURL=videoService.js.map