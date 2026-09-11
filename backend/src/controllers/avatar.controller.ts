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
import { createDIDTalk, checkDIDTalkStatus } from "../services/dIdService";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VOICE_SAMPLES_REQUIRED = 1;

const IDLE_LOOP_SCRIPT_TEXT =
  "I'm here whenever you'd like to talk, so feel free to ask me anything on your mind.";

const DID_PROVIDER = {
  type: "microsoft",
  voice_id: "en-US-JennyNeural",
} as const;

const DID_QUICK_POLL_INTERVAL_MS = 2500;
const DID_QUICK_POLL_MAX_ATTEMPTS = 6; // ~15s worst case

// Separate, longer timeout used by getOne() when picking up a job that
// didn't finish during the quick poll — this runs across multiple
// requests (the frontend's 5s poll loop), so it isn't bound by the 29s
// single-request limit.
const DID_JOB_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Creates the D-ID talk job and saves the job id/timestamp on the avatar.
 * Does not poll — callers decide how long to wait, if at all, given the
 * request-timeout budget they have left. Does not save(); callers save
 * once alongside their other field changes.
 */
async function createMasterVideoJob(avatar: InstanceType<typeof Avatar>) {
  if (!avatar.heroImageUrl) {
    avatar.masterVideoError = "No hero image set — cannot generate a video.";
    avatar.masterVideoUrl = null;
    avatar.didTalkId = null;
    avatar.didTalkCreatedAt = null;
    return;
  }

  try {
    const talkId = await createDIDTalk({
      sourceUrl: avatar.heroImageUrl,
      scriptText: IDLE_LOOP_SCRIPT_TEXT,
      provider: DID_PROVIDER,
    });

    avatar.didTalkId = talkId;
    avatar.didTalkCreatedAt = new Date();
    avatar.masterVideoError = null;
    avatar.status = "training";
  } catch (err: any) {
    console.error("[D-ID] Talk creation failed:", err.message);
    avatar.status = "ready";
    avatar.didTalkId = null;
    avatar.didTalkCreatedAt = null;
    avatar.masterVideoError =
      "Video generation could not start. Chat will use the still image instead.";
  }
}

/**
 * Polls an already-created job for a SHORT, bounded window (see the
 * constants above) so a fast-finishing job can be returned in the same
 * response that created it. If it doesn't finish in that window, this
 * returns without error — the job is left in "training" for getOne() to
 * pick up on a later request. This function only ever moves status to
 * "ready"; it never times the job out itself (getOne owns that, since it
 * can measure elapsed time across the job's full lifetime, not just this
 * one short window).
 */
async function quickPollMasterVideo(avatar: InstanceType<typeof Avatar>) {
  if (!avatar.didTalkId) return;

  for (let attempt = 0; attempt < DID_QUICK_POLL_MAX_ATTEMPTS; attempt++) {
    try {
      const { status, result_url } = await checkDIDTalkStatus(avatar.didTalkId);

      if (status === "done" && result_url) {
        avatar.masterVideoUrl = result_url;
        avatar.masterVideoError = null;
        avatar.status = "ready";
        return;
      }

      if (status === "error" || status === "rejected") {
        console.error(
          `[quickPollMasterVideo] D-ID talk ${avatar.didTalkId} failed with status: ${status}`,
        );
        avatar.status = "ready";
        avatar.masterVideoError =
          "Video generation failed. Chat will use the still image instead.";
        return;
      }
      // still processing — fall through to wait + retry
    } catch (err: any) {
      // Transient network hiccup on our side checking D-ID — don't fail
      // the job over it, just stop the quick-poll early and let getOne's
      // longer-lived polling take over on the next request.
      console.error("[quickPollMasterVideo] status check failed:", err.message);
      return;
    }

    if (attempt < DID_QUICK_POLL_MAX_ATTEMPTS - 1) {
      await sleep(DID_QUICK_POLL_INTERVAL_MS);
    }
  }
  // Exhausted the short window without resolving — leave status as
  // "training" with didTalkId set. getOne() continues checking it.
}

