"use client";

import React, { useEffect, useState } from "react";
import {
  Plus,
  Users,
  Activity,
  ShieldCheck,
  Zap,
  Settings2,
  X,
  ImageIcon,
  Mic,
  Play,
  Loader2,
} from "lucide-react";
import {
  listAvatars,
  createAvatar,
  deleteAvatar,
  testAvatarSpeech,
  Avatar,
} from "@/api/avatars";
import { toast } from "react-hot-toast";
import Link from "next/link";
import Loading from "@/app/loading";
import { successStyles } from "@/utils/constants";
import { getAssetUrl } from "./[id]/page";

const AvatarsPage = () => {
  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const fetchAvatars = async () => {
    try {
      const data = await listAvatars();
      setAvatars(data);
    } catch (err) {
      console.error("Sync failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAvatars();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Identity name required");

    setIsCreating(true);
    try {
      await createAvatar(form);
      setForm({ name: "", description: "" });
      setShowModal(false);
      fetchAvatars();
    } catch (err: any) {
      // Handled by API
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 lg:p-12 selection:bg-primary selection:text-black">
      <div className="max-w-7xl mx-auto space-y-10">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-[2px] bg-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                Neural Directory
              </span>
            </div>
            <h1 className="text-5xl font-black tracking-tighter italic uppercase leading-none">
              Digital{" "}
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: "1px white" }}
              >
                Twins
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowModal(true)}
              className="bg-primary text-black px-6 py-3 rounded-sm font-black text-[11px] uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]"
            >
              <Plus size={16} strokeWidth={3} /> New Avatar
            </button>
          </div>
        </header>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            icon={<Users size={18} />}
            label="Total Nodes"
            value={avatars.length}
          />
          <StatCard
            icon={<Activity size={18} />}
            label="Syncing"
            value={avatars.filter((a) => a.status === "training").length}
          />
          <StatCard
            icon={<ShieldCheck size={18} />}
            label="Verified"
            value={avatars.filter((a) => a.status === "ready").length}
          />
        </div>

        {/* Grid of Avatars */}
        {avatars.length === 0 ? (
          <div className="py-20 text-center border border-dashed border-white/5 rounded-3xl">
            <p className="text-white/20 uppercase tracking-[0.4em] text-[10px] font-bold">
              No Neural Nodes Detected
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {avatars.map((avatar) => (
              <AvatarCard
                key={avatar._id}
                avatar={avatar}
                onDelete={fetchAvatars}
              />
            ))}
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border border-primary/30 w-full max-w-lg p-8 rounded-sm shadow-[0_0_50px_rgba(0,0,0,1)] relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-white/20 hover:text-white"
            >
              <X size={20} />
            </button>

            <div className="mb-8">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                Initialization Sequence
              </span>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mt-1">
                New Identity
              </h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                  Identity Designation
                </label>
                <input
                  autoFocus
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-sm p-3 outline-none focus:border-primary text-white font-mono text-sm transition-all"
                  placeholder="Ex: PROJECT_AETHER_01"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-white/40 uppercase tracking-widest">
                  Neural Parameters (Optional)
                </label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-sm p-3 h-28 outline-none focus:border-primary text-white text-sm transition-all resize-none"
                  placeholder="Describe the primary function of this twin..."
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

              <div className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/5 transition-all"
                >
                  Abort
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-6 py-3 bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  {isCreating ? "Initializing..." : "Confirm Sync"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Sub-Components --- */

const AvatarCard = ({
  avatar,
  onDelete,
}: {
  avatar: Avatar;
  onDelete: () => void;
}) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const statusStyles = {
    draft: "border-white/10 text-white/40 bg-white/5",
    training: "border-yellow-500/50 text-yellow-500 bg-yellow-500/5",
    ready: "border-primary/50 text-primary bg-primary/5",
  };

  const handleTestSpeech = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!avatar.voiceId) return toast.error("Voice not cloned yet");

    setIsPlaying(true);
    try {
      const audioBlob = await testAvatarSpeech(
        avatar.voiceId,
        `Vocal signature for ${avatar.name} is online. System synchronization complete.`,
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      toast.success("Neural voice signature verified", successStyles);
    } catch (err) {
      setIsPlaying(false);
    }
  };

  const handleTermination = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm(`Terminate digital twin: ${avatar.name}?`)) {
      try {
        await deleteAvatar(avatar._id);
        onDelete();
      } catch (err) {}
    }
  };

  return (
    <div className="group relative bg-[#0a0a0a] border border-white/10 rounded-2xl p-5 hover:border-primary/40 transition-all duration-500 shadow-xl overflow-hidden">
      <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleTermination}
          className="p-2 text-white/20 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden shrink-0 group/avatar">
            {avatar.heroImageUrl ? (
              <>
                <img
                  src={getAssetUrl(avatar.heroImageUrl)}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/avatar:scale-110"
                  alt={avatar.name}
                />
                {avatar.status === "ready" && (
                  <button
                    onClick={handleTestSpeech}
                    disabled={isPlaying}
                    className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity"
                  >
                    {isPlaying ? (
                      <Loader2
                        size={16}
                        className="animate-spin text-primary"
                      />
                    ) : (
                      <Play size={16} className="text-primary fill-primary" />
                    )}
                  </button>
                )}
              </>
            ) : (
              <Zap
                className={
                  avatar.status === "training"
                    ? "animate-pulse text-yellow-500"
                    : "text-white/20"
                }
                size={20}
              />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-black text-[13px] tracking-tight truncate uppercase italic">
              {avatar.name}
            </h3>
            <span
              className={`text-[8px] px-2 py-0.5 rounded-full uppercase font-black tracking-widest ${statusStyles[avatar.status as keyof typeof statusStyles]}`}
            >
              {avatar.status}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-white/5 flex items-center justify-between">
          <div className="flex gap-3">
            <span className="flex items-center gap-1 text-[9px] text-white/20 font-mono">
              <ImageIcon size={10} />
              {avatar.photoUrls?.length || 0}
            </span>
            <span className="flex items-center gap-1 text-[9px] text-white/20 font-mono">
              <Mic size={10} />
              {avatar.voiceSampleUrls?.length || 0}
            </span>
          </div>
          <Link
            href={`/avatars/${avatar._id}`}
            className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-white transition-colors flex items-center gap-1"
          >
            Enter Lab <Settings2 size={10} />
          </Link>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: any) => (
  <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl flex items-center gap-5 group hover:border-white/10 transition-colors">
    <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black uppercase text-white/30 tracking-widest">
        {label}
      </p>
      <p className="text-2xl font-black italic leading-none mt-1">{value}</p>
    </div>
  </div>
);

export default AvatarsPage;
