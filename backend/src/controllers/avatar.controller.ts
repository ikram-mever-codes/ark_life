import { Response } from "express";
import path from "node:path";
import fs from "node:fs";
import axios from "axios";
import { v2 as cloudinary } from "cloudinary";
import { AuthRequest } from "../middleware/auth";
import Avatar from "../models/Avatar";
import User from "../models/User";
import MemoryVault from "../models/MemoryVault";
import { AVATAR_UPLOAD_BASE } from "../config/multerAvatar";
import { generateMasterLoop } from "../utils/generateMasterLoop";

cloudinary.config({
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

export class AvatarController {
  /**
   * CREATE: Initializes a new digital twin with tier-based limits.
   */
  create = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const { name, description } = req.body;

    try {
      const user = await User.findById(userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      const avatarCount = await Avatar.countDocuments({ userId });
      const limit =
        TIER_LIMITS[user.subscriptionTier as keyof typeof TIER_LIMITS] || 1;

      if (avatarCount >= limit) {
        return res.status(403).json({
          success: false,
          message: `Neural Node limit reached. ${user.subscriptionTier.toUpperCase()} tier allows max ${limit} twins.`,
        });
      }

      let vault = await MemoryVault.findOne({ userId });
      if (!vault) vault = await MemoryVault.create({ userId, files: [] });

      const avatar = await Avatar.create({
        userId,
        name,
        description,
        status: "draft",
        memoryVaultId: vault._id,
        heroImageUrl: null,
        photoUrls: [],
        voiceSampleUrls: [],
        voiceId: null,
        masterVideoUrl: null,
        mouthCoords: null,
      });

      return res
        .status(201)
        .json({ success: true, data: { avatar, vaultId: vault._id } });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, message: "Initialization handshake failed" });
    }
  };

  /**
   * LIST: Retrieve all nodes for the authenticated user.
   */
  list = async (req: AuthRequest, res: Response) => {
    try {
      const avatars = await Avatar.find({ userId: req.user?._id })
        .sort({ updatedAt: -1 })
        .lean();
      return res.status(200).json({ success: true, data: { avatars } });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "Failed to retrieve directory" });
    }
  };

  /**
   * GET ONE: Fetch specific node details.
   */
  getOne = async (req: AuthRequest, res: Response) => {
    try {
      const avatar = await Avatar.findOne({
        _id: req.params.id,
        userId: req.user?._id,
      }).lean();

      if (!avatar)
        return res
          .status(404)
          .json({ success: false, message: "Node not found" });

      return res.status(200).json({
        success: true,
        data: {
          avatar,
          credits: { remaining: 10000, isLow: false }, // Mocking system credits for dashboard
        },
      });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: "Neural link error" });
    }
  };

  /**
   * UPDATE: Modify persona parameters.
   */
  update = async (req: AuthRequest, res: Response) => {
    try {
      const avatar = await Avatar.findOneAndUpdate(
        { _id: req.params.id, userId: req.user?._id },
        req.body,
        { new: true },
      );
      return res.status(200).json({ success: true, data: { avatar } });
    } catch (err) {
      return res.status(500).json({ success: false, message: "Update failed" });
    }
  };

  /**
   * REMOVE: Wipe node data and local assets.
   */
  remove = async (req: AuthRequest, res: Response) => {
    try {
      const avatar = await Avatar.findOne({
        _id: req.params.id,
        userId: req.user?._id,
      });
      if (avatar) {
        const dir = path.join(AVATAR_UPLOAD_BASE, avatar._id.toString());
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
        await Avatar.findByIdAndDelete(avatar._id);
      }
      return res
        .status(200)
        .json({ success: true, message: "Node terminated" });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "Decommission failure" });
    }
  };

  /**
   * CLONE VOICE: Syncs with ElevenLabs, then generates a local master idle loop
   * (via ffmpeg) so chat can play a breathing video without D-ID / HeyGen credits.
   */
  cloneVoice = async (req: AuthRequest, res: Response) => {
    const avatar = await Avatar.findOne({
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
        .json({ success: false, message: "Insufficient vocal DNA samples" });
    }

    try {
      // ---- Step 1: Clone voice with ElevenLabs ----
      const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
        .replace(/[`'"]/g, "")
        .trim();
      const FormData = (await import("form-data")).default;
      const form = new FormData();
      form.append("name", avatar.name);

      for (const samplePath of avatar.voiceSampleUrls) {
        const fullPath = path.resolve(samplePath);
        if (fs.existsSync(fullPath)) {
          form.append("files", fs.createReadStream(fullPath));
        }
      }

      const elResponse = await axios.post(
        "https://api.elevenlabs.io/v1/voices/add",
        form,
        { headers: { "xi-api-key": cleanApiKey, ...form.getHeaders() } },
      );

      avatar.voiceId = elResponse.data?.voice_id;

      // ---- Step 2: Generate the local master idle loop ----
      // This replaces what D-ID/HeyGen would normally produce. It's a subtle
      // breathing animation from the hero image, looped seamlessly during chat.
      if (avatar.heroImageUrl) {
        try {
          const masterVideoUrl = await generateMasterLoop(
            avatar.heroImageUrl,
            avatar._id.toString(),
          );
          avatar.masterVideoUrl = masterVideoUrl;
          avatar.status = "ready";
        } catch (loopErr: any) {
          // Graceful degradation: voice is cloned, but loop failed.
          // Chat will fall back to the still hero image.
          console.error("Master loop generation failed:", loopErr.message);
          avatar.status = "ready";
        }
      } else {
        // No hero image yet — user can still use voice-only mode.
        avatar.status = "draft";
      }

      await avatar.save();

      return res.status(200).json({
        success: true,
        message: avatar.masterVideoUrl
          ? "Vocal signature synced. Visual idle loop compiled. Neural link established."
          : "Vocal signature synced. Neural link established.",
        data: { avatar },
      });
    } catch (err: any) {
      console.error("Voice Clone Error:", err.response?.data || err.message);
      return res
        .status(500)
        .json({ success: false, message: "Vocal cloning failed" });
    }
  };

  /**
   * UPLOAD: Stage photos and voice samples.
   */
  upload = async (req: AuthRequest, res: Response) => {
    const avatar = await Avatar.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });
    if (!avatar)
      return res
        .status(404)
        .json({ success: false, message: "Avatar not found" });

    const files = (req as any).files;

    if (files?.photo) {
      const paths = files.photo.map((f: any) => f.path);
      avatar.photoUrls = [...avatar.photoUrls, ...paths];

      // Auto-set hero if missing
      if (!avatar.heroImageUrl) {
        const result = await cloudinary.uploader.upload(paths[0], {
          folder: `arklife/avatars/${avatar._id}`,
        });
        avatar.heroImageUrl = result.secure_url;
      }
    }

    if (files?.voiceSample) {
      const paths = files.voiceSample.map((f: any) => f.path);
      avatar.voiceSampleUrls = [...avatar.voiceSampleUrls, ...paths];
    }

    await avatar.save();
    return res.status(200).json({ success: true, data: { avatar } });
  };

  /**
   * SET HERO IMAGE: Defines the face used for visual synthesis.
   * If the avatar already has a cloned voice, regenerate the master loop
   * so the idle video reflects the new face immediately.
   *
   * NOTE: When the hero image changes, mouthCoords becomes stale. We clear
   * it here so the frontend knows to re-run detection on the new image.
   */
  setHeroImage = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { url } = req.body;
    const avatar = await Avatar.findOne({ _id: id, userId: req.user?._id });
    if (!avatar)
      return res
        .status(404)
        .json({ success: false, message: "Avatar not found" });

    try {
      const filePath = url.startsWith("http") ? url : path.resolve(url);
      const result = await cloudinary.uploader.upload(filePath, {
        folder: `arklife/avatars/${avatar._id}`,
      });
      avatar.heroImageUrl = result.secure_url;

      // Hero face changed → old mouth coordinates are invalid.
      // Frontend will re-detect and POST new coords to /mouth-coords.
      avatar.mouthCoords = null;

      // If voice is already cloned, regenerate the master loop to match the new face.
      if (avatar.voiceId) {
        try {
          const masterVideoUrl = await generateMasterLoop(
            avatar.heroImageUrl,
            avatar._id.toString(),
          );
          avatar.masterVideoUrl = masterVideoUrl;
        } catch (loopErr: any) {
          console.error("Master loop regeneration failed:", loopErr.message);
          // Keep the old masterVideoUrl rather than nulling — better a stale
          // loop than a broken chat screen.
        }
        avatar.status = "ready";
      }

      await avatar.save();
      return res.status(200).json({ success: true, data: { avatar } });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "Visual anchor sync failed" });
    }
  };

  /**
   * SET MOUTH COORDS: Stores face-api.js mouth detection results.
   *
   * Called once by the frontend after the hero image is set. The client runs
   * face-api.js locally (weights cached after first load) and posts the
   * normalized mouth bounding box here. During chat, these coordinates
   * position the audio-reactive mouth overlay in the ChatRoom.
   *
   * Coords are stored as PERCENTAGES (0-1) of the image dimensions so the
   * overlay scales correctly regardless of the video's rendered size.
   *
   * Expected body: { x, y, width, height } — all in 0-1 range.
   */
  setMouthCoords = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { x, y, width, height } = req.body;

    console.log("[setMouthCoords] Incoming payload:", {
      id,
      x,
      y,
      width,
      height,
    });

    // Validation — must be four numbers in 0-1 range
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof width !== "number" ||
      typeof height !== "number" ||
      [x, y, width, height].some((v) => v < 0 || v > 1)
    ) {
      console.error("[setMouthCoords] Invalid payload rejected");
      return res.status(400).json({
        success: false,
        message: "Invalid mouth coordinates. Expected normalized values 0-1.",
      });
    }

    try {
      const avatar = await Avatar.findOne({
        _id: id,
        userId: req.user?._id,
      });
      if (!avatar) {
        console.error("[setMouthCoords] Avatar not found:", id);
        return res
          .status(404)
          .json({ success: false, message: "Avatar not found" });
      }

      // Assign and force Mongoose to mark this path as modified.
      // Without markModified, nested-object assignments can silently
      // fail to persist — a well-known Mongoose gotcha.
      avatar.mouthCoords = { x, y, width, height };
      avatar.markModified("mouthCoords");

      await avatar.save();

      // Re-fetch to verify persistence and return canonical state
      const verified = await Avatar.findById(id).lean();
      console.log(
        "[setMouthCoords] Saved and verified. mouthCoords =",
        verified?.mouthCoords,
      );

      return res.status(200).json({
        success: true,
        message: "Mouth anchor calibrated.",
        data: { avatar: verified },
      });
    } catch (err: any) {
      console.error("[setMouthCoords] Save failed:", err.message);
      return res.status(500).json({
        success: false,
        message: "Failed to persist mouth coordinates",
      });
    }
  };

  /**
   * REMOVE ASSET: Purge specific media from the node gallery.
   */
  removeAsset = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { url, type } = req.body;
    const avatar = await Avatar.findOne({ _id: id, userId: req.user?._id });
    if (!avatar)
      return res
        .status(404)
        .json({ success: false, message: "Avatar not found" });

    if (type === "photo") {
      avatar.photoUrls = avatar.photoUrls.filter((p) => p !== url);
      if (avatar.heroImageUrl === url)
        avatar.heroImageUrl = avatar.photoUrls[0] || null;
    } else {
      avatar.voiceSampleUrls = avatar.voiceSampleUrls.filter((v) => v !== url);
    }

    await avatar.save();
    return res.status(200).json({ success: true, data: { avatar } });
  };

  /**
   * TEST SPEECH: Validate vocal signature with custom text.
   */
  testSpeech = async (req: AuthRequest, res: Response) => {
    const { voiceId, text } = req.body;
    const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
      .replace(/[`'"]/g, "")
      .trim();

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text: text || "Neural link active.",
          model_id: "eleven_monolingual_v1",
        },
        {
          headers: {
            "xi-api-key": cleanApiKey,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          responseType: "arraybuffer",
        },
      );
      res.set("Content-Type", "audio/mpeg");
      return res.send(response.data);
    } catch (e: any) {
      return res
        .status(500)
        .json({ success: false, message: "Vocal frequency failure" });
    }
  };

  /**
   * CLEAR ALL VOICES: Management utility to free up ElevenLabs slots.
   */
  clearAllVoices = async (req: AuthRequest, res: Response) => {
    try {
      const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
        .replace(/[`'"]/g, "")
        .trim();
      const voicesResponse = await axios.get(
        "https://api.elevenlabs.io/v1/voices",
        {
          headers: { "xi-api-key": cleanApiKey },
        },
      );
      const customVoices = voicesResponse.data.voices.filter(
        (v: any) => v.category === "cloned" || v.category === "generated",
      );
      const deletePromises = customVoices.map((voice: any) =>
        axios.delete(`https://api.elevenlabs.io/v1/voices/${voice.voice_id}`, {
          headers: { "xi-api-key": cleanApiKey },
        }),
      );
      await Promise.all(deletePromises);
      return res
        .status(200)
        .json({ success: true, message: "Voice slots cleared." });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, message: "Cleanup operation failed" });
    }
  };
}

export default new AvatarController();