export class AvatarController {
  create = async (req: AuthRequest, res: Response) => {
    const userId = req.user?._id;
    const { name, description } = req.body;

    try {
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      let vault = await MemoryVault.findOne({ userId });
      if (!vault) {
        vault = await MemoryVault.create({ userId, files: [] });
      }

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
        masterVideoError: null,
        mouthCoords: null,
        didTalkId: null,
        didTalkCreatedAt: null,
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
   * GET ONE: If a D-ID job is in flight (status "training"), checks its
   * status inline. This is the mechanism that picks up jobs which didn't
   * finish during cloneVoice's short in-request poll — the frontend's
   * existing 5s poll loop keeps calling this until it resolves.
   *
   * Handles three distinct failure modes:
   *  1. D-ID reports the talk itself failed — masterVideoError set,
   *     status degrades to "ready".
   *  2. The status-check call itself fails (network blip) — logged, but
   *     status/masterVideoError untouched since this is transient; next
   *     poll retries.
   *  3. The job has run longer than DID_JOB_TIMEOUT_MS with no resolution
   *     at all — timed out explicitly rather than polling forever.
   */
  getOne = async (req: AuthRequest, res: Response) => {
    try {
      const avatar = await Avatar.findOne({
        _id: req.params.id,
        userId: req.user?._id,
      });

      if (!avatar) {
        return res
          .status(404)
          .json({ success: false, message: "Node not found" });
      }

      if (
        avatar.status === "training" &&
        avatar.didTalkId &&
        !avatar.masterVideoUrl
      ) {
        const jobAge = avatar.didTalkCreatedAt
          ? Date.now() - new Date(avatar.didTalkCreatedAt).getTime()
          : 0;

        if (jobAge > DID_JOB_TIMEOUT_MS) {
          console.error(
            `[getOne] D-ID talk ${avatar.didTalkId} timed out after ${Math.round(jobAge / 1000)}s`,
          );
          avatar.status = "ready";
          avatar.masterVideoError =
            "Video generation timed out. Chat will use the still image instead.";
          await avatar.save();
        } else {
          try {
            const { status, result_url } = await checkDIDTalkStatus(
              avatar.didTalkId,
            );

            if (status === "done" && result_url) {
              avatar.masterVideoUrl = result_url;
              avatar.masterVideoError = null;
              avatar.status = "ready";
              await avatar.save();
            } else if (status === "error" || status === "rejected") {
              console.error(
                `[getOne] D-ID talk ${avatar.didTalkId} failed with status: ${status}`,
              );
              avatar.status = "ready";
              avatar.masterVideoError =
                "Video generation failed. Chat will use the still image instead.";
              await avatar.save();
            }
            // else still processing — leave status as "training", frontend polls again in 5s
          } catch (err: any) {
            console.error("[getOne] D-ID status check failed:", err.message);
          }
        }
      }

      return res.status(200).json({
        success: true,
        data: {
          avatar: avatar.toObject(),
          credits: { remaining: 10000, isLow: false },
        },
      });
    } catch (error) {
      return res
        .status(500)
        .json({ success: false, message: "Neural link error" });
    }
  };

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
   * CLONE VOICE: Syncs with ElevenLabs, then creates the D-ID master
   * video job HERE and attempts a short, bounded poll for it before
   * responding — see createMasterVideoJob / quickPollMasterVideo and the
   * API-Gateway-timeout note above. Fast jobs come back finished in this
   * same response; slower ones are picked up by getOne()'s polling.
   */
  cloneVoice = async (req: AuthRequest, res: Response) => {
    const avatar = await Avatar.findOne({
      _id: req.params.id,
      userId: req.user?._id,
    });
    if (!avatar) {
      return res
        .status(404)
        .json({ success: false, message: "Avatar not found" });
    }

    if (avatar.voiceSampleUrls.length < VOICE_SAMPLES_REQUIRED) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient vocal DNA samples" });
    }

    try {
      const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
        .replace(/[`'"]/g, "")
        .trim();
      const FormData = (await import("form-data")).default;
      const form = new FormData();
      form.append("name", avatar.name);

      const missingFiles: string[] = [];
      let attachedCount = 0;

      for (const samplePath of avatar.voiceSampleUrls) {
        const fullPath = path.resolve(samplePath);
        if (fs.existsSync(fullPath)) {
          form.append("files", fs.createReadStream(fullPath));
          attachedCount++;
        } else {
          missingFiles.push(fullPath);
        }
      }

      if (missingFiles.length > 0) {
        console.error(
          `[cloneVoice] ${missingFiles.length} voice sample(s) missing on disk:`,
          missingFiles,
        );
      }

      if (attachedCount === 0) {
        return res.status(422).json({
          success: false,
          message:
            "None of the stored voice samples exist on disk. Re-upload voice samples to continue.",
        });
      }

      let elResponse;
      try {
        elResponse = await axios.post(
          "https://api.elevenlabs.io/v1/voices/add",
          form,
          { headers: { "xi-api-key": cleanApiKey, ...form.getHeaders() } },
        );
      } catch (elErr: any) {
        console.error(
          "[cloneVoice] ElevenLabs voice creation failed:",
          elErr.response?.data || elErr.message,
        );
        return res.status(502).json({
          success: false,
          message:
            "Voice cloning service rejected the request. Check your voice samples and try again.",
        });
      }

      avatar.voiceId = elResponse.data?.voice_id;

      if (avatar.heroImageUrl) {
        await createMasterVideoJob(avatar);
        if (avatar.didTalkId) {
          await quickPollMasterVideo(avatar);
        }
      } else {
        avatar.status = "draft";
        avatar.masterVideoError =
          "No hero image set yet — set one to generate a video.";
      }

      await avatar.save();

      const message = avatar.masterVideoUrl
        ? "Vocal signature synced. AI video ready."
        : avatar.status === "training"
          ? "Vocal signature synced. Still compiling AI video…"
          : `Vocal signature synced. ${avatar.masterVideoError ?? "Chat will use the still image."}`;

      return res.status(200).json({
        success: true,
        message,
        data: { avatar },
      });
    } catch (err: any) {
      console.error("Voice Clone Error:", err.response?.data || err.message);
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
    if (!avatar) {
      return res
        .status(404)
        .json({ success: false, message: "Avatar not found" });
    }

    const files = (req as any).files;

    try {
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
    } catch (err: any) {
      console.error("[upload] Failed:", err.message);
      return res.status(500).json({
        success: false,
        message: "Asset upload failed. Please try again.",
      });
    }
  };

  /**
   * SET HERO IMAGE: If a voice is already cloned, kicks off a new master
   * video job for the new hero image and attempts the same short poll as
   * cloneVoice. Falls back to getOne() polling if it doesn't finish fast.
   */
  setHeroImage = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { url } = req.body;
    const avatar = await Avatar.findOne({ _id: id, userId: req.user?._id });
    if (!avatar) {
      return res
        .status(404)
        .json({ success: false, message: "Avatar not found" });
    }

    try {
      const filePath = url.startsWith("http") ? url : path.resolve(url);
      const result = await cloudinary.uploader.upload(filePath, {
        folder: `arklife/avatars/${avatar._id}`,
      });
      avatar.heroImageUrl = result.secure_url;
      avatar.mouthCoords = null; // hero changed → old mouth calibration invalid
      avatar.masterVideoUrl = null; // hero changed → old video no longer matches
      avatar.masterVideoError = null;

      if (avatar.voiceId) {
        await createMasterVideoJob(avatar);
        if (avatar.didTalkId) {
          await quickPollMasterVideo(avatar);
        }
      }

      await avatar.save();
      return res.status(200).json({ success: true, data: { avatar } });
    } catch (err: any) {
      console.error("[setHeroImage] Cloudinary upload failed:", err.message);
      return res.status(500).json({
        success: false,
        message: "Visual anchor sync failed. Please try uploading again.",
      });
    }
  };

  setMouthCoords = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { x, y, width, height } = req.body;

    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      typeof width !== "number" ||
      typeof height !== "number" ||
      [x, y, width, height].some((v) => v < 0 || v > 1)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid mouth coordinates. Expected normalized values 0-1.",
      });
    }

    try {
      const avatar = await Avatar.findOne({ _id: id, userId: req.user?._id });
      if (!avatar) {
        return res
          .status(404)
          .json({ success: false, message: "Avatar not found" });
      }

      avatar.mouthCoords = { x, y, width, height };
      avatar.markModified("mouthCoords");
      await avatar.save();

      const verified = await Avatar.findById(id).lean();

      return res.status(200).json({
        success: true,
        message: "Mouth anchor calibrated.",
        data: { avatar: verified },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: "Failed to persist mouth coordinates",
      });
    }
  };

  /**
   * RETRY MASTER VIDEO: Manually re-trigger generation after a failure.
   * Same short-poll-then-handoff pattern as cloneVoice/setHeroImage.
   */
  retryMasterVideo = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const avatar = await Avatar.findOne({ _id: id, userId: req.user?._id });
    if (!avatar) {
      return res
        .status(404)
        .json({ success: false, message: "Avatar not found" });
    }

    if (!avatar.heroImageUrl) {
      return res.status(400).json({
        success: false,
        message: "Set a hero image before generating a video.",
      });
    }

    await createMasterVideoJob(avatar);
    if (avatar.didTalkId) {
      await quickPollMasterVideo(avatar);
    }
    await avatar.save();

    const message = avatar.masterVideoUrl
      ? "AI video ready."
      : avatar.status === "training"
        ? "Still compiling AI video…"
        : (avatar.masterVideoError ?? "Video generation failed.");

    return res.status(200).json({ success: true, message, data: { avatar } });
  };

  removeAsset = async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const { url, type } = req.body;
    const avatar = await Avatar.findOne({ _id: id, userId: req.user?._id });
    if (!avatar) {
      return res
        .status(404)
        .json({ success: false, message: "Avatar not found" });
    }

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

  testSpeech = async (req: AuthRequest, res: Response) => {
    const { voiceId, text } = req.body;

    if (!voiceId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing voiceId" });
    }

    const cleanApiKey = (process.env.ELEVENLABS_API_KEY || "")
      .replace(/[`'"]/g, "")
      .trim();

    try {
      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        { text: text || "Neural link active." },
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
      console.error(
        "Test Speech Error:",
        e.response?.data
          ? Buffer.from(e.response.data).toString("utf-8")
          : e.message,
      );
      return res
        .status(500)
        .json({ success: false, message: "Vocal frequency failure" });
    }
  };

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

  generateTestAvatar = async (req: AuthRequest, res: Response) => {
    try {
      const imageName = req.body.imageName || "elon.jpg";
      const publicImagePath = path.join(
        process.cwd(),
        "public",
        imageName.replace(/^\//, ""),
      );

      if (!fs.existsSync(publicImagePath)) {
        return res.status(404).json({
          success: false,
          message: `Test image '${imageName}' not found in public directory: ${publicImagePath}`,
        });
      }

      const uploadResult = await cloudinary.uploader.upload(publicImagePath, {
        folder: "arklife/test-avatars",
      });
      const imageUrl = uploadResult.secure_url;

      const drivingVideoUrl =
        req.body.drivingVideoUrl ||
        "https://replicate.delivery/pbxt/LEQxLFMUNZMiKt5PWjyMJIbTdvKAb5j3f0spuiEwt9TEbo8B/d0.mp4";

      const output: any = await replicate.run(
        "fofr/live-portrait:067dd98cc3e5cb396c4a9efb4bba3eec6c4a9d271211325c477518fc6485e146",
        {
          input: {
            face_image: imageUrl,
            driving_video: drivingVideoUrl,
            live_portrait_dsize: 512,
            live_portrait_scale: 2.3,
            video_frame_load_cap: 128,
            live_portrait_lip_zero: true,
            live_portrait_relative: true,
            live_portrait_vx_ratio: 0,
            live_portrait_vy_ratio: -0.12,
            live_portrait_stitching: true,
            video_select_every_n_frames: 1,
            live_portrait_eye_retargeting: false,
            live_portrait_lip_retargeting: false,
            live_portrait_lip_retargeting_multiplier: 1,
            live_portrait_eyes_retargeting_multiplier: 1,
          },
        },
      );

      const videoUrl = Array.isArray(output)
        ? typeof output[0]?.url === "function"
          ? output[0].url()
          : String(output[0])
        : typeof output?.url === "function"
          ? output.url()
          : String(output);

      return res.status(200).json({
        success: true,
        message: "LivePortrait avatar generated successfully via Replicate.",
        data: { originalImage: imageUrl, generatedVideoUrl: videoUrl },
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        message: "Replicate avatar generation failed.",
        error: err.message,
      });
    }
  };
}

export default new AvatarController();
