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
   * INTERNAL: Triggers D-ID Cloud API
   */
  private generateMasterLoop = async (avatarId: string) => {
    const avatar = await Avatar.findById(avatarId);
    if (!avatar || !avatar.heroImageUrl) return;

    try {
      const authHeader =
        "Basic aWtyYW1raGFuQG5leGF1cmEuY28:I3ngeqeOJmFbzCCKg__QW";
      const sourceUrl = avatar.heroImageUrl;

      const animationResponse = await axios.post(
        `https://api.d-id.com/animations`,
        {
          source_url: sourceUrl,
          driver_url: "bank://classics/",
          config: { stitch: true, mute: true },
        },
        {
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
          },
        },
      );

      const talkId = animationResponse.data.id;
      let attempts = 0;

      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const statusResponse = await axios.get(
            `https://api.d-id.com/animations/${talkId}`,
            { headers: { Authorization: authHeader } },
          );
          const { status, result_url } = statusResponse.data;

          if (status === "done" && result_url) {
            clearInterval(pollInterval);
            const localFolder = path.join(
              AVATAR_UPLOAD_BASE,
              avatarId.toString(),
            );
            const fileName = `master_loop_${Date.now()}.mp4`;
            const localPath = path.join(localFolder, fileName);

            if (!fs.existsSync(localFolder))
              fs.mkdirSync(localFolder, { recursive: true });

            const videoResponse = await axios({
              url: result_url,
              method: "GET",
              responseType: "stream",
            });
            const writer = fs.createWriteStream(localPath);
            videoResponse.data.pipe(writer);

            writer.on("finish", async () => {
              avatar.masterVideoUrl = `avatars/${avatarId}/${fileName}`;
              avatar.status = "ready";
              await avatar.save();
            });
          } else if (status === "error" || attempts > 60) {
            avatar.status = "draft";
            await avatar.save();
            clearInterval(pollInterval);
          }
        } catch (err) {
          clearInterval(pollInterval);
        }
      }, 4000);
    } catch (err: any) {
      avatar.status = "draft";
      await avatar.save();
    }
  };

  /** Remove an image or voice sample */
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

  /** Set Hero Image */
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
      await avatar.save();
      return res.status(200).json({ success: true, data: { avatar } });
    } catch (err) {
      return res
        .status(500)
        .json({ success: false, message: "Cloudinary failed" });
    }
  };

  /** CREATE Avatar with Subscription Restriction */
  create = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const { name, description } = req.body;

    try {
      // 1. Fetch User Tier
      const user = await User.findById(userId);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      // 2. Count existing avatars
      const avatarCount = await Avatar.countDocuments({ userId });

      // 3. Enforce Limit
      const limit =
        TIER_LIMITS[user.subscriptionTier as keyof typeof TIER_LIMITS] || 1;
      if (avatarCount >= limit) {
        return res.status(403).json({
          success: false,
          message: `Protocol Limit Reached. ${user.subscriptionTier.toUpperCase()} tier allows max ${limit} neural nodes.`,
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
      });

      return res
        .status(201)
        .json({ success: true, data: { avatar, vaultId: vault._id } });
    } catch (err: any) {
      return res
        .status(500)
        .json({ success: false, message: "Handshake failed" });
    }
  };

  list = async (req: AuthRequest, res: Response) => {
    const avatars = await Avatar.find({ userId: req.user?._id })
      .sort({ updatedAt: -1 })
      .lean();
    return res.status(200).json({ success: true, data: { avatars } });
  };

  getOne = async (req: AuthRequest, res: Response) => {
    try {
      const avatar = await Avatar.findOne({
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
          const subResponse = await axios.get(
            "https://api.elevenlabs.io/v1/user/subscription",
            {
              headers: { "xi-api-key": cleanApiKey },
            },
          );
          remainingCredits =
            subResponse.data.character_limit - subResponse.data.character_count;
        } catch (err) {
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
    } catch (error) {
      return res.status(500).json({ success: false, message: "Server error" });
    }
  };

  update = async (req: AuthRequest, res: Response) => {
    const avatar = await Avatar.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?._id },
      req.body,
      { new: true },
    );
    return res.status(200).json({ success: true, data: { avatar } });
  };

  remove = async (req: AuthRequest, res: Response) => {
    const avatar = await Avatar.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });
    if (avatar) {
      const dir = path.join(AVATAR_UPLOAD_BASE, avatar._id.toString());
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true });
      await Avatar.findByIdAndDelete(avatar._id);
    }
    return res.status(200).json({ success: true, message: "Deleted" });
  };

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
        .json({ success: false, message: "Insufficient voice samples" });
    }

    try {
      const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
        .replace(/[`'"]/g, "")
        .trim();
      const FormData = (await import("form-data")).default;
      const form = new FormData();
      form.append("name", avatar.name);

      for (const samplePath of avatar.voiceSampleUrls) {
        const fullPath = path.resolve(samplePath);
        if (fs.existsSync(fullPath))
          form.append("files", fs.createReadStream(fullPath));
      }

      const elResponse = await axios.post(
        "https://api.elevenlabs.io/v1/voices/add",
        form,
        {
          headers: { "xi-api-key": cleanApiKey, ...form.getHeaders() },
        },
      );

      avatar.voiceId = elResponse.data?.voice_id;
      avatar.status = "training";
      await avatar.save();

      this.generateMasterLoop(avatar._id.toString());
      return res.status(200).json({ success: true, data: { avatar } });
    } catch (err: any) {
      console.log("ElevenLabs Response:", err.response?.data || err.message);

      return res
        .status(500)
        .json({ success: false, message: "Vocal cloning failed" });
    }
  };

  upload = async (req: AuthRequest, res: Response) => {
    const avatar = await Avatar.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });
    if (!avatar) return res.status(404).send();
    const files = (req as any).files;

    if (files?.photo) {
      const paths = files.photo.map((f: any) => f.path);
      avatar.photoUrls = [...avatar.photoUrls, ...paths];
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

  testSpeech = async (req: AuthRequest, res: Response) => {
    const { voiceId, text } = req.body;
    const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
      .replace(/[`'"]/g, "")
      .trim();
    const characterCount = text?.length || 0;

    try {
      const userResponse = await axios.get(
        "https://api.elevenlabs.io/v1/user/subscription",
        {
          headers: { "xi-api-key": cleanApiKey },
        },
      );
      const remaining =
        userResponse.data.character_limit - userResponse.data.character_count;

      if (remaining < characterCount) {
        return res
          .status(403)
          .json({ success: false, message: `Insufficient credits.` });
      }

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
        .json({ success: false, message: "Speech failure" });
    }
  };
}

export default new AvatarController();
