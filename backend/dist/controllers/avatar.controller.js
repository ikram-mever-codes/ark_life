"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AvatarController = void 0;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const axios_1 = __importDefault(require("axios"));
const cloudinary_1 = require("cloudinary");
const Avatar_1 = __importDefault(require("../models/Avatar"));
const User_1 = __importDefault(require("../models/User"));
const MemoryVault_1 = __importDefault(require("../models/MemoryVault"));
const multerAvatar_1 = require("../config/multerAvatar");
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
const VOICE_SAMPLES_REQUIRED = 1;
// Tier Definitions
const TIER_LIMITS = {
    free: 1,
    pro: 5,
    business: 20,
};
class AvatarController {
    constructor() {
        /**
         * INTERNAL: Triggers D-ID Cloud API
         */
        this.generateMasterLoop = async (avatarId) => {
            const avatar = await Avatar_1.default.findById(avatarId);
            if (!avatar || !avatar.heroImageUrl)
                return;
            try {
                const authHeader = "Basic aWtyYW1raGFuQG5leGF1cmEuY28:I3ngeqeOJmFbzCCKg__QW";
                const sourceUrl = avatar.heroImageUrl;
                const animationResponse = await axios_1.default.post(`https://api.d-id.com/animations`, {
                    source_url: sourceUrl,
                    driver_url: "bank://classics/",
                    config: { stitch: true, mute: true },
                }, {
                    headers: {
                        Authorization: authHeader,
                        "Content-Type": "application/json",
                    },
                });
                const talkId = animationResponse.data.id;
                let attempts = 0;
                const pollInterval = setInterval(async () => {
                    attempts++;
                    try {
                        const statusResponse = await axios_1.default.get(`https://api.d-id.com/animations/${talkId}`, { headers: { Authorization: authHeader } });
                        const { status, result_url } = statusResponse.data;
                        if (status === "done" && result_url) {
                            clearInterval(pollInterval);
                            const localFolder = node_path_1.default.join(multerAvatar_1.AVATAR_UPLOAD_BASE, avatarId.toString());
                            const fileName = `master_loop_${Date.now()}.mp4`;
                            const localPath = node_path_1.default.join(localFolder, fileName);
                            if (!node_fs_1.default.existsSync(localFolder))
                                node_fs_1.default.mkdirSync(localFolder, { recursive: true });
                            const videoResponse = await (0, axios_1.default)({
                                url: result_url,
                                method: "GET",
                                responseType: "stream",
                            });
                            const writer = node_fs_1.default.createWriteStream(localPath);
                            videoResponse.data.pipe(writer);
                            writer.on("finish", async () => {
                                avatar.masterVideoUrl = `avatars/${avatarId}/${fileName}`;
                                avatar.status = "ready";
                                await avatar.save();
                            });
                        }
                        else if (status === "error" || attempts > 60) {
                            avatar.status = "draft";
                            await avatar.save();
                            clearInterval(pollInterval);
                        }
                    }
                    catch (err) {
                        clearInterval(pollInterval);
                    }
                }, 4000);
            }
            catch (err) {
                avatar.status = "draft";
                await avatar.save();
            }
        };
        /** Remove an image or voice sample */
        this.removeAsset = async (req, res) => {
            const { id } = req.params;
            const { url, type } = req.body;
            const avatar = await Avatar_1.default.findOne({ _id: id, userId: req.user?._id });
            if (!avatar)
                return res
                    .status(404)
                    .json({ success: false, message: "Avatar not found" });
            if (type === "photo") {
                avatar.photoUrls = avatar.photoUrls.filter((p) => p !== url);
                if (avatar.heroImageUrl === url)
                    avatar.heroImageUrl = avatar.photoUrls[0] || null;
            }
            else {
                avatar.voiceSampleUrls = avatar.voiceSampleUrls.filter((v) => v !== url);
            }
            await avatar.save();
            return res.status(200).json({ success: true, data: { avatar } });
        };
        /** Set Hero Image */
        this.setHeroImage = async (req, res) => {
            const { id } = req.params;
            const { url } = req.body;
            const avatar = await Avatar_1.default.findOne({ _id: id, userId: req.user?._id });
            if (!avatar)
                return res
                    .status(404)
                    .json({ success: false, message: "Avatar not found" });
            try {
                const filePath = url.startsWith("http") ? url : node_path_1.default.resolve(url);
                const result = await cloudinary_1.v2.uploader.upload(filePath, {
                    folder: `arklife/avatars/${avatar._id}`,
                });
                avatar.heroImageUrl = result.secure_url;
                await avatar.save();
                return res.status(200).json({ success: true, data: { avatar } });
            }
            catch (err) {
                return res
                    .status(500)
                    .json({ success: false, message: "Cloudinary failed" });
            }
        };
        /** CREATE Avatar with Subscription Restriction */
        this.create = async (req, res) => {
            const userId = req.user?._id;
            const { name, description } = req.body;
            try {
                // 1. Fetch User Tier
                const user = await User_1.default.findById(userId);
                if (!user)
                    return res
                        .status(404)
                        .json({ success: false, message: "User not found" });
                // 2. Count existing avatars
                const avatarCount = await Avatar_1.default.countDocuments({ userId });
                // 3. Enforce Limit
                const limit = TIER_LIMITS[user.subscriptionTier] || 1;
                if (avatarCount >= limit) {
                    return res.status(403).json({
                        success: false,
                        message: `Protocol Limit Reached. ${user.subscriptionTier.toUpperCase()} tier allows max ${limit} neural nodes.`,
                    });
                }
                let vault = await MemoryVault_1.default.findOne({ userId });
                if (!vault)
                    vault = await MemoryVault_1.default.create({ userId, files: [] });
                const avatar = await Avatar_1.default.create({
                    userId,
                    name,
                    description,
                    status: "draft",
                    memoryVaultId: vault._id,
                    heroImageUrl: null,
                    photoUrls: [],
                    voiceSampleUrls: [],
                    voiceId: null,
                });
                return res
                    .status(201)
                    .json({ success: true, data: { avatar, vaultId: vault._id } });
            }
            catch (err) {
                return res
                    .status(500)
                    .json({ success: false, message: "Handshake failed" });
            }
        };
        this.list = async (req, res) => {
            const avatars = await Avatar_1.default.find({ userId: req.user?._id })
                .sort({ updatedAt: -1 })
                .lean();
            return res.status(200).json({ success: true, data: { avatars } });
        };
        this.getOne = async (req, res) => {
            try {
                const avatar = await Avatar_1.default.findOne({
                    _id: req.params.id,
                    userId: req.user?._id,
                }).lean();
                if (!avatar)
                    return res
                        .status(404)
                        .json({ success: false, message: "Avatar not found" });
                let remainingCredits = 0;
                const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
                    .replace(/[`'"]/g, "")
                    .trim();
                if (cleanApiKey) {
                    try {
                        const subResponse = await axios_1.default.get("https://api.elevenlabs.io/v1/user/subscription", {
                            headers: { "xi-api-key": cleanApiKey },
                        });
                        remainingCredits =
                            subResponse.data.character_limit - subResponse.data.character_count;
                    }
                    catch (err) {
                        console.error("[ElevenLabs] Credit sync failed");
                    }
                }
                return res.status(200).json({
                    success: true,
                    data: {
                        avatar,
                        credits: {
                            remaining: 10000,
                            isLow: false,
                        },
                    },
                });
            }
            catch (error) {
                return res.status(500).json({ success: false, message: "Server error" });
            }
        };
        this.update = async (req, res) => {
            const avatar = await Avatar_1.default.findOneAndUpdate({ _id: req.params.id, userId: req.user?._id }, req.body, { new: true });
            return res.status(200).json({ success: true, data: { avatar } });
        };
        this.remove = async (req, res) => {
            const avatar = await Avatar_1.default.findOne({
                _id: req.params.id,
                userId: req.user?._id,
            });
            if (avatar) {
                const dir = node_path_1.default.join(multerAvatar_1.AVATAR_UPLOAD_BASE, avatar._id.toString());
                if (node_fs_1.default.existsSync(dir))
                    node_fs_1.default.rmSync(dir, { recursive: true });
                await Avatar_1.default.findByIdAndDelete(avatar._id);
            }
            return res.status(200).json({ success: true, message: "Deleted" });
        };
        this.cloneVoice = async (req, res) => {
            const avatar = await Avatar_1.default.findOne({
                _id: req.params.id,
                userId: req.user?._id,
            });
            if (!avatar)
                return res
                    .status(404)
                    .json({ success: false, message: "Avatar not found" });
            if (avatar.voiceSampleUrls.length < VOICE_SAMPLES_REQUIRED) {
                return res
                    .status(400)
                    .json({ success: false, message: "Insufficient voice samples" });
            }
            try {
                const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
                    .replace(/[`'"]/g, "")
                    .trim();
                const FormData = (await Promise.resolve().then(() => __importStar(require("form-data")))).default;
                const form = new FormData();
                form.append("name", avatar.name);
                for (const samplePath of avatar.voiceSampleUrls) {
                    const fullPath = node_path_1.default.resolve(samplePath);
                    if (node_fs_1.default.existsSync(fullPath))
                        form.append("files", node_fs_1.default.createReadStream(fullPath));
                }
                const elResponse = await axios_1.default.post("https://api.elevenlabs.io/v1/voices/add", form, {
                    headers: { "xi-api-key": cleanApiKey, ...form.getHeaders() },
                });
                avatar.voiceId = elResponse.data?.voice_id;
                avatar.status = "training";
                await avatar.save();
                this.generateMasterLoop(avatar._id.toString());
                return res.status(200).json({ success: true, data: { avatar } });
            }
            catch (err) {
                console.log("ElevenLabs Response:", err.response?.data || err.message);
                return res
                    .status(500)
                    .json({ success: false, message: "Vocal cloning failed" });
            }
        };
        this.upload = async (req, res) => {
            const avatar = await Avatar_1.default.findOne({
                _id: req.params.id,
                userId: req.user?._id,
            });
            if (!avatar)
                return res.status(404).send();
            const files = req.files;
            if (files?.photo) {
                const paths = files.photo.map((f) => f.path);
                avatar.photoUrls = [...avatar.photoUrls, ...paths];
                if (!avatar.heroImageUrl) {
                    const result = await cloudinary_1.v2.uploader.upload(paths[0], {
                        folder: `arklife/avatars/${avatar._id}`,
                    });
                    avatar.heroImageUrl = result.secure_url;
                }
            }
            if (files?.voiceSample) {
                const paths = files.voiceSample.map((f) => f.path);
                avatar.voiceSampleUrls = [...avatar.voiceSampleUrls, ...paths];
            }
            await avatar.save();
            return res.status(200).json({ success: true, data: { avatar } });
        };
        this.testSpeech = async (req, res) => {
            const { voiceId, text } = req.body;
            const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
                .replace(/[`'"]/g, "")
                .trim();
            const characterCount = text?.length || 0;
            try {
                const userResponse = await axios_1.default.get("https://api.elevenlabs.io/v1/user/subscription", {
                    headers: { "xi-api-key": cleanApiKey },
                });
                const remaining = userResponse.data.character_limit - userResponse.data.character_count;
                if (remaining < characterCount) {
                    return res
                        .status(403)
                        .json({ success: false, message: `Insufficient credits.` });
                }
                const response = await axios_1.default.post(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
                    text: text || "Neural link active.",
                    model_id: "eleven_monolingual_v1",
                }, {
                    headers: {
                        "xi-api-key": cleanApiKey,
                        "Content-Type": "application/json",
                        Accept: "audio/mpeg",
                    },
                    responseType: "arraybuffer",
                });
                res.set("Content-Type", "audio/mpeg");
                return res.send(response.data);
            }
            catch (e) {
                return res
                    .status(500)
                    .json({ success: false, message: "Speech failure" });
            }
        };
    }
}
exports.AvatarController = AvatarController;
exports.default = new AvatarController();
//# sourceMappingURL=avatar.controller.js.map