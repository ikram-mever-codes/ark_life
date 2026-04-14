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
  Avatar,
} from "@/api/avatars";
import {
  Upload,
  Mic,
  ChevronLeft,
  Zap,
  CheckCircle2,
  Loader2,
  X,
  Dna,
  ArrowRight,
  Trash2,
  Star,
} from "lucide-react";
import { toast } from "react-hot-toast";
import Link from "next/link";

export const getAssetUrl = (localPath: string) => {
  if (!localPath) return "";
  if (localPath.startsWith("http")) return localPath;
  const baseUrl = "http://localhost:8000";
  const relativePath = localPath.split("uploads")[1] || localPath;
  return `${baseUrl}/uploads${relativePath.replace(/\\/g, "/")}`;
};

const AvatarLab = () => {
  const { id } = useParams();
  const router = useRouter();

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<File[]>([]);
  const [selectedVoices, setSelectedVoices] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const loadAvatar = useCallback(async () => {
    try {
      const data = await getAvatarById(id as string);
      setAvatar(data);
    } catch (err) {
      router.push("/avatars");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadAvatar();
  }, [loadAvatar]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (avatar?.status === "training") {
      interval = setInterval(async () => {
        const fresh = await getAvatarById(id as string);
        if (fresh.status === "ready") {
          setAvatar(fresh);
          toast.success("Neural Video Rendered Successfully");
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
    e.stopPropagation();
    try {
      const updatedAvatar = await removeAvatarAsset(id as string, {
        url,
        type,
      });
      setAvatar(updatedAvatar);
      toast.success(`${type === "photo" ? "Visual" : "Vocal"} sample purged`);
    } catch (err) {
      console.error("Removal Error", err);
    }
  };

  const handleSetHero = async (e: React.MouseEvent, url: string) => {
    e.preventDefault();
    e.stopPropagation();
    const tid = toast.loading("Synchronizing Hero Image...");
    try {
      await setAvatarHeroImage(id as string, url);
      await loadAvatar();
      toast.success("Identity Root Updated", { id: tid });
    } catch (err) {
      toast.error("Hero Sync Failed", { id: tid });
    }
  };

  const handleFileSelection = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "photo" | "voice",
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (type === "photo") {
      setSelectedPhotos((prev) => [...prev, ...files]);
      const newPreviews = files.map((file) => URL.createObjectURL(file));
      setPhotoPreviews((prev) => [...prev, ...newPreviews]);
      toast.success(`${files.length} photos staged`);
    } else {
      setSelectedVoices((prev) => [...prev, ...files]);
      toast.success(`${files.length} audio samples staged`);
    }
    e.target.value = "";
  };

  const handleSyncAssets = async () => {
    if (selectedPhotos.length === 0 && selectedVoices.length === 0) return;
    setIsSyncing(true);
    const tid = toast.loading("Injecting DNA to cloud...");
    try {
      await uploadAvatarAssets(id as string, {
        photos: selectedPhotos,
        voiceSamples: selectedVoices,
      });
      setSelectedPhotos([]);
      setSelectedVoices([]);
      setPhotoPreviews([]);
      await loadAvatar();
      toast.success("Identity Matrix Synchronized", { id: tid });
    } catch (err) {
      toast.error("Cloud Injection Failed", { id: tid });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExecuteSync = async () => {
    const tid = toast.loading("Initializing Neural Cloning...");
    try {
      await cloneAvatarVoice(id as string);
      await loadAvatar();
      toast.success("Sync Process Started", { id: tid });
    } catch (err) {
      toast.dismiss(tid);
    }
  };

  const removeStaged = (index: number, type: "photo" | "voice") => {
    if (type === "photo") {
      setSelectedPhotos((prev) => prev.filter((_, i) => i !== index));
      setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    } else {
      setSelectedVoices((prev) => prev.filter((_, i) => i !== index));
    }
  };

  if (loading || !avatar)
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );

  return (
    <div className="min-h-screen bg-[#050505] text-slate-300 relative pb-20">
      <div className="max-w-7xl mx-auto p-6 lg:p-12 relative z-10 space-y-12">
        <header className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div>
            <Link
              href="/avatars"
              className="flex items-center gap-2 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest mb-2"
            >
              <ChevronLeft size={14} /> Exit Laboratory
            </Link>
            <h1 className="text-4xl font-black text-white uppercase italic">
              Neural Synthesis{" "}
              <span className="text-primary">[{avatar.name}]</span>
            </h1>
          </div>

          <button
            onClick={handleSyncAssets}
            disabled={
              isSyncing ||
              (selectedPhotos.length === 0 && selectedVoices.length === 0)
            }
            className="bg-primary text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3 hover:scale-105 transition-all disabled:opacity-20 shadow-[0_0_30px_rgba(34,197,94,0.3)]"
          >
            {isSyncing ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <Zap size={16} />
            )}
            Sync DNA ({selectedPhotos.length + selectedVoices.length})
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            {/* Visual Matrix */}
            <div className="bg-[#0d0d12]/60 border border-white/10 rounded-[2.5rem] p-8">
              <div className="flex items-center gap-3 mb-8">
                <Dna className="text-primary" size={20} />
                <h3 className="text-lg font-bold text-white uppercase">
                  Visual Identity Matrix
                </h3>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <label className="aspect-square rounded-2xl border-2 border-dashed border-white/5 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                  <Upload size={20} className="mb-2" />
                  <span className="text-[8px] font-black uppercase text-gray-500">
                    Inject Frame
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileSelection(e, "photo")}
                  />
                </label>

                {photoPreviews.map((url, i) => (
                  <div
                    key={`pre-${i}`}
                    className="aspect-square rounded-2xl border-2 border-primary/50 overflow-hidden relative"
                  >
                    <img
                      src={url}
                      className="w-full h-full object-cover"
                      alt=""
                    />
                    <button
                      onClick={() => removeStaged(i, "photo")}
                      className="absolute top-1 right-1 bg-red-500 p-1 rounded-md z-30"
                    >
                      <X size={10} className="text-white" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-primary text-[8px] text-black font-bold text-center py-1 uppercase">
                      Staged
                    </div>
                  </div>
                ))}

                {avatar.photoUrls.map((url, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-2xl border border-white/5 overflow-hidden relative group"
                  >
                    <img
                      src={getAssetUrl(url)}
                      className={`w-full h-full object-cover transition-all duration-500 ${avatar.heroImageUrl === url ? "opacity-100 ring-4 ring-primary" : "opacity-40 group-hover:opacity-80"}`}
                      alt=""
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20">
                      <button
                        onClick={(e) => handleSetHero(e, url)}
                        className={`p-3 rounded-full transition-all hover:scale-110 ${avatar.heroImageUrl === url ? "bg-primary text-black" : "bg-white/10 text-white"}`}
                      >
                        <Star
                          size={18}
                          fill={
                            avatar.heroImageUrl === url
                              ? "currentColor"
                              : "none"
                          }
                        />
                      </button>
                      <button
                        onClick={(e) => handleRemoveAsset(e, url, "photo")}
                        className="p-3 bg-red-500 text-white rounded-full hover:scale-110 transition-all shadow-xl"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Vocal Spectrum */}
            <div className="bg-[#0d0d12]/60 border border-white/10 rounded-[2.5rem] p-8">
              <div className="flex items-center gap-3 mb-8">
                <Mic className="text-blue-400" size={20} />
                <h3 className="text-lg font-bold text-white uppercase">
                  Vocal Frequency Spectrum
                </h3>
              </div>
              <div className="space-y-4">
                <label className="w-full py-10 border-2 border-dashed border-white/5 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                  <Upload size={24} className="text-blue-400/50 mb-3" />
                  <input
                    type="file"
                    multiple
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => handleFileSelection(e, "voice")}
                  />
                  <span className="text-[10px] font-black uppercase text-gray-400">
                    Aural Data Injection
                  </span>
                </label>

                {/* SHOW STAGED VOICES */}
                {selectedVoices.map((file, i) => (
                  <div
                    key={`staged-v-${i}`}
                    className="flex items-center justify-between p-4 bg-primary/10 border border-primary/40 rounded-2xl"
                  >
                    <div className="flex items-center gap-3">
                      <Loader2
                        size={14}
                        className="animate-spin text-primary"
                      />
                      <span className="text-[10px] font-mono text-primary italic">
                        {file.name} (Ready to Sync)
                      </span>
                    </div>
                    <button
                      onClick={() => removeStaged(i, "voice")}
                      className="text-red-500 p-1 hover:bg-red-500/10 rounded-full"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}

                {avatar.voiceSampleUrls.map((url, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl group hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={14} className="text-green-500" />
                      <span className="text-[10px] font-mono text-gray-400">
                        Neural_Sample_0{i + 1}.wav
                      </span>
                    </div>
                    <button
                      onClick={(e) => handleRemoveAsset(e, url, "voice")}
                      className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 rounded-full"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="bg-gradient-to-b from-[#111116] to-[#070709] border border-primary/20 rounded-[2.5rem] p-8 shadow-2xl sticky top-8">
              <h3 className="text-xl font-black italic uppercase text-white mb-8 flex items-center gap-2">
                <Zap className="text-primary" size={20} /> Readiness Protocol
              </h3>

              <div className="space-y-6">
                <RequirementRow
                  label="Visual DNA"
                  met={avatar.photoUrls.length >= 1}
                  count={`${avatar.photoUrls.length}/1`}
                />
                <RequirementRow
                  label="Vocal Signature"
                  met={avatar.voiceSampleUrls.length >= 1}
                  count={`${avatar.voiceSampleUrls.length}/1`}
                />
                <RequirementRow
                  label="Neural Link"
                  met={avatar.status === "ready"}
                  count={
                    avatar.status === "training"
                      ? "Syncing..."
                      : avatar.status === "ready"
                        ? "Active"
                        : "Pending"
                  }
                />
              </div>

              <button
                onClick={handleExecuteSync}
                disabled={
                  avatar.status === "training" ||
                  avatar.photoUrls.length < 1 ||
                  avatar.voiceSampleUrls.length < 1
                }
                className="w-full mt-10 py-5 bg-primary text-black font-black uppercase text-xs tracking-widest rounded-2xl hover:brightness-110 active:scale-95 disabled:opacity-20 transition-all shadow-[0_0_40px_rgba(34,197,94,0.2)]"
              >
                {avatar.status === "training" ? (
                  <Loader2 className="animate-spin mx-auto" />
                ) : (
                  "Execute Neural Sync"
                )}
              </button>

              {avatar.status === "ready" && (
                <Link
                  href={`/avatars/${avatar._id}/chat`}
                  className="mt-4 flex items-center justify-center gap-2 text-primary font-bold uppercase text-[10px] hover:underline transition-all"
                >
                  Start Communication <ArrowRight size={14} />
                </Link>
              )}
            </div>
          </div>
        </div>
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
    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
      <span className={met ? "text-white" : "text-gray-600"}>{label}</span>
      <span
        className={met ? "text-primary font-mono" : "text-gray-700 font-mono"}
      >
        {count}
      </span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
      <motion.div
        animate={{ width: met ? "100%" : "20%" }}
        className={`h-full ${met ? "bg-primary" : "bg-red-500/20"}`}
      />
    </div>
  </div>
);

export default AvatarLab;
