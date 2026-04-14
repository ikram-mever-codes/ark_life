"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Brain,
  ChevronLeft,
  Loader2,
  MessageSquare,
  Terminal,
  ShieldCheck,
  Radio,
  Unplug,
  Zap,
  Lock,
  Wifi,
  Eye,
} from "lucide-react";
import { sendMessageToAvatar, getChatHistory } from "@/api/chat";
import { getAvatarById, testAvatarSpeech, Avatar } from "@/api/avatars";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "avatar";
  text: string;
}

type AiState = "idle" | "thinking" | "buffering" | "vocalizing";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getAssetUrl = (localPath: string) => {
  if (!localPath) return "";
  const baseUrl = "http://localhost:8000";
  const path = localPath.replace(/\\/g, "/");
  return path.startsWith("http") ? path : `${baseUrl}/uploads/${path}`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

const TelemetryBar: React.FC<{
  value: number;
  active?: boolean;
  color?: string;
}> = ({ value, active, color = "#22c55e" }) => (
  <div className="w-full h-[3px] bg-white/5 rounded-full overflow-hidden">
    <motion.div
      initial={{ width: 0 }}
      animate={{ width: `${value}%` }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      style={{
        background: color,
        boxShadow: active ? `0 0 8px ${color}` : "none",
      }}
      className="h-full rounded-full"
    />
  </div>
);

const ActivityBars: React.FC<{ active: boolean }> = ({ active }) => (
  <div className="flex items-end gap-[2px] h-5">
    {[3, 6, 4, 8, 5, 7, 3, 6, 4, 5].map((h, i) => (
      <motion.div
        key={i}
        className="w-[3px] bg-emerald-500 rounded-sm"
        animate={
          active
            ? {
                height: [h * 2, h * 4, h * 1.5, h * 3, h * 2],
                opacity: [0.6, 1, 0.7, 1, 0.6],
              }
            : { height: h * 1.5, opacity: 0.2 }
        }
        transition={{
          duration: 0.8 + i * 0.07,
          repeat: active ? Infinity : 0,
          ease: "easeInOut",
        }}
      />
    ))}
  </div>
);

const ScanLines: React.FC = () => (
  <div
    className="pointer-events-none absolute inset-0 z-50"
    style={{
      backgroundImage:
        "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
    }}
  />
);

const CornerBrackets: React.FC<{ color?: string; active?: boolean }> = ({
  color = "#22c55e",
  active = false,
}) => {
  const cls = `absolute w-5 h-5 transition-all duration-500 ${active ? "opacity-100" : "opacity-30"}`;
  const style = { borderColor: color };
  return (
    <>
      <div
        className={`${cls} top-2 left-2 border-t-2 border-l-2`}
        style={style}
      />
      <div
        className={`${cls} top-2 right-2 border-t-2 border-r-2`}
        style={style}
      />
      <div
        className={`${cls} bottom-2 left-2 border-b-2 border-l-2`}
        style={style}
      />
      <div
        className={`${cls} bottom-2 right-2 border-b-2 border-r-2`}
        style={style}
      />
    </>
  );
};

const HexButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode }
> = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`relative font-black text-[10px] uppercase tracking-[0.25em] transition-all duration-200 ${className}`}
    style={{
      clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
      ...props.style,
    }}
  >
    {children}
  </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const ChatRoom: React.FC = () => {
  const { id } = useParams();
  const router = useRouter();
  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [credits, setCredits] = useState({ remaining: 0, isLow: false });
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [aiState, setAiState] = useState<AiState>("idle");
  const [streamedText, setStreamedText] = useState("");
  const [syncPercent, setSyncPercent] = useState(98);
  const [latency, setLatency] = useState(12);

  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const wordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────

  const initializeNode = useCallback(async () => {
    try {
      const response: any = await getAvatarById(id as string);

      // Handle the nested 'data' structure correctly
      const avatarData = response.avatar || response;
      const creditData = { remaining: 10000, isLow: false };

      if (!avatarData || !avatarData._id) {
        throw new Error("Neural Node Not Found");
      }

      setAvatar(avatarData);
      setCredits(creditData);

      const historyData = await getChatHistory(id as string);
      if (historyData && Array.isArray(historyData)) {
        setMessages(
          historyData.map((m: any) => ({
            id: m._id,
            role: m.role === "avatar" ? "avatar" : "user",
            text: m.text,
          })),
        );
      }
    } catch (err) {
      console.error("Initialization Protocol Failure:", err);
      toast.error("NEURAL UPLINK CRITICAL FAILURE");
      router.push("/avatars");
    }
  }, [id, router]);

  useEffect(() => {
    if (id) {
      initializeNode();
    }
    return () => {
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
    };
  }, [id, initializeNode]);

  // ── Effects ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, streamedText]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (aiState === "vocalizing") {
      vid.play().catch(() => {});
    } else {
      vid.pause();
      vid.currentTime = 0;
    }
  }, [aiState]);

  useEffect(() => {
    const t = setInterval(() => {
      setSyncPercent(+(97.5 + Math.random() * 1.5).toFixed(1));
      setLatency(Math.floor(8 + Math.random() * 10));
    }, 2000);
    return () => clearInterval(t);
  }, []);

  const syncTextWithAudio = useCallback((text: string, duration: number) => {
    if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
    const words = text.split(" ");
    const msPerWord = (duration * 1000) / words.length;
    let idx = 0;
    wordIntervalRef.current = setInterval(() => {
      if (idx < words.length) {
        setStreamedText(words.slice(0, idx + 1).join(" "));
        idx++;
      } else {
        if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
      }
    }, msPerWord);
  }, []);

  // ── Core Message Handler ───────────────────────────────────────────────────

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (
      !message.trim() ||
      !avatar ||
      aiState !== "idle" ||
      credits.remaining <= 0
    )
      return;

    const userText = message;
    setMessages((prev) => [
      ...prev,
      { id: Date.now().toString(), role: "user", text: userText },
    ]);
    setMessage("");
    setAiState("thinking");
    setStreamedText("");

    try {
      const response = await sendMessageToAvatar(avatar._id, userText);
      const reply: string = response?.reply;
      const voiceId: string = response.voiceId || avatar.voiceId || "";

      if (!voiceId || !reply) {
        setAiState("idle");
        return;
      }

      // 1. Fetch binary speech data
      const audioBlob = await testAvatarSpeech(voiceId, reply);
      const arrayBuffer = await audioBlob.arrayBuffer();

      setAiState("buffering");

      // 2. Process Audio Context
      if (!audioCtxRef.current || audioCtxRef.current.state === "closed") {
        const AudioContextClass =
          (window as any).AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new AudioContextClass();
      }
      const ctx = audioCtxRef.current!;
      if (ctx.state === "suspended") await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      // 3. Prepare Video
      const vid = videoRef.current;
      if (vid) {
        vid.currentTime = 0;
        await new Promise((r) => setTimeout(r, 100)); // Wait for seek
      }

      // 4. Create Source
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);

      source.onended = () => {
        setAiState("idle");
        if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
        setMessages((prev) => [
          ...prev,
          { id: Date.now().toString(), role: "avatar", text: reply },
        ]);
        setStreamedText("");
        initializeNode(); // Sync credits after talk finishes
      };

      // 5. Fire Synchronization
      setAiState("vocalizing");
      syncTextWithAudio(reply, audioBuffer.duration);

      const startTime = ctx.currentTime + 0.1; // 100ms offset for precision
      source.start(startTime);
      if (vid) {
        vid.play().catch(() => {});
      }
    } catch (err: any) {
      if (err.response?.status === 403) {
        toast.error("Vocal Credits Depleted");
        setCredits((prev) => ({ ...prev, remaining: 0 }));
      }
      setAiState("idle");
      console.error("Neural Sync Error:", err);
    }
  };

  // ─── Render Conditionals ───────────────────────────────────────────────────

  if (!avatar)
    return (
      <div className="h-screen bg-[#020202] flex items-center justify-center">
        <ScanLines />
        <div className="flex flex-col items-center gap-6">
          <div className="relative w-16 h-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 border-2 border-emerald-500/40"
              style={{
                clipPath:
                  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              }}
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-2 border border-emerald-400/60"
              style={{
                clipPath:
                  "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              }}
            />
            <Brain className="absolute inset-0 m-auto text-emerald-400 w-6 h-6" />
          </div>
          <div className="space-y-1 text-center">
            <p className="text-[9px] font-black tracking-[0.5em] text-emerald-400 animate-pulse uppercase">
              Establishing Neural Uplink
            </p>
            <p className="text-[8px] font-mono text-white/20 tracking-widest">
              AES-256 HANDSHAKE IN PROGRESS...
            </p>
          </div>
        </div>
      </div>
    );

  const isVocalizing = aiState === "vocalizing";
  const isThinking = aiState === "thinking";
  const isBuffering = aiState === "buffering";
  const isActive = isVocalizing || isBuffering;
  const isChatLocked = credits.remaining <= 0;

  return (
    <div
      className="flex h-screen bg-[#020202] text-slate-200 overflow-hidden"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      <ScanLines />

      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-0 md:w-20 lg:w-72 border-r border-emerald-500/10 bg-[#040404] hidden md:flex flex-col z-50 shrink-0 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-32 bg-emerald-500/5 blur-3xl pointer-events-none" />

        <div className="p-5 border-b border-white/5">
          <Link
            href="/avatars"
            className="group flex items-center gap-2 text-white/20 hover:text-emerald-400 transition-colors duration-300"
          >
            <ChevronLeft size={12} />
            <span className="hidden lg:block text-[8px] font-black uppercase tracking-[0.3em]">
              Terminate Link
            </span>
          </Link>
        </div>

        <div className="flex-1 p-5 space-y-8 overflow-hidden">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Radio
                size={10}
                className={`${isActive ? "text-emerald-400 animate-pulse" : "text-white/20"}`}
              />
              <span className="hidden lg:block text-[8px] font-black tracking-[0.3em] uppercase text-white/40">
                Neural Status
              </span>
            </div>

            <div
              className="hidden lg:block bg-black/50 border border-white/5 p-4 space-y-4 relative"
              style={{
                clipPath:
                  "polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%)",
              }}
            >
              <CornerBrackets active={isActive} />
              <div className="space-y-2">
                <div className="flex justify-between text-[8px]">
                  <span className="text-white/30 uppercase tracking-widest">
                    Synchrony
                  </span>
                  <span className="text-emerald-400 font-black">
                    {syncPercent}%
                  </span>
                </div>
                <TelemetryBar value={syncPercent} active={isActive} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[8px]">
                  <span className="text-white/30 uppercase tracking-widest">
                    Vocal DNA
                  </span>
                  <span
                    className={
                      credits.isLow
                        ? "text-red-500 font-black animate-pulse"
                        : "text-sky-400 font-black"
                    }
                  >
                    {credits.remaining}
                  </span>
                </div>
                <TelemetryBar
                  value={(credits.remaining / 10000) * 100}
                  active={isActive}
                  color={credits.isLow ? "#ef4444" : "#38bdf8"}
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[8px]">
                  <span className="text-white/30 uppercase tracking-widest">
                    Vocoder
                  </span>
                  <span
                    className={`font-black ${isVocalizing ? "text-emerald-400" : "text-white/20"}`}
                  >
                    {isVocalizing ? "ACTIVE" : "STANDBY"}
                  </span>
                </div>
                <ActivityBars active={isVocalizing} />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Lock size={10} className="text-sky-400" />
              <span className="hidden lg:block text-[8px] font-black tracking-[0.3em] uppercase text-white/40">
                Encryption
              </span>
            </div>
            <div className="hidden lg:block space-y-2">
              {["AES-256-GCM", "QUANTUM SHIELD", "E2E TUNNEL"].map(
                (label, i) => (
                  <div key={label} className="flex items-center gap-2">
                    <motion.div
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{
                        duration: 2,
                        delay: i * 0.4,
                        repeat: Infinity,
                      }}
                      className="w-1 h-1 rounded-full bg-sky-400"
                    />
                    <span className="text-[8px] font-mono text-white/25 tracking-widest">
                      {label}
                    </span>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-white/5 bg-emerald-500/5">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-2 h-2 rounded-full bg-emerald-400"
            />
            <span className="hidden lg:block text-[8px] font-black text-emerald-400 uppercase tracking-tighter">
              {avatar.name} · Online
            </span>
          </div>
        </div>
      </aside>

      {/* ── MAIN VIEWPORT ── */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgba(34,197,94,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* ── ACCESS DENIED LOCK ── */}
        <AnimatePresence>
          {isChatLocked && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
            >
              <div
                className="p-8 border-2 border-red-500/50 relative bg-red-500/5 max-w-sm"
                style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0 100%)" }}
              >
                <Lock
                  size={48}
                  className="text-red-500 mb-4 mx-auto animate-pulse"
                />
                <h2 className="text-2xl font-black uppercase italic text-white tracking-widest mb-2">
                  Access Denied
                </h2>
                <p className="text-[10px] text-red-500/80 font-mono uppercase tracking-[0.2em] mb-6">
                  Neural connection severed. Vocal frequency credits depleted.
                </p>
                <Link
                  href="/avatars"
                  className="inline-block text-[9px] font-black text-white border border-white/20 px-8 py-3 hover:bg-white/10 transition-all uppercase tracking-widest"
                >
                  Replenish Core Data
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={
            isActive
              ? { opacity: 0.15, scale: 1.1 }
              : { opacity: 0.04, scale: 1 }
          }
          transition={{ duration: 1.5 }}
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 50% 40%, #22c55e, transparent)",
          }}
        />

        <nav className="absolute top-0 inset-x-0 p-4 md:p-6 flex justify-between items-center z-40 pointer-events-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-[1px] bg-emerald-500/40" />
            <span className="text-[8px] font-black text-white/25 tracking-[0.4em] uppercase">
              ArkLife OS v4.0
            </span>
            <div
              className="px-2 py-[2px] bg-emerald-500/10 border border-emerald-500/20"
              style={{ clipPath: "polygon(4% 0, 100% 0, 96% 100%, 0 100%)" }}
            >
              <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">
                SECURE
              </span>
            </div>
          </div>
          <div className="flex gap-4 pointer-events-auto">
            <Wifi
              size={14}
              className={`transition-colors ${isActive ? "text-emerald-400" : "text-white/15"}`}
            />
            <Unplug
              size={14}
              className="text-white/15 hover:text-red-500 cursor-pointer transition-colors"
            />
          </div>
        </nav>

        {/* ── AVATAR STAGE ── */}
        <div className="flex-1 relative flex items-center justify-center overflow-hidden px-4 pt-16 pb-44 md:pb-56">
          <motion.div
            animate={isActive ? { y: [0, -8, 0] } : {}}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="relative z-10 w-full max-w-xs md:max-w-sm lg:max-w-md"
          >
            <div
              className={`relative overflow-hidden border transition-all duration-1000 ${isVocalizing ? "border-emerald-500/60 shadow-[0_0_60px_rgba(34,197,94,0.2),inset_0_0_40px_rgba(34,197,94,0.05)]" : isThinking ? "border-sky-500/30" : "border-white/8"}`}
              style={{
                clipPath:
                  "polygon(20px 0%, calc(100% - 20px) 0%, 100% 20px, 100% calc(100% - 20px), calc(100% - 20px) 100%, 20px 100%, 0% calc(100% - 20px), 0% 20px)",
                aspectRatio: "3/4",
              }}
            >
              <CornerBrackets active={isActive} />

              {avatar.masterVideoUrl ? (
                <video
                  ref={videoRef}
                  src={getAssetUrl(avatar.masterVideoUrl)}
                  className={`w-full h-full object-cover transition-all duration-1000 ${isVocalizing ? "scale-105 grayscale-0 brightness-100" : "scale-100 grayscale brightness-75"}`}
                  loop
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={getAssetUrl(avatar.heroImageUrl || "")}
                  alt={avatar.name}
                  className={`w-full h-full object-cover transition-all duration-1000 ${isVocalizing ? "scale-105 grayscale-0 brightness-100" : "scale-100 grayscale-[0.8] brightness-70"}`}
                />
              )}

              <AnimatePresence>
                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-30"
                  >
                    <Brain className="text-sky-400 w-12 h-12 animate-pulse mb-4" />
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-sky-400">
                      Decrypting Consciousness
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {isBuffering && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center z-30"
                  >
                    <Loader2 className="text-amber-400 w-8 h-8 animate-spin mb-3" />
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-amber-400">
                      Vocal Buffer Loading
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ opacity: isActive ? [0.5, 1, 0.5] : 0.3 }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-emerald-400"
                />
                <span className="text-[9px] font-black uppercase tracking-widest text-white/50">
                  {avatar.name}
                </span>
              </div>
              <span className="text-[7px] font-mono text-white/20 tracking-widest">
                {isVocalizing
                  ? "VOCALIZING"
                  : isThinking
                    ? "PROCESSING"
                    : isBuffering
                      ? "BUFFERING"
                      : "STANDBY"}
              </span>
            </div>
          </motion.div>
        </div>

        {/* ── BOTTOM SECTION ── */}
        <div className="absolute bottom-0 inset-x-0 z-40 px-4 pb-5 md:px-8 md:pb-7 space-y-4">
          <div className="min-h-[60px] md:min-h-[80px] flex items-end justify-center text-center px-4">
            <AnimatePresence mode="wait">
              {isVocalizing && streamedText ? (
                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="text-xl md:text-4xl lg:text-5xl font-black tracking-tight text-white uppercase italic leading-tight"
                  style={{
                    textShadow:
                      "0 0 40px rgba(34,197,94,0.4), 0 2px 20px rgba(0,0,0,0.9)",
                  }}
                >
                  {streamedText}
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                    className="inline-block w-2 h-10 bg-emerald-400 ml-4 animate-pulse shadow-[0_0_15px_#22c55e]"
                  />
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>

          <div className="max-w-2xl mx-auto relative group">
            <motion.div
              animate={aiState === "idle" ? { opacity: 0.2 } : { opacity: 0 }}
              className="absolute -inset-1 blur-lg bg-gradient-to-r from-emerald-500/30 to-sky-500/30 group-focus-within:opacity-80 transition-opacity duration-700"
            />
            <form
              onSubmit={handleSendMessage}
              className={`relative flex items-center bg-black/80 backdrop-blur-xl border ${isChatLocked ? "border-red-900/30" : "border-white/10"} group-focus-within:border-emerald-500/40 transition-colors duration-300`}
              style={{
                clipPath:
                  "polygon(12px 0%, calc(100% - 12px) 0%, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0% calc(100% - 12px), 0% 12px)",
              }}
            >
              <div className="pl-4 text-emerald-500/50">
                <MessageSquare size={14} />
              </div>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={aiState !== "idle" || isChatLocked}
                placeholder={
                  isChatLocked
                    ? "NEURAL LINK SEVERED - INSUFFICIENT CREDITS"
                    : `INPUT COMMAND FOR ${avatar.name.toUpperCase()}...`
                }
                className="flex-1 bg-transparent border-none outline-none py-5 px-3 text-[10px] font-black tracking-widest text-white placeholder:text-white/10 uppercase disabled:opacity-30"
              />
              <HexButton
                type="submit"
                disabled={!message.trim() || aiState !== "idle" || isChatLocked}
                className={`${isChatLocked ? "bg-gray-800 text-gray-500" : "bg-emerald-500 text-black"} px-6 py-5 mr-[2px]`}
              >
                {isChatLocked ? <Lock size={12} /> : "Transmit"}
              </HexButton>
            </form>
          </div>
        </div>

        {/* ── FLOATING HISTORY ── */}
        <div className="absolute right-4 top-20 bottom-52 w-60 hidden xl:flex flex-col gap-3 pointer-events-none z-30">
          <div className="flex items-center gap-2 text-white/15">
            <Terminal size={10} />
            <span className="text-[7px] font-black uppercase tracking-[0.3em]">
              Temporal Log
            </span>
          </div>
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto space-y-3 pr-1 pointer-events-auto"
            style={{
              maskImage: "linear-gradient(to top, black 80%, transparent 100%)",
              scrollbarWidth: "none",
            }}
          >
            {messages.slice(-12).map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`p-3 border-l-2 relative overflow-hidden ${m.role === "user" ? "border-sky-500/50 bg-sky-500/5" : "border-emerald-500/50 bg-emerald-500/5"}`}
                style={{
                  clipPath:
                    "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%)",
                }}
              >
                <p className="text-[8px] font-mono leading-relaxed text-white/50">
                  <span
                    className={`font-black ${m.role === "user" ? "text-sky-400" : "text-emerald-400"}`}
                  >
                    [{m.role.toUpperCase()}]
                  </span>{" "}
                  {m.text}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ChatRoom;
