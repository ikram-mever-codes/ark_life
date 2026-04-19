"use client";

import React, { useEffect, useState, useCallback } from "react";
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

  const loadInitialData = useCallback(async () => {
    try {
      const [avatarData, vaultData] = await Promise.all([
        getAvatarById(id as string),
        getVault(),
      ]);
      setAvatar(avatarData);
      setVault(vaultData);
      if (vaultData.neuralBio) setNeuralBio(vaultData.neuralBio);

      // Debug: log full avatar shape on load so we see what the backend returns
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

  // ── Pre-warm face-api.js models ──
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

  /**
   * CALIBRATE MOUTH — Core detection + persist logic.
   *
   * Standalone function so it can be called from:
   *   - Auto-run after upload (if hero exists but no coords yet)
   *   - Manual "Calibrate Mouth" button on the hero photo
   *   - handleSetHero when user explicitly changes the hero
   *
   * Exposes errors via both toast and on-screen banner so you can see
   * exactly what failed without needing to open DevTools.
   */
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

      // Validate coords
      const valid = [coords.x, coords.y, coords.width, coords.height].every(
        (v) => typeof v === "number" && v >= 0 && v <= 1 && !isNaN(v),
      );
      if (!valid) {
        throw new Error(
          `Detector returned invalid coords: ${JSON.stringify(coords)}`,
        );
      }

      // Post to backend
      console.log("[calibrateMouth] Posting coords to backend...");
      const saveResponse = await setAvatarMouthCoords(id as string, coords);
      console.log("[calibrateMouth] Backend save response:", saveResponse);

      // Verify persistence with a fresh fetch
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

  /**
   * SET HERO IMAGE — Sets hero and then kicks off calibration.
   */
  const handleSetHero = async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    try {
      console.log("[handleSetHero] Setting hero image...");
      await setAvatarHeroImage(id as string, url);
      const data = await getAvatarById(id as string);
      setAvatar(data);
      console.log("[handleSetHero] Hero set. URL:", data.heroImageUrl);

      // Calibration runs against the freshly-set avatar state
      if (data.heroImageUrl) {
        // Wait a tick for state to propagate then calibrate
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

  /**
   * SYNC ASSETS — Upload photos/voice, then auto-calibrate if we now have a
   * hero image but no mouth calibration yet.
   *
   * The backend's upload controller auto-sets the first uploaded photo as the
   * hero (via Cloudinary). This means users often never click "Set as Hero"
   * explicitly. We catch that case here by calibrating immediately after upload.
   */
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

      // Auto-calibrate if hero exists but no mouth coords yet
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

  const handleMemoryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingMemory(true);

    const uploadToast = toast.loading(`Uploading ${file.name}...`);

    try {
      // Step 1: Upload
      await addMemory({ file, avatarId: id as string });
      toast.loading(`Indexing ${file.name}...`, { id: uploadToast });

      // Step 2: Poll vault until the new file is indexed (or fails)
      const MAX_POLLS = 30; // 30 polls × 2s = 60s max
      const POLL_INTERVAL = 2000;
      let pollCount = 0;
      let indexingComplete = false;

      while (pollCount < MAX_POLLS && !indexingComplete) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL));
        pollCount++;

        const vaultData = await getVault();
        setVault(vaultData);

        // Find the file we just uploaded (by name + recency)
        const uploaded = [...(vaultData?.files || [])]
          .reverse()
          .find((f: any) => f.fileName === file.name);

        if (!uploaded) continue;

        // Check terminal states
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
        // else: still "Reading..." — keep polling
      }

      if (!indexingComplete) {
        toast.error(
          `Indexing is taking unusually long. Check backend terminal for errors.`,
          { id: uploadToast, duration: 8000 },
        );
        // One more refresh so UI matches reality
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

  if (loading || !avatar)
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );

  const hasMouthCalibration = !!avatar.mouthCoords;
  const needsCalibration = !!avatar.heroImageUrl && !hasMouthCalibration;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 pb-20 selection:bg-primary/30">
      <div className="max-w-7xl mx-auto p-4 md:p-12 space-y-8">
        {/* HEADER */}
        <header className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <Link
                href="/avatars"
                className="flex items-center gap-2 text-gray-500 hover:text-white text-xs font-bold uppercase mb-2"
              >
                <ChevronLeft size={16} /> Back to Dashboard
              </Link>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
                Settings for <span className="text-primary">{avatar.name}</span>
              </h1>
            </div>

            {avatar.status === "ready" && (
              <Link
                href={`/avatars/${avatar._id}/chat`}
                className="flex items-center justify-center gap-2 bg-primary text-black px-8 py-3 rounded-[8px] font-bold text-sm hover:scale-105 transition-all shadow-lg shadow-primary/20"
              >
                <MessageSquare size={18} /> Chat with {avatar.name}
              </Link>
            )}
          </div>

          <div className="flex bg-white/5 p-1 rounded-[10px] border border-white/10 self-start">
            <button
              onClick={() => setActiveTab("appearance")}
              className={`flex items-center gap-2 px-6 py-2 rounded-[8px] text-xs font-bold uppercase transition-all ${activeTab === "appearance" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"}`}
            >
              <User size={14} /> Face & Voice
            </button>
            <button
              onClick={() => setActiveTab("personality")}
              className={`flex items-center gap-2 px-6 py-2 rounded-[8px] text-xs font-bold uppercase transition-all ${activeTab === "personality" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white"}`}
            >
              <Brain size={14} /> Personality & Knowledge
            </button>
          </div>
        </header>

        {/* Calibration error banner — makes failures visible without opening DevTools */}
        {calibrationError && (
          <div className="bg-red-950/50 border border-red-700/50 rounded-[8px] p-4 flex items-start gap-3">
            <AlertTriangle
              size={20}
              className="text-red-400 flex-shrink-0 mt-0.5"
            />
            <div className="flex-1">
              <p className="text-xs font-bold text-red-400 uppercase mb-1">
                Mouth Calibration Error
              </p>
              <p className="text-sm text-red-200 font-mono break-all">
                {calibrationError}
              </p>
            </div>
            <button
              onClick={() => setCalibrationError(null)}
              className="text-red-400 hover:text-red-200"
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
                <section className="bg-[#0d0d12] border border-white/10 rounded-[8px] p-6 md:p-8">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      Photo Library
                    </h3>
                    <div className="flex gap-2">
                      {/* Dedicated "Calibrate Mouth" button — always visible when needed */}
                      {needsCalibration && (
                        <button
                          onClick={() => calibrateMouth()}
                          disabled={isCalibrating}
                          className="flex items-center gap-2 bg-primary/20 hover:bg-primary/30 text-primary px-4 py-2 rounded-[6px] text-xs font-bold border border-primary/30 transition-all disabled:opacity-40"
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
                      <label className="cursor-pointer bg-white/5 hover:bg-white/10 px-4 py-2 rounded-[6px] text-xs font-bold border border-white/10 transition-all">
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
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-[10px] font-bold">
                          Waiting for Save
                        </div>
                      </div>
                    ))}
                    {avatar.photoUrls.map((url, i) => {
                      const isHero = avatar.heroImageUrl === url;
                      return (
                        <div
                          key={i}
                          className="aspect-square rounded-[8px] border border-white/5 overflow-hidden relative group"
                        >
                          <img
                            src={getAssetUrl(url)}
                            className={`w-full h-full object-cover transition-all ${isHero ? "ring-4 ring-primary" : "opacity-60 group-hover:opacity-100"}`}
                          />

                          {/* Calibration indicator on the hero */}
                          {isHero && hasMouthCalibration && (
                            <div
                              className="absolute top-2 left-2 bg-primary/90 text-black rounded-full p-1"
                              title="Mouth anchor calibrated"
                            >
                              <Target size={12} strokeWidth={3} />
                            </div>
                          )}

                          {/* Needs-calibration warning on the hero */}
                          {isHero && needsCalibration && !isCalibrating && (
                            <div
                              className="absolute top-2 left-2 bg-yellow-500/90 text-black rounded-full p-1 animate-pulse"
                              title="Mouth not calibrated — click Calibrate Mouth button above"
                            >
                              <AlertTriangle size={12} strokeWidth={3} />
                            </div>
                          )}

                          {/* Calibration-in-progress shimmer on hero */}
                          {isHero && isCalibrating && (
                            <div className="absolute inset-0 bg-primary/10 border-2 border-primary animate-pulse flex items-center justify-center">
                              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                                Calibrating...
                              </span>
                            </div>
                          )}

                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
                            <button
                              onClick={(e) => handleSetHero(e, url)}
                              title="Set as hero + calibrate mouth"
                              disabled={isCalibrating}
                              className={`p-2 rounded-full disabled:opacity-40 ${isHero ? "bg-primary text-black" : "bg-white/10"}`}
                            >
                              <Star size={16} />
                            </button>

                            {/* Per-photo calibrate button on the hero */}
                            {isHero && (
                              <button
                                onClick={() => calibrateMouth()}
                                title="Re-calibrate mouth anchor"
                                disabled={isCalibrating}
                                className="p-2 rounded-full bg-sky-500/80 text-black disabled:opacity-40"
                              >
                                <Target size={16} />
                              </button>
                            )}

                            <button
                              onClick={(e) =>
                                handleRemoveAsset(e, url, "photo")
                              }
                              className="p-2 bg-red-600 rounded-full"
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
                <section className="bg-[#0d0d12] border border-white/10 rounded-[8px] p-6 md:p-8">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
                    Voice Samples
                  </h3>
                  <div className="space-y-4">
                    <label className="w-full py-12 border-2 border-dashed border-white/10 rounded-[8px] flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                      <Mic size={24} className="text-primary mb-2" />
                      <span className="text-sm font-bold text-gray-400">
                        Click to upload voice recordings
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
                        className="p-4 bg-primary/5 border border-primary/20 rounded-[8px] text-xs flex justify-between"
                      >
                        <span className="text-primary font-bold">
                          {f.name} (Ready to upload)
                        </span>
                        <X
                          size={16}
                          className="cursor-pointer"
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
                        className="p-4 bg-white/5 border border-white/10 rounded-[8px] flex justify-between items-center group"
                      >
                        <span className="text-xs">
                          Recording_Sample_{i + 1}.wav
                        </span>
                        <Trash2
                          size={16}
                          className="text-red-500 cursor-pointer"
                          onClick={(e) => handleRemoveAsset(e, url, "voice")}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              {/* Sidebar Checklist */}
              <div className="lg:col-span-4">
                <div className="bg-[#0d0d12] border border-white/10 rounded-[8px] p-8 sticky top-8">
                  <h3 className="text-xl font-bold text-white mb-6">
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

                  {/* Prominent calibrate button in sidebar when needed */}
                  {needsCalibration && (
                    <button
                      onClick={() => calibrateMouth()}
                      disabled={isCalibrating}
                      className="w-full mt-8 py-3 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/50 rounded-[8px] text-xs font-bold text-yellow-400 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
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
                    className="w-full mt-3 py-3 bg-blue-500 hover:bg-white/20 rounded-[8px] text-xs font-bold transition-all"
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
                    className="w-full mt-3 py-4 bg-primary text-black font-bold text-sm rounded-[8px] hover:brightness-110 disabled:opacity-20 transition-all"
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
              <div className="bg-[#0d0d12] border border-white/10 rounded-[8px] p-6 md:p-8">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-lg font-bold text-white">
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
                  className="w-full bg-black/40 border border-white/10 rounded-[8px] p-4 text-sm h-32 outline-none focus:border-primary/50 transition-all"
                  placeholder="Describe who this person is, how they speak, and their background..."
                />
              </div>

              {/* Documents Section */}
              <div className="bg-[#0d0d12] border border-white/10 rounded-[8px] overflow-hidden">
                <div className="p-6 md:p-8 border-b border-white/10 flex justify-between items-center">
                  <h3 className="text-lg font-bold text-white">
                    Knowledge Documents
                  </h3>
                  <label className="cursor-pointer bg-primary text-black px-5 py-2 rounded-[8px] text-xs font-bold flex items-center gap-2">
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
                    <thead className="text-[10px] text-gray-500 uppercase bg-black/20 font-bold tracking-widest">
                      <tr>
                        <th className="px-8 py-4">File Name</th>
                        <th className="px-8 py-4">Status</th>
                        <th className="px-8 py-4 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {vault?.files
                        .filter((f: any) => f.avatarId === id || !f.avatarId)
                        .map((file: any) => (
                          <tr
                            key={file._id}
                            className="group hover:bg-white/[0.02]"
                          >
                            <td className="px-8 py-5">
                              <div className="flex items-center gap-3">
                                <FileText size={18} className="text-gray-400" />
                                <span className="text-sm font-medium text-white">
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
                                <span className="text-yellow-500 animate-pulse">
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
                                className="p-2 text-red-500/50 hover:text-red-500"
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
    <div className="flex justify-between items-center text-xs font-bold">
      <span className={met ? "text-white" : "text-gray-500"}>{label}</span>
      <span className={met ? "text-primary" : "text-gray-600"}>{count}</span>
    </div>
    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
      <motion.div
        animate={{ width: met ? "100%" : "15%" }}
        className={`h-full ${met ? "bg-primary" : "bg-white/10"}`}
      />
    </div>
  </div>
);

export default AvatarLab;
