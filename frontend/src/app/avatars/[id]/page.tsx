"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAvatarById,
  uploadAvatarAssets,
  cloneAvatarVoice,
  removeAvatarAsset,
  setAvatarHeroImage,
  setAvatarMouthCoords,
  Avatar,
} from "@/api/avatars";
import { getVault, addMemory, deleteMemoryFile, VaultData } from "@/api/memory";
import {
  Upload,
  Mic,
  ChevronLeft,
  Zap,
  Loader2,
  X,
  ArrowRight,
  Trash2,
  Star,
  Plus,
  FileText,
  User,
  Brain,
  CheckCircle,
  MessageSquare,
  Target,
  AlertTriangle,
  Camera,
  Video,
  Square,
  StopCircle,
  Circle,
  PenLine,
  RotateCcw,
  Check,
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { detectMouthCoords } from "@/utils/mouthDetection";
import { BASE_URL } from "@/utils/constants";

export const getAssetUrl = (localPath: string) => {
  if (!localPath) return "";
  if (localPath.startsWith("http")) return localPath;
  const baseUrl = BASE_URL;
  const relativePath = localPath.split("uploads")[1] || localPath;
  return `${baseUrl}/uploads${relativePath.replace(/\\/g, "/")}`;
};

type CaptureMode = null | "photo" | "video" | "audio";

const AvatarLab = () => {
  const { id } = useParams();
  const router = useRouter();

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [activeTab, setActiveTab] = useState<"appearance" | "personality">(
    "appearance",
  );
  const [loading, setLoading] = useState(true);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [calibrationError, setCalibrationError] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedVoices, setSelectedVoices] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const [vault, setVault] = useState<VaultData | null>(null);
  const [isUploadingMemory, setIsUploadingMemory] = useState(false);
  const [neuralBio, setNeuralBio] = useState("");

  const [captureMode, setCaptureMode] = useState<CaptureMode>(null);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      const [avatarData, vaultData] = await Promise.all([
        getAvatarById(id as string),
        getVault(),
      ]);
      setAvatar(avatarData);
      setVault(vaultData);
      if (vaultData.neuralBio) setNeuralBio(vaultData.neuralBio);

      console.log("[AvatarLab] Loaded avatar:", avatarData);
      console.log("[AvatarLab] mouthCoords on load:", avatarData?.mouthCoords);
    } catch (err) {
      toast.error("Connection lost. Returning home.");
      router.push("/avatars");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    const warmUp = async () => {
      try {
        await detectMouthCoords(
          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
        );
        console.log("[AvatarLab] face-api.js models pre-warmed");
      } catch (e) {
        console.warn("[AvatarLab] face-api.js pre-warm failed:", e);
      }
    };
    warmUp();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (avatar?.status === "training") {
      interval = setInterval(async () => {
        const fresh = await getAvatarById(id as string);
        if (fresh.status === "ready") {
          setAvatar(fresh);
          toast.success("AI Video is now ready!");
          clearInterval(interval);
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [id, avatar?.status]);

  const handleRemoveAsset = async (
    e: React.MouseEvent,
    url: string,
    type: "photo" | "voice",
  ) => {
    e.preventDefault();
    try {
      const updatedAvatar = await removeAvatarAsset(id as string, {
        url,
        type,
      });
      setAvatar(updatedAvatar);
      toast.success("Removed successfully");
    } catch (err) {
      console.error(err);
    }
  };

  const calibrateMouth = async (): Promise<boolean> => {
    if (!avatar?.heroImageUrl) {
      const msg = "No hero image set yet — select a hero first";
      console.warn("[calibrateMouth]", msg);
      setCalibrationError(msg);
      toast.error(msg);
      return false;
    }

    setIsCalibrating(true);
    setCalibrationError(null);
    const calibToast = toast.loading("Calibrating mouth anchor...");

    try {
      console.log(
        "[calibrateMouth] Running detection on:",
        avatar.heroImageUrl,
      );
      const coords = await detectMouthCoords(avatar.heroImageUrl);
      console.log("[calibrateMouth] Detection result:", coords);

      const valid = [coords.x, coords.y, coords.width, coords.height].every(
        (v) => typeof v === "number" && v >= 0 && v <= 1 && !isNaN(v),
      );
      if (!valid) {
        throw new Error(
          `Detector returned invalid coords: ${JSON.stringify(coords)}`,
        );
      }

      console.log("[calibrateMouth] Posting coords to backend...");
      const saveResponse = await setAvatarMouthCoords(id as string, coords);
      console.log("[calibrateMouth] Backend save response:", saveResponse);

      console.log("[calibrateMouth] Verifying persistence via re-fetch...");
      const refreshed = await getAvatarById(id as string);
      console.log(
        "[calibrateMouth] After re-fetch, mouthCoords =",
        refreshed.mouthCoords,
      );

      if (!refreshed.mouthCoords) {
        throw new Error(
          "Save succeeded but mouthCoords is still null after re-fetch. " +
            "This means the Mongoose schema is missing the mouthCoords field, " +
            "OR markModified() wasn't called in the backend controller.",
        );
      }

      setAvatar(refreshed);
      toast.success("Visual anchor locked", { id: calibToast });
      return true;
    } catch (err: any) {
      const errorMsg = err?.message || "Unknown error";
      console.error("[calibrateMouth] FAILED:", err);
      setCalibrationError(errorMsg);
      toast.error(`Calibration failed: ${errorMsg}`, {
        id: calibToast,
        duration: 6000,
      });
      return false;
    } finally {
      setIsCalibrating(false);
    }
  };

  const handleSetHero = async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    try {
      console.log("[handleSetHero] Setting hero image...");
      await setAvatarHeroImage(id as string, url);
      const data = await getAvatarById(id as string);
      setAvatar(data);
      console.log("[handleSetHero] Hero set. URL:", data.heroImageUrl);

      if (data.heroImageUrl) {
        setTimeout(() => calibrateMouth(), 100);
      }
    } catch (err) {
      console.error("[handleSetHero] Failed:", err);
      toast.error("Hero image sync failed");
    }
  };

  const handleFileSelection = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "photo" | "voice",
  ) => {
    const files = Array.from(e.target.files || []);
    if (type === "photo") {
      setSelectedPhotos((prev) => [...prev, ...files]);
      setPhotoPreviews((prev) => [
        ...prev,
        ...files.map((f) => URL.createObjectURL(f)),
      ]);
    } else {
      setSelectedVoices((prev) => [...prev, ...files]);
    }
    toast.success(`${files.length} items added to queue`);
  };

  const handleCapturedFile = (file: File, kind: "photo" | "voice") => {
    if (kind === "photo") {
      setSelectedPhotos((prev) => [...prev, file]);
      setPhotoPreviews((prev) => [...prev, URL.createObjectURL(file)]);
    } else {
      setSelectedVoices((prev) => [...prev, file]);
    }
    toast.success(
      kind === "photo" ? "Photo captured" : "Audio recording captured",
    );
    setCaptureMode(null);
  };

  const handleSyncAssets = async () => {
    setIsSyncing(true);
    try {
      await uploadAvatarAssets(id as string, {
        photos: selectedPhotos,
        voiceSamples: selectedVoices,
      });
      setSelectedPhotos([]);
      setSelectedVoices([]);
      setPhotoPreviews([]);

      const data = await getAvatarById(id as string);
      setAvatar(data);
      console.log("[handleSyncAssets] Upload complete. Avatar:", data);

      if (data.heroImageUrl && !data.mouthCoords) {
        console.log(
          "[handleSyncAssets] Hero exists but no mouth coords — auto-calibrating",
        );
        setTimeout(() => calibrateMouth(), 300);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecuteSync = async () => {
    try {
      await cloneAvatarVoice(id as string);
      const data = await getAvatarById(id as string);
      setAvatar(data);
    } catch (err) {}
  };

  const MAX_MEMORY_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleMemoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_MEMORY_FILE_SIZE) {
      toast.error(
        `${file.name} is ${(file.size / (1024 * 1024)).toFixed(1)}MB — max allowed is 5MB`,
      );
      e.target.value = "";
      return;
    }
    setIsUploadingMemory(true);

    const uploadToast = toast.loading(`Uploading ${file.name}...`);

    try {
      await addMemory({ file, avatarId: id as string });
      toast.loading(`Indexing ${file.name}...`, { id: uploadToast });

      const MAX_POLLS = 30;
      const POLL_INTERVAL = 2000;
      let pollCount = 0;
      let indexingComplete = false;

      while (pollCount < MAX_POLLS && !indexingComplete) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        pollCount++;

        const vaultData = await getVault();
        setVault(vaultData);

        const uploaded = [...(vaultData?.files || [])]
          .reverse()
          .find((f: any) => f.fileName === file.name);

        if (!uploaded) continue;

        if ((uploaded as any).indexError) {
          toast.error(`Indexing failed: ${(uploaded as any).indexError}`, {
            id: uploadToast,
            duration: 6000,
          });
          indexingComplete = true;
          break;
        }

        if (uploaded.isIndexed) {
          toast.success(`${file.name} indexed successfully`, {
            id: uploadToast,
          });
          indexingComplete = true;
          break;
        }
      }

      if (!indexingComplete) {
        toast.error(
          `Indexing is taking unusually long. Check backend terminal for errors.`,
          { id: uploadToast, duration: 8000 },
        );
        const finalVault = await getVault();
        setVault(finalVault);
      }
    } catch (err: any) {
      console.error("[handleMemoryUpload] Failed:", err);
      toast.error(`Upload failed: ${err?.message || "unknown error"}`, {
        id: uploadToast,
      });
    } finally {
      setIsUploadingMemory(false);
    }
  };

  const handleSyncBio = async () => {
    const tid = toast.loading("Saving bio...");
    try {
      await addMemory({ neuralBio });
      toast.success("Bio updated", { id: tid });
    } catch (err) {
      toast.error("Save failed", { id: tid });
    }
  };

  const handleSaveNote = async () => {
    const trimmedTitle = noteTitle.trim();
    const trimmedBody = noteBody.trim();
    if (!trimmedBody) {
      toast.error("Note body is empty");
      return;
    }

    setIsSavingNote(true);
    const tid = toast.loading("Saving note...");

    try {
      const safeTitle =
        (trimmedTitle || `Note_${new Date().toISOString().slice(0, 10)}`)
          .replace(/[^a-z0-9_-]+/gi, "_")
          .slice(0, 60) + ".txt";

      const fullText = trimmedTitle
        ? `${trimmedTitle}\n${"=".repeat(trimmedTitle.length)}\n\n${trimmedBody}`
        : trimmedBody;

      const blob = new Blob([fullText], { type: "text/plain" });
      const noteFile = new File([blob], safeTitle, { type: "text/plain" });

      await addMemory({ file: noteFile, avatarId: id as string });

      const fresh = await getVault();
      setVault(fresh);

      setNoteTitle("");
      setNoteBody("");
      toast.success("Note saved to memory vault", { id: tid });
    } catch (err: any) {
      console.error("[handleSaveNote] Failed:", err);
      toast.error(`Save failed: ${err?.message || "unknown"}`, { id: tid });
    } finally {
      setIsSavingNote(false);
    }
  };

  if (loading || !avatar)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );

  const hasMouthCalibration = !!avatar.mouthCoords;
  const needsCalibration = !!avatar.heroImageUrl && !hasMouthCalibration;

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 selection:bg-primary/30">
      <div className="max-w-7xl mx-auto p-4 md:p-12 space-y-8">
        {/* HEADER */}
        <header className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <Link
                href="/avatars"
                className="hud-label flex items-center gap-2 text-foreground-subtle hover:text-foreground mb-2 transition-colors"
              >
                <ChevronLeft size={16} /> Back to Dashboard
              </Link>
              <h1 className="hud-title text-3xl md:text-4xl text-foreground normal-case tracking-tight">
                Settings for <span className="text-primary">{avatar.name}</span>
              </h1>
            </div>

            {avatar.status === "ready" && (
              <Link
                href={`/avatars/${avatar._id}/chat`}
                className="flex items-center justify-center gap-2 bg-primary text-background px-8 py-3 rounded-[8px] font-bold text-sm hover:brightness-110 transition-all"
              >
                <MessageSquare size={18} /> Chat with {avatar.name}
              </Link>
            )}
          </div>

          <div className="flex bg-surface-elevated p-1 rounded-[10px] border border-border self-start">
            <button
              onClick={() => setActiveTab("appearance")}
              className={`hud-label flex items-center gap-2 px-6 py-2 rounded-[8px] transition-all ${activeTab === "appearance" ? "bg-deep text-primary" : "text-foreground-subtle hover:text-foreground"}`}
            >
              <User size={14} /> Face & Voice
            </button>
            <button
              onClick={() => setActiveTab("personality")}
              className={`hud-label flex items-center gap-2 px-6 py-2 rounded-[8px] transition-all ${activeTab === "personality" ? "bg-deep text-primary" : "text-foreground-subtle hover:text-foreground"}`}
            >
              <Brain size={14} /> Personality & Knowledge
            </button>
          </div>
        </header>

        {calibrationError && (
          <div className="bg-error/10 border border-error/40 rounded-[8px] p-4 flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="text-error flex-shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <p className="hud-label text-error mb-1">
                Mouth Calibration Error
              </p>
              <p className="text-sm text-error/80 font-mono break-all">
                {calibrationError}
              </p>
            </div>
            <button
              onClick={() => setCalibrationError(null)}
              className="text-error hover:text-error/70"
            >
              <X size={16} />
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          {activeTab === "appearance" ? (
            <motion.div
              key="phys"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              <div className="lg:col-span-8 space-y-8">
                {/* Visuals Section */}
                <section className="bg-surface-elevated border border-border rounded-[8px] p-6 md:p-8">
                  <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                    <h3 className="hud-title text-lg text-foreground normal-case">
                      Photo Library
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {needsCalibration && (
                        <button
                          onClick={() => calibrateMouth()}
                          disabled={isCalibrating}
                          className="hud-label flex items-center gap-2 bg-deep hover:brightness-125 text-primary px-4 py-2 rounded-[6px] border border-primary/30 transition-all disabled:opacity-40"
                        >
                          {isCalibrating ? (
                            <>
                              <Loader2 size={14} className="animate-spin" />
                              Calibrating...
                            </>
                          ) : (
                            <>
                              <Target size={14} /> Calibrate Mouth
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => setCaptureMode("photo")}
                        className="hud-label flex items-center gap-2 bg-surface hover:bg-border/30 px-4 py-2 rounded-[6px] border border-border transition-all text-foreground-muted"
                      >
                        <Camera size={14} /> Take Photo
                      </button>

                      <button
                        onClick={() => setCaptureMode("video")}
                        className="hud-label flex items-center gap-2 bg-surface hover:bg-border/30 px-4 py-2 rounded-[6px] border border-border transition-all text-foreground-muted"
                      >
                        <Video size={14} /> Record Video
                      </button>

                      <label className="hud-label cursor-pointer bg-surface hover:bg-border/30 px-4 py-2 rounded-[6px] border border-border transition-all text-foreground-muted">
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleFileSelection(e, "photo")}
                        />
                        Upload Photos
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {photoPreviews.map((url, i) => (
                      <div
                        key={i}
                        className="aspect-square rounded-[8px] border-2 border-primary/50 relative overflow-hidden"
                      >
                        <img
                          src={url}
                          className="w-full h-full object-cover opacity-50"
                        />
                        <div className="hud-label absolute inset-0 flex items-center justify-center bg-background/50 text-foreground text-center px-2">
                          Waiting for Save
                        </div>
                      </div>
                    ))}
                    {avatar.photoUrls.map((url, i) => {
                      const isHero = avatar.heroImageUrl === url;
                      return (
                        <div
                          key={i}
                          className="aspect-square rounded-[8px] border border-border overflow-hidden relative group"
                        >
                          <img
                            src={getAssetUrl(url)}
                            className={`w-full h-full object-cover transition-all ${isHero ? "ring-4 ring-primary" : "opacity-60 group-hover:opacity-100"}`}
                          />

                          {isHero && hasMouthCalibration && (
                            <div
                              className="absolute top-2 left-2 bg-primary text-background rounded-full p-1"
                              title="Mouth anchor calibrated"
                            >
                              <Target size={12} strokeWidth={3} />
                            </div>
                          )}

                          {isHero && needsCalibration && !isCalibrating && (
                            <div
                              className="absolute top-2 left-2 bg-warning text-background rounded-full p-1 animate-pulse"
                              title="Mouth not calibrated — click Calibrate Mouth button above"
                            >
                              <AlertTriangle size={12} strokeWidth={3} />
                            </div>
                          )}

                          {isHero && isCalibrating && (
                            <div className="absolute inset-0 bg-primary/10 border-2 border-primary animate-pulse flex items-center justify-center">
                              <span className="hud-label text-primary">
                                Calibrating...
                              </span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-background/70 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                            <button
                              onClick={(e) => handleSetHero(e, url)}
                              title="Set as hero + calibrate mouth"
                              disabled={isCalibrating}
                              className={`p-2 rounded-full disabled:opacity-40 ${isHero ? "bg-primary text-background" : "bg-surface-elevated"}`}
                            >
                              <Star size={16} />
                            </button>

                            {isHero && (
                              <button
                                onClick={() => calibrateMouth()}
                                title="Re-calibrate mouth anchor"
                                disabled={isCalibrating}
                                className="p-2 rounded-full bg-info text-background disabled:opacity-40"
                              >
                                <Target size={16} />
                              </button>
                            )}

                            <button
                              onClick={(e) =>
                                handleRemoveAsset(e, url, "photo")
                              }
                              className="p-2 bg-error rounded-full text-background"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Voice Section */}
                <section className="bg-surface-elevated border border-border rounded-[8px] p-6 md:p-8">
                  <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
                    <h3 className="hud-title text-lg text-foreground normal-case">
                      Voice Samples
                    </h3>
                    <button
                      onClick={() => setCaptureMode("audio")}
                      className="hud-label flex items-center gap-2 bg-surface hover:bg-border/30 px-4 py-2 rounded-[6px] border border-border transition-all text-foreground-muted"
                    >
                      <Mic size={14} /> Record Audio
                    </button>
                  </div>

                  <div className="space-y-4">
                    <label className="w-full py-12 border-2 border-dashed border-border rounded-[8px] flex flex-col items-center justify-center cursor-pointer hover:bg-surface transition-all">
                      <Mic size={24} className="text-primary mb-2" />
                      <span className="text-sm font-bold text-foreground-muted">
                        Click to upload voice recordings
                      </span>
                      <span className="hud-label mt-1 normal-case tracking-normal text-foreground-subtle">
                        For best Italian voice cloning: upload 1–3 minutes of
                        clean speech
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="audio/*"
                        className="hidden"
                        onChange={(e) => handleFileSelection(e, "voice")}
                      />
                    </label>
                    {selectedVoices.map((f, i) => (
                      <div
                        key={i}
                        className="p-4 bg-deep/40 border border-primary/25 rounded-[8px] text-xs flex justify-between items-center"
                      >
                        <span className="text-primary font-bold truncate mr-3">
                          {f.name} (Ready to upload)
                        </span>
                        <X
                          size={16}
                          className="cursor-pointer flex-shrink-0 text-foreground-muted hover:text-foreground"
                          onClick={() =>
                            setSelectedVoices((v) =>
                              v.filter((_, idx) => idx !== i),
                            )
                          }
                        />
                      </div>
                    ))}
                    {avatar.voiceSampleUrls.map((url, i) => (
                      <div
                        key={i}
                        className="p-4 bg-surface border border-border rounded-[8px] flex justify-between items-center group gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <span className="hud-label block mb-2">
                            Recording_Sample_{i + 1}
                          </span>
                          <audio
                            controls
                            src={getAssetUrl(url)}
                            className="w-full h-8"
                            style={{ maxWidth: "100%" }}
                          />
                        </div>
                        <Trash2
                          size={16}
                          className="text-error cursor-pointer flex-shrink-0"
                          onClick={(e) => handleRemoveAsset(e, url, "voice")}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Sidebar Checklist */}
              <div className="lg:col-span-4">
                <div className="bg-surface-elevated border border-border rounded-[8px] p-8 sticky top-8">
                  <h3 className="hud-title text-xl text-foreground normal-case mb-6">
                    Setup Progress
                  </h3>
                  <div className="space-y-6">
                    <RequirementRow
                      label="Photos Uploaded"
                      met={avatar.photoUrls.length >= 1}
                      count={`${avatar.photoUrls.length}/1`}
                    />
                    <RequirementRow
                      label="Hero Face Selected"
                      met={!!avatar.heroImageUrl}
                      count={avatar.heroImageUrl ? "✓" : "—"}
                    />
                    <RequirementRow
                      label="Mouth Calibrated"
                      met={hasMouthCalibration}
                      count={hasMouthCalibration ? "✓" : "—"}
                    />
                    <RequirementRow
                      label="Voice Samples"
                      met={avatar.voiceSampleUrls.length >= 1}
                      count={`${avatar.voiceSampleUrls.length}/1`}
                    />
                  </div>

                  {(avatar.photoUrls.length < 1 ||
                    avatar.voiceSampleUrls.length < 1) && (
                    <div className="mt-6 p-3 bg-info/10 border border-info/25 rounded-[6px] text-[11px] text-info leading-relaxed">
                      <strong className="block mb-1 text-info">
                        Why is chat locked?
                      </strong>
                      You need at least 1 photo AND 1 voice sample saved before
                      you can connect the AI. Use the buttons on the left to add
                      them.
                    </div>
                  )}

                  {needsCalibration && (
                    <button
                      onClick={() => calibrateMouth()}
                      disabled={isCalibrating}
                      className="w-full mt-6 py-3 bg-warning/15 hover:bg-warning/25 border border-warning/50 rounded-[8px] text-xs font-bold text-warning transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {isCalibrating ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Calibrating Mouth...
                        </>
                      ) : (
                        <>
                          <Target size={14} /> Calibrate Mouth Now
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={handleSyncAssets}
                    disabled={
                      isSyncing ||
                      (selectedPhotos.length === 0 &&
                        selectedVoices.length === 0)
                    }
                    className="w-full mt-3 py-3 bg-info hover:brightness-110 disabled:opacity-30 text-background rounded-[8px] text-xs font-bold transition-all"
                  >
                    {isSyncing ? "Saving..." : "Save Uploaded Files"}
                  </button>
                  <button
                    onClick={handleExecuteSync}
                    disabled={
                      avatar.status === "training" ||
                      avatar.photoUrls.length < 1 ||
                      avatar.voiceSampleUrls.length < 1
                    }
                    className="w-full mt-3 py-4 bg-primary text-background font-bold text-sm rounded-[8px] hover:brightness-110 disabled:opacity-20 transition-all"
                  >
                    {avatar.status === "training" ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="animate-spin" size={16} /> Syncing
                        AI...
                      </div>
                    ) : (
                      "Connect AI Voice & Video"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="memo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-8"
            >
              {/* Bio Section */}
              <div className="bg-surface-elevated border border-border rounded-[8px] p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="hud-title text-lg text-foreground normal-case">
                    About this AI
                  </h3>
                  <button
                    onClick={handleSyncBio}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Save Changes
                  </button>
                </div>
                <textarea
                  value={neuralBio}
                  onChange={(e) => setNeuralBio(e.target.value)}
                  className="w-full bg-background border border-border rounded-[8px] p-4 text-sm h-32 outline-none focus:border-primary/60 transition-all text-foreground"
                  placeholder="Describe who this person is, how they speak, and their background..."
                />
              </div>

              {/* Quick Note */}
              <div className="bg-surface-elevated border border-border rounded-[8px] p-6 md:p-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="hud-title text-lg text-foreground normal-case flex items-center gap-2">
                    <PenLine size={18} className="text-primary" />
                    Quick Note
                  </h3>
                  <span className="hud-label">Saved to Memory Vault</span>
                </div>
                <p className="text-xs text-foreground-subtle mb-4 leading-relaxed">
                  Write a memory, fact, or context note directly. It will be
                  indexed and searchable in chat — no file upload needed.
                </p>
                <input
                  type="text"
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  className="w-full bg-background border border-border rounded-[8px] p-3 text-sm mb-3 outline-none focus:border-primary/60 transition-all text-foreground"
                  placeholder="Note title (optional)"
                  disabled={isSavingNote}
                />
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  className="w-full bg-background border border-border rounded-[8px] p-4 text-sm h-32 outline-none focus:border-primary/60 transition-all text-foreground"
                  placeholder="Write your note here..."
                  disabled={isSavingNote}
                />
                <div className="flex justify-between items-center mt-3">
                  <span className="text-[10px] text-foreground-subtle">
                    {noteBody.length} characters
                  </span>
                  <button
                    onClick={handleSaveNote}
                    disabled={isSavingNote || !noteBody.trim()}
                    className="bg-primary text-background px-5 py-2 rounded-[8px] text-xs font-bold flex items-center gap-2 disabled:opacity-30 transition-all"
                  >
                    {isSavingNote ? (
                      <>
                        <Loader2 size={14} className="animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Check size={14} /> Save Note
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Documents Section */}
              <div className="bg-surface-elevated border border-border rounded-[8px] overflow-hidden">
                <div className="p-6 md:p-8 border-b border-border flex justify-between items-center">
                  <h3 className="hud-title text-lg text-foreground normal-case">
                    Knowledge Documents
                  </h3>
                  <label className="cursor-pointer bg-primary text-background px-5 py-2 rounded-[8px] text-xs font-bold flex items-center gap-2">
                    <Plus size={16} />{" "}
                    {isUploadingMemory ? "Uploading..." : "Add Document"}
                    <input
                      type="file"
                      className="hidden"
                      onChange={handleMemoryUpload}
                    />
                  </label>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="hud-label bg-background/40">
                      <tr>
                        <th className="px-8 py-4">File Name</th>
                        <th className="px-8 py-4">Status</th>
                        <th className="px-8 py-4 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-divider">
                      {vault?.files
                        .filter((f: any) => f.avatarId === id || !f.avatarId)
                        .map((file: any) => (
                          <tr
                            key={file._id}
                            className="group hover:bg-surface/50"
                          >
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <FileText
                                  size={18}
                                  className="text-foreground-muted"
                                />
                                <span className="text-sm font-medium text-foreground">
                                  {file.fileName}
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-5 text-xs">
                              {file.isIndexed ? (
                                <span className="text-primary flex items-center gap-1">
                                  <CheckCircle size={14} /> Learned
                                </span>
                              ) : (
                                <span className="text-warning animate-pulse">
                                  Reading...
                                </span>
                              )}
                            </td>
                            <td className="px-8 py-5 text-right">
                              <button
                                onClick={() =>
                                  deleteMemoryFile(file._id).then(
                                    loadInitialData,
                                  )
                                }
                                className="p-2 text-error/60 hover:text-error"
                              >
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {captureMode && (
          <CaptureStudio
            mode={captureMode}
            onCancel={() => setCaptureMode(null)}
            onCapture={handleCapturedFile}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

const RequirementRow = ({
  label,
  met,
  count,
}: {
  label: string;
  met: boolean;
  count: string;
}) => (
  <div className="space-y-2">
    <div className="flex justify-between items-center">
      <span
        className={`hud-label ${met ? "text-foreground" : "text-foreground-subtle"}`}
      >
        {label}
      </span>
      <span
        className={`hud-metric text-sm ${met ? "text-primary" : "text-foreground-subtle"}`}
      >
        {count}
      </span>
    </div>
    <div className="h-2 w-full bg-border/30 rounded-full overflow-hidden">
      <motion.div
        animate={{ width: met ? "100%" : "15%" }}
        className={`h-full ${met ? "bg-primary" : "bg-border"}`}
      />
    </div>
  </div>
);
const CaptureStudio: React.FC<{
  mode: "photo" | "video" | "audio";
  onCancel: () => void;
  onCapture: (file: File, kind: "photo" | "voice") => void;
}> = ({ mode, onCancel, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordedVideoBlobRef = useRef<Blob | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animRef = useRef<number | null>(null);

  const [ready, setReady] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [videoFramePreview, setVideoFramePreview] = useState<string | null>(
    null,
  );
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState<Blob | null>(null);

  const MAX_VIDEO_SEC = 15;
  const MAX_AUDIO_SEC = 120;

  useEffect(() => {
    let cancelled = false;

    const setup = async () => {
      try {
        if (
          typeof navigator === "undefined" ||
          !navigator.mediaDevices?.getUserMedia
        ) {
          throw new Error(
            "Your browser does not support camera/mic access. Try Chrome, Safari, or Edge.",
          );
        }

        const constraints: MediaStreamConstraints =
          mode === "audio"
            ? { audio: true }
            : {
                video: {
                  facingMode: "user",
                  width: { ideal: 1280 },
                  height: { ideal: 720 },
                },
                audio: mode === "video",
              };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        if (mode !== "audio") {
          // Poll for the ref instead of assuming it's attached the instant
          // this effect runs — guards against any render-order edge case
          // where the <video> tag hasn't committed to the DOM yet.
          let attempts = 0;
          while (!videoRef.current && attempts < 50) {
            await new Promise((r) => setTimeout(r, 20));
            attempts++;
          }

          const video = videoRef.current;
          if (!video) {
            throw new Error(
              "Video element failed to mount. Please close and retry.",
            );
          }

          video.srcObject = stream;

          await new Promise<void>((resolve) => {
            let settled = false;
            const markReady = () => {
              if (settled) return;
              settled = true;
              resolve();
            };
            video.onloadedmetadata = markReady;
            if (video.readyState >= 1) markReady(); // metadata already loaded
            setTimeout(markReady, 1500); // fallback
          });

          await video.play().catch(() => {});
        }

        if (mode === "audio") {
          try {
            const AudioCtx =
              (window as any).AudioContext ||
              (window as any).webkitAudioContext;
            const ctx = new AudioCtx();
            audioCtxRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const data = new Uint8Array(analyser.frequencyBinCount);
            const tick = () => {
              analyser.getByteTimeDomainData(data);
              let sumSq = 0;
              for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                sumSq += v * v;
              }
              setAudioLevel(Math.min(1, Math.sqrt(sumSq / data.length) * 3));
              animRef.current = requestAnimationFrame(tick);
            };
            tick();
          } catch (e) {
            console.warn("[CaptureStudio] Audio meter setup failed:", e);
          }
        }

        if (!cancelled) setReady(true);
      } catch (err: any) {
        console.error("[CaptureStudio] getUserMedia failed:", err);
        const msg =
          err?.name === "NotAllowedError"
            ? "Permission denied. Allow camera/mic access in your browser settings."
            : err?.name === "NotFoundError"
              ? "No camera or microphone found on this device."
              : err?.message || "Could not access your camera or microphone.";
        if (!cancelled) setSetupError(msg);
      }
    };

    setup();

    return () => {
      cancelled = true;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setElapsed((e) => {
        const next = e + 1;
        const limit = mode === "video" ? MAX_VIDEO_SEC : MAX_AUDIO_SEC;
        if (next >= limit) stopRecording();
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, mode]);

  const cleanup = () => {
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      toast.error("Camera not ready yet — try again in a moment");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhotoPreview(canvas.toDataURL("image/jpeg", 0.92));
  };

  const confirmPhoto = () => {
    if (!photoPreview) return;
    onCapture(
      dataURLtoFile(photoPreview, `capture_${Date.now()}.jpg`, "image/jpeg"),
      "photo",
    );
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeOptions = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];
    let chosen = "";
    for (const m of mimeOptions)
      if (MediaRecorder.isTypeSupported(m)) {
        chosen = m;
        break;
      }
    const rec = chosen
      ? new MediaRecorder(streamRef.current, { mimeType: chosen })
      : new MediaRecorder(streamRef.current);
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = async () => {
      const blob = new Blob(chunksRef.current, {
        type: chosen || "video/webm",
      });
      recordedVideoBlobRef.current = blob;
      const frameDataUrl = await extractMiddleFrame(blob);
      if (frameDataUrl) setVideoFramePreview(frameDataUrl);
      else toast.error("Could not extract a frame from the video");
    };
    recorderRef.current = rec;
    rec.start();
    setElapsed(0);
    setIsRecording(true);
  };

  const startAudioRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeOptions = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    let chosen = "";
    for (const m of mimeOptions)
      if (MediaRecorder.isTypeSupported(m)) {
        chosen = m;
        break;
      }
    const rec = chosen
      ? new MediaRecorder(streamRef.current, { mimeType: chosen })
      : new MediaRecorder(streamRef.current);
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: chosen || "audio/webm",
      });
      setRecordedAudioBlob(blob);
      setAudioPreview(URL.createObjectURL(blob));
    };
    recorderRef.current = rec;
    rec.start();
    setElapsed(0);
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive")
      recorderRef.current.stop();
    setIsRecording(false);
  };

  const extractMiddleFrame = (blob: Blob): Promise<string | null> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const v = document.createElement("video");
      v.src = url;
      v.muted = true;
      v.playsInline = true;
      v.crossOrigin = "anonymous";
      v.onloadedmetadata = () => {
        v.currentTime =
          isFinite(v.duration) && v.duration > 0 ? v.duration / 2 : 0.1;
      };
      v.onseeked = () => {
        const c = document.createElement("canvas");
        c.width = v.videoWidth || 1280;
        c.height = v.videoHeight || 720;
        const ctx = c.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }
        ctx.drawImage(v, 0, 0, c.width, c.height);
        const dataUrl = c.toDataURL("image/jpeg", 0.92);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      };
      v.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
    });
  };

  const confirmVideoFrame = () => {
    if (!videoFramePreview) return;
    onCapture(
      dataURLtoFile(
        videoFramePreview,
        `capture_${Date.now()}.jpg`,
        "image/jpeg",
      ),
      "photo",
    );
  };

  const confirmAudio = () => {
    if (!recordedAudioBlob) return;
    const ext = recordedAudioBlob.type.includes("mp4")
      ? "mp4"
      : recordedAudioBlob.type.includes("ogg")
        ? "ogg"
        : "webm";
    onCapture(
      new File([recordedAudioBlob], `recording_${Date.now()}.${ext}`, {
        type: recordedAudioBlob.type,
      }),
      "voice",
    );
  };

  const resetPreview = () => {
    setPhotoPreview(null);
    setVideoFramePreview(null);
    setAudioPreview(null);
    setRecordedAudioBlob(null);
    setElapsed(0);
  };

  const title =
    mode === "photo"
      ? "Take Photo"
      : mode === "video"
        ? "Record Video"
        : "Record Audio";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-overlay backdrop-blur-md flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-surface-elevated border border-border rounded-[10px] max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="hud-title text-base text-foreground normal-case flex items-center gap-2">
            {mode === "photo" && <Camera size={18} className="text-primary" />}
            {mode === "video" && <Video size={18} className="text-primary" />}
            {mode === "audio" && <Mic size={18} className="text-primary" />}
            {title}
          </h3>
          <button
            onClick={onCancel}
            className="text-foreground-subtle hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {setupError && (
            <div className="bg-error/10 border border-error/40 rounded-[8px] p-4 flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="text-error flex-shrink-0 mt-0.5"
              />
              <p className="text-sm text-error/90">{setupError}</p>
            </div>
          )}

          {/* PHOTO — video element ALWAYS mounted whenever mode is photo, regardless of setupError/ready */}
          {mode === "photo" && !setupError && (
            <>
              {!photoPreview ? (
                <>
                  <div className="relative aspect-video bg-black rounded-[8px] overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    {!ready && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70">
                        <Loader2
                          className="animate-spin text-primary"
                          size={28}
                        />
                        <span className="text-xs text-foreground-muted">
                          Starting camera...
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={snapPhoto}
                      disabled={!ready}
                      className="flex items-center gap-2 bg-primary text-background px-6 py-3 rounded-[8px] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Camera size={16} /> Capture
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="aspect-video bg-black rounded-[8px] overflow-hidden">
                    <img
                      src={photoPreview}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={resetPreview}
                      className="flex items-center gap-2 bg-surface hover:bg-border/30 px-5 py-3 rounded-[8px] text-xs font-bold border border-border text-foreground-muted"
                    >
                      <RotateCcw size={14} /> Retake
                    </button>
                    <button
                      onClick={confirmPhoto}
                      className="flex items-center gap-2 bg-primary text-background px-6 py-3 rounded-[8px] font-bold text-sm hover:brightness-110 transition-all"
                    >
                      <Check size={16} /> Use Photo
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* VIDEO — same always-mounted treatment */}
          {mode === "video" && !setupError && (
            <>
              {!videoFramePreview ? (
                <>
                  <div className="relative aspect-video bg-black rounded-[8px] overflow-hidden">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                      style={{ transform: "scaleX(-1)" }}
                    />
                    {!ready && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70">
                        <Loader2
                          className="animate-spin text-primary"
                          size={28}
                        />
                        <span className="text-xs text-foreground-muted">
                          Starting camera...
                        </span>
                      </div>
                    )}
                    {isRecording && (
                      <div className="absolute top-3 left-3 flex items-center gap-2 bg-error/90 text-white px-3 py-1 rounded-full text-xs font-bold">
                        <Circle size={8} className="fill-white animate-pulse" />
                        REC {elapsed}s / {MAX_VIDEO_SEC}s
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-foreground-subtle text-center">
                    Record up to {MAX_VIDEO_SEC}s. We'll extract the best middle
                    frame as your photo.
                  </p>
                  <div className="flex justify-center gap-3">
                    {!isRecording ? (
                      <button
                        onClick={startVideoRecording}
                        disabled={!ready}
                        className="flex items-center gap-2 bg-error text-white px-6 py-3 rounded-[8px] font-bold text-sm hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Circle size={14} className="fill-white" /> Start
                        Recording
                      </button>
                    ) : (
                      <button
                        onClick={stopRecording}
                        className="flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-[8px] font-bold text-sm hover:brightness-110 transition-all"
                      >
                        <Square size={14} className="fill-background" /> Stop
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="aspect-video bg-black rounded-[8px] overflow-hidden">
                    <img
                      src={videoFramePreview}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <p className="text-xs text-foreground-subtle text-center">
                    Extracted frame from the middle of your recording.
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={resetPreview}
                      className="flex items-center gap-2 bg-surface hover:bg-border/30 px-5 py-3 rounded-[8px] text-xs font-bold border border-border text-foreground-muted"
                    >
                      <RotateCcw size={14} /> Retake
                    </button>
                    <button
                      onClick={confirmVideoFrame}
                      className="flex items-center gap-2 bg-primary text-background px-6 py-3 rounded-[8px] font-bold text-sm hover:brightness-110 transition-all"
                    >
                      <Check size={16} /> Use Frame
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {/* AUDIO — no video element, safe to gate fully */}
          {mode === "audio" &&
            !setupError &&
            (!ready ? (
              <div className="aspect-video flex items-center justify-center bg-background rounded-[8px]">
                <Loader2 className="animate-spin text-primary" size={32} />
              </div>
            ) : (
              <>
                {!audioPreview ? (
                  <>
                    <div className="aspect-video bg-black rounded-[8px] flex flex-col items-center justify-center gap-6 p-8">
                      <div className="relative">
                        <div
                          className="absolute inset-0 rounded-full bg-primary/30 transition-all"
                          style={{
                            transform: `scale(${1 + audioLevel * 1.5})`,
                            opacity: 0.4 + audioLevel * 0.6,
                          }}
                        />
                        <div
                          className={`relative w-24 h-24 rounded-full flex items-center justify-center ${isRecording ? "bg-error" : "bg-deep border-2 border-primary/40"}`}
                        >
                          <Mic
                            size={40}
                            className={
                              isRecording ? "text-white" : "text-primary"
                            }
                          />
                        </div>
                      </div>
                      {isRecording && (
                        <div className="text-center">
                          <p className="hud-metric text-2xl text-foreground">
                            {Math.floor(elapsed / 60)}:
                            {(elapsed % 60).toString().padStart(2, "0")}
                          </p>
                          <p className="text-xs text-foreground-subtle mt-1">
                            Max {MAX_AUDIO_SEC / 60}:00
                          </p>
                        </div>
                      )}
                      {!isRecording && (
                        <p className="text-xs text-foreground-subtle text-center max-w-sm">
                          Speak naturally for 1–3 minutes. For best Italian
                          voice cloning, read a paragraph aloud in Italian.
                        </p>
                      )}
                    </div>
                    <div className="flex justify-center gap-3">
                      {!isRecording ? (
                        <button
                          onClick={startAudioRecording}
                          className="flex items-center gap-2 bg-error text-white px-6 py-3 rounded-[8px] font-bold text-sm hover:brightness-110 transition-all"
                        >
                          <Circle size={14} className="fill-white" /> Start
                          Recording
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="flex items-center gap-2 bg-foreground text-background px-6 py-3 rounded-[8px] font-bold text-sm hover:brightness-110 transition-all"
                        >
                          <Square size={14} className="fill-background" /> Stop
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="aspect-video bg-black rounded-[8px] flex flex-col items-center justify-center gap-4 p-8">
                      <div className="w-24 h-24 rounded-full bg-deep border-2 border-primary/40 flex items-center justify-center">
                        <Mic size={40} className="text-primary" />
                      </div>
                      <audio
                        controls
                        src={audioPreview}
                        className="w-full max-w-md"
                      />
                      <p className="text-xs text-foreground-subtle">
                        Duration: {elapsed}s
                      </p>
                    </div>
                    <div className="flex justify-center gap-3">
                      <button
                        onClick={resetPreview}
                        className="flex items-center gap-2 bg-surface hover:bg-border/30 px-5 py-3 rounded-[8px] text-xs font-bold border border-border text-foreground-muted"
                      >
                        <RotateCcw size={14} /> Re-record
                      </button>
                      <button
                        onClick={confirmAudio}
                        className="flex items-center gap-2 bg-primary text-background px-6 py-3 rounded-[8px] font-bold text-sm hover:brightness-110 transition-all"
                      >
                        <Check size={16} /> Use Recording
                      </button>
                    </div>
                  </>
                )}
              </>
            ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

const dataURLtoFile = (
  dataUrl: string,
  filename: string,
  mime: string,
): File => {
  const arr = dataUrl.split(",");
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8 = new Uint8Array(n);
  while (n--) u8[n] = bstr.charCodeAt(n);
  return new File([u8], filename, { type: mime });
};

export default AvatarLab;
