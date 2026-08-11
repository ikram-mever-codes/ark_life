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
  MessageSquare,
  ArrowUpRight,
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
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-6 lg:p-12 selection:bg-primary selection:text-background">
      <div className="max-w-7xl mx-auto space-y-8 sm:space-y-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 border-b border-border pb-6 sm:pb-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-[2px] bg-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
                Neural Directory
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight uppercase leading-none text-foreground">
              Digital{" "}
              <span
                className="text-transparent"
                style={{ WebkitTextStroke: "1px var(--foreground)" }}
              >
                Twins
              </span>
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowModal(true)}
              className="w-full sm:w-auto justify-center bg-primary text-background px-6 py-3 rounded-lg font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus size={16} strokeWidth={3} /> New Avatar
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
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

        {avatars.length === 0 ? (
          <div className="py-16 sm:py-20 text-center border border-dashed border-border rounded-2xl sm:rounded-3xl">
            <p className="text-foreground-subtle uppercase tracking-[0.4em] text-[10px] font-bold">
              No Neural Nodes Detected
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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

      {showModal && (
        <div className="fixed inset-0 bg-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-surface-elevated border border-primary/30 w-full max-w-lg p-6 sm:p-8 rounded-xl shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-foreground-subtle hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>

            <div className="mb-8">
              <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                Initialization Sequence
              </span>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight mt-1 text-foreground">
                New Identity
              </h2>
            </div>

            <form onSubmit={handleCreate} className="space-y-6">
              <div className="space-y-1">
                <label className="text-[9px] font-bold text-foreground-subtle uppercase tracking-widest">
                  Identity Designation
                </label>
                <input
                  autoFocus
                  required
                  className="w-full bg-background border border-border rounded-md p-3 outline-none focus:border-primary text-foreground font-mono text-sm transition-colors"
                  placeholder="Ex: PROJECT_AETHER_01"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold text-foreground-subtle uppercase tracking-widest">
                  Neural Parameters (Optional)
                </label>
                <textarea
                  className="w-full bg-background border border-border rounded-md p-3 h-28 outline-none focus:border-primary text-foreground text-sm transition-colors resize-none"
                  placeholder="Describe the primary function of this twin..."
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

              <div className="pt-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-3 rounded-md border border-border text-foreground-muted text-[10px] font-black uppercase tracking-widest hover:bg-surface transition-colors"
                >
                  Abort
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 px-6 py-3 rounded-md bg-primary text-background text-[10px] font-black uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all"
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
    draft: "text-foreground-subtle",
    training: "text-warning",
    ready: "text-primary",
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
    <div className="group relative bg-surface border border-border rounded-2xl sm:rounded-3xl overflow-hidden hover:border-primary/30 transition-colors duration-300 shadow-lg">
      <div className="absolute top-4 right-4 z-20 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleTermination}
          className="p-2 bg-background/70 backdrop-blur-md text-foreground-subtle hover:text-error rounded-full border border-border transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      <div className="relative aspect-[4/5] w-full bg-surface-elevated overflow-hidden">
        {avatar.heroImageUrl ? (
          <>
            <img
              src={getAssetUrl(avatar.heroImageUrl)}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 brightness-[0.85] group-hover:brightness-100"
              alt={avatar.name}
            />
            {avatar.status === "ready" && (
              <button
                onClick={handleTestSpeech}
                disabled={isPlaying}
                className="absolute bottom-4 left-4 p-3 bg-primary/20 backdrop-blur-xl border border-primary/30 rounded-full text-primary hover:bg-primary hover:text-background transition-colors"
              >
                {isPlaying ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Play size={18} className="fill-current" />
                )}
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3">
            <Zap
              className={
                avatar.status === "training"
                  ? "animate-pulse text-warning"
                  : "text-foreground-subtle/40"
              }
              size={48}
              strokeWidth={1}
            />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground-subtle">
              {avatar.status === "training" ? "Syncing DNA..." : "Core Empty"}
            </span>
          </div>
        )}

        <div className="absolute top-4 left-4">
          <div
            className={`flex items-center gap-2 px-3 py-1 bg-background/70 backdrop-blur-md border border-border rounded-full text-[8px] font-black uppercase tracking-widest ${statusStyles[avatar.status as keyof typeof statusStyles]}`}
          >
            <div
              className={`w-1 h-1 rounded-full bg-current ${avatar.status === "training" ? "animate-ping" : ""}`}
            />
            {avatar.status}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-4 sm:space-y-6">
        <div className="space-y-1">
          <h3 className="font-black text-base sm:text-lg tracking-tight uppercase truncate text-foreground">
            {avatar.name}
          </h3>
          <p className="text-foreground-subtle text-[10px] uppercase font-bold tracking-widest flex items-center gap-2">
            <ImageIcon size={12} /> {avatar.photoUrls?.length || 0} Frames ·{" "}
            <Mic size={12} /> {avatar.voiceSampleUrls?.length || 0} Samples
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/avatars/${avatar._id}`}
            className="flex-1 flex items-center justify-center gap-2 bg-surface-elevated border border-border py-2.5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:border-primary/40 transition-colors group/btn"
          >
            Config{" "}
            <Settings2
              size={14}
              className="group-hover/btn:rotate-90 transition-transform"
            />
          </Link>

          {avatar.status === "ready" && (
            <Link
              href={`/avatars/${avatar._id}/chat`}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-background py-2.5 sm:py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:brightness-110 active:scale-95 transition-all"
            >
              Chat <MessageSquare size={14} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }: any) => (
  <div className="bg-surface border border-border p-5 sm:p-6 rounded-2xl flex items-center gap-4 sm:gap-5 group hover:border-primary/20 transition-colors duration-300">
    <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-black uppercase text-foreground-subtle tracking-widest">
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-black leading-none mt-1 text-foreground">
        {value}
      </p>
    </div>
  </div>
);

export default AvatarsPage;
