"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Brain,
  ChevronLeft,
  Loader2,
  Send,
  Menu,
  X,
  Database,
  Settings,
  Power,
  AlertCircle,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { sendMessageToAvatar, getChatHistory } from "@/api/chat";
import { getAvatarById, testAvatarSpeech, Avatar } from "@/api/avatars";
import { toast } from "react-hot-toast";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import MouthOverlay from "@/components/MouthOverlay";
import { BASE_URL } from "@/utils/constants";

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
  if (localPath.startsWith("http")) return localPath;
  const baseUrl = BASE_URL;
  const path = localPath.replace(/\\/g, "/");
  return `${baseUrl}/uploads/${path.split("uploads/")[1] || path}`;
};

// ─── Sub-components ──────────────────────────────────────────────────────────

/**
 * Action button used in the top bar. Kept visually consistent across
 * desktop and mobile — size stays thumb-friendly (44px target).
 */
const ActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}> = ({ icon, label, onClick, href, danger }) => {
  const className = `flex items-center gap-2 px-3 py-2 rounded-[8px] border transition-all text-xs font-bold uppercase tracking-wider
    ${
      danger
        ? "border-red-500/20 text-red-400 hover:bg-red-500/10 hover:border-red-500/40"
        : "border-white/10 text-white/60 hover:text-white hover:bg-white/5 hover:border-white/20"
    }`;

  const content = (
    <>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={className}>
      {content}
    </button>
  );
};

/**
 * The centerpiece. Master loop video + mouth overlay in a framed container
 * with subtle corner accents. Breathes when idle, lights up when speaking.
 */
const AvatarStage: React.FC<{
  avatar: Avatar;
  aiState: AiState;
  activeAudioNode: AudioBufferSourceNode | null;
  audioContext: AudioContext | null;
}> = ({ avatar, aiState, activeAudioNode, audioContext }) => {
  const isVocalizing = aiState === "vocalizing";
  const isThinking = aiState === "thinking";

  return (
    <div className="relative w-full max-w-sm md:max-w-md aspect-[3/4] rounded-[12px] overflow-hidden shadow-2xl shadow-primary/5">
      {/* Corner accents — understated, not loud */}
      <div
        className={`absolute top-0 left-0 w-6 h-6 border-t border-l transition-all duration-500 z-20 pointer-events-none
          ${isVocalizing ? "border-primary" : "border-white/20"}`}
      />
      <div
        className={`absolute top-0 right-0 w-6 h-6 border-t border-r transition-all duration-500 z-20 pointer-events-none
          ${isVocalizing ? "border-primary" : "border-white/20"}`}
      />
      <div
        className={`absolute bottom-0 left-0 w-6 h-6 border-b border-l transition-all duration-500 z-20 pointer-events-none
          ${isVocalizing ? "border-primary" : "border-white/20"}`}
      />
      <div
        className={`absolute bottom-0 right-0 w-6 h-6 border-b border-r transition-all duration-500 z-20 pointer-events-none
          ${isVocalizing ? "border-primary" : "border-white/20"}`}
      />

      {/* Thinking overlay */}
      <AnimatePresence>
        {isThinking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <Brain className="text-primary w-10 h-10 animate-pulse mb-3" />
            <p className="text-[10px] font-bold text-primary uppercase tracking-[0.3em]">
              Processing...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Master loop video */}
      <video
        src={getAssetUrl(avatar.masterVideoUrl || "")}
        className={`w-full h-full object-cover transition-all duration-700
          ${isVocalizing ? "scale-105 saturate-100 brightness-100" : "scale-100 saturate-[0.4] brightness-90"}`}
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Audio-reactive mouth shadow */}
      <MouthOverlay
        coords={avatar.mouthCoords}
        audioNode={activeAudioNode}
        audioContext={audioContext}
        active={isVocalizing}
      />

      {/* Subtle bottom status indicator */}
      <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full transition-all
              ${isVocalizing ? "bg-primary shadow-[0_0_8px] shadow-primary animate-pulse" : "bg-white/30"}`}
          />
          <span className="text-[9px] font-bold text-white/60 uppercase tracking-widest">
            {isVocalizing ? "Speaking" : isThinking ? "Thinking" : "Idle"}
          </span>
        </div>
      </div>
    </div>
  );
};

/**
 * Transcript sidebar. On desktop it's a column to the right of the avatar.
 * On mobile it's a slide-over drawer from the right edge.
 */
const TranscriptPanel: React.FC<{
  messages: Message[];
  avatarName: string;
  isMobileOpen: boolean;
  onMobileClose: () => void;
}> = ({ messages, avatarName, isMobileOpen, onMobileClose }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  const content = (
    <div className="flex flex-col h-full bg-[#0a0a0a] border-l border-white/5">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare size={14} className="text-primary" />
          <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider">
            Transcript
          </span>
        </div>
        {/* Close button only on mobile */}
        <button
          onClick={onMobileClose}
          className="lg:hidden p-1 text-white/40 hover:text-white"
        >
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 py-12">
            <Sparkles className="text-white/20 mb-3" size={24} />
            <p className="text-xs text-white/40">
              No messages yet. Send something to start talking with{" "}
              <span className="text-primary font-bold">{avatarName}</span>.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-[10px] text-xs leading-relaxed
                  ${
                    m.role === "user"
                      ? "bg-sky-500/10 border border-sky-500/20 text-sky-100 rounded-br-sm"
                      : "bg-primary/5 border border-primary/20 text-white rounded-bl-sm"
                  }`}
              >
                <div
                  className={`text-[9px] font-bold uppercase mb-1 tracking-wider
                    ${m.role === "user" ? "text-sky-400/70" : "text-primary/70"}`}
                >
                  {m.role === "user" ? "You" : avatarName}
                </div>
                <div>{m.text}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-80 shrink-0">{content}</aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 260 }}
              className="lg:hidden fixed right-0 top-0 bottom-0 w-[85vw] max-w-sm z-50"
            >
              {content}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

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
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);

  // Audio source exposed to MouthOverlay
  const [activeAudioNode, setActiveAudioNode] =
    useState<AudioBufferSourceNode | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const wordIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isChatLocked = credits.remaining <= 0;

  // ── Init ──
  const initializeNode = useCallback(async () => {
    try {
      const response: any = await getAvatarById(id as string);
      const avatarData = response.avatar || response;

      if (!avatarData || avatarData.status !== "ready") {
        toast.error("Neural Node not ready for chat.");
        router.push("/avatars");
        return;
      }

      setAvatar(avatarData);
      setCredits(response.credits || { remaining: 100, isLow: false });

      const historyData = await getChatHistory(id as string);
      if (historyData) {
        setMessages(
          historyData.map((m: any) => ({
            id: m._id,
            role: m.role,
            text: m.text,
          })),
        );
      }
    } catch (err) {
      router.push("/avatars");
    }
  }, [id, router]);

  useEffect(() => {
    if (id) initializeNode();
    return () => {
      audioCtxRef.current?.close();
      if (wordIntervalRef.current) clearInterval(wordIntervalRef.current);
    };
  }, [id, initializeNode]);

  // ── Browser TTS fallback ──
  const playFallbackSpeech = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((v) => v.lang === "en-US") || voices[0];
    utterance.rate = 1.0;

    utterance.onstart = () => {
      setAiState("vocalizing");
      syncTextWithAudio(text, text.length * 0.08);
    };
    utterance.onend = () => {
      setAiState("idle");
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "avatar", text },
      ]);
      setStreamedText("");
    };
    window.speechSynthesis.speak(utterance);
  };

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

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!message.trim() || !avatar || aiState !== "idle" || isChatLocked)
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
      const response: any = await sendMessageToAvatar(avatar._id, userText);
      const reply = response?.data?.reply || response?.reply;
      if (!reply) throw new Error("No response");

      try {
        const audioBlob = await testAvatarSpeech(avatar.voiceId!, reply);
        const arrayBuffer = await audioBlob.arrayBuffer();

        setAiState("buffering");
        if (!audioCtxRef.current)
          audioCtxRef.current = new (
            window.AudioContext || (window as any).webkitAudioContext
          )();
        const ctx = audioCtxRef.current;
        if (ctx.state === "suspended") await ctx.resume();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);

        source.onended = () => {
          setAiState("idle");
          setActiveAudioNode(null);
          setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), role: "avatar", text: reply },
          ]);
          setStreamedText("");
        };

        setAiState("vocalizing");
        setActiveAudioNode(source);
        syncTextWithAudio(reply, audioBuffer.duration);
        source.start(ctx.currentTime + 0.1);
      } catch (audioErr) {
        playFallbackSpeech(reply);
      }
    } catch (err) {
      setAiState("idle");
      toast.error("Neural Link Disrupted");
    }
  };

  if (!avatar)
    return (
      <div className="h-screen bg-[#050505] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );

  return (
    <div
      className="flex flex-col h-screen bg-[#050505] text-white overflow-hidden"
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}
    >
      {/* ═══════════ TOP BAR ═══════════ */}
      <header className="shrink-0 border-b border-white/5 bg-[#0a0a0a]/80 backdrop-blur-sm z-30">
        <div className="px-4 md:px-6 py-3 flex items-center justify-between gap-2">
          {/* Left: Back + Avatar name */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/avatars"
              className="p-2 rounded-[8px] border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all shrink-0"
            >
              <ChevronLeft size={14} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                <h1 className="text-sm font-bold text-white truncate">
                  {avatar.name}
                </h1>
              </div>
              <p className="text-[10px] text-white/40 uppercase tracking-widest">
                Neural Link Active
              </p>
            </div>
          </div>

          {/* Right: Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <ActionButton
              icon={<Database size={14} />}
              label="Memory"
              href={`/avatars/${avatar._id}`}
            />
            <ActionButton
              icon={<Settings size={14} />}
              label="Config"
              href={`/avatars/${avatar._id}`}
            />
            {/* Mobile transcript toggle */}
            <button
              onClick={() => setIsTranscriptOpen(true)}
              className="lg:hidden p-2 rounded-[8px] border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all relative"
            >
              <Menu size={14} />
              {messages.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-black text-[9px] font-bold rounded-full flex items-center justify-center">
                  {messages.length > 9 ? "9+" : messages.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ═══════════ MAIN CONTENT (Stage + Sidebar) ═══════════ */}
      <div className="flex-1 flex overflow-hidden">
        {/* Stage area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-[radial-gradient(ellipse_at_center,_#0a0a0a_0%,_#050505_70%)]">
          {/* Avatar centered */}
          <div className="flex-1 flex items-center justify-center px-4 py-6 overflow-hidden">
            <AvatarStage
              avatar={avatar}
              aiState={aiState}
              activeAudioNode={activeAudioNode}
              audioContext={audioCtxRef.current}
            />
          </div>

          {/* Typing response area — sits right above input */}
          <div className="shrink-0 px-4 md:px-6 min-h-[60px] flex items-end justify-center">
            <AnimatePresence mode="wait">
              {aiState === "thinking" && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-white/50 pb-2"
                >
                  <span className="text-xs">{avatar.name} is thinking</span>
                  <span className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1 h-1 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                          duration: 1,
                          repeat: Infinity,
                          delay: i * 0.2,
                        }}
                      />
                    ))}
                  </span>
                </motion.div>
              )}

              {aiState === "vocalizing" && streamedText && (
                <motion.div
                  key="typing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="w-full max-w-2xl pb-2"
                >
                  <div className="text-[10px] font-bold text-primary/70 uppercase tracking-widest mb-1">
                    {avatar.name}
                  </div>
                  <p className="text-sm md:text-base text-white leading-relaxed">
                    {streamedText}
                    <motion.span
                      animate={{ opacity: [1, 0] }}
                      transition={{ duration: 0.6, repeat: Infinity }}
                      className="inline-block w-[2px] h-4 bg-primary ml-1 align-middle"
                    />
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input bar */}
          <div className="shrink-0 px-4 md:px-6 pb-4 md:pb-6 pt-2">
            <form
              onSubmit={handleSendMessage}
              className={`flex items-center gap-2 bg-[#0a0a0a] border rounded-[12px] overflow-hidden transition-all
                ${isChatLocked ? "border-red-900/50" : "border-white/10 focus-within:border-primary/50"}`}
            >
              <input
                ref={inputRef}
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={aiState !== "idle" || isChatLocked}
                placeholder={
                  isChatLocked
                    ? "Credits depleted"
                    : `Message ${avatar.name}...`
                }
                className="flex-1 bg-transparent border-none outline-none py-4 px-4 text-sm text-white placeholder:text-white/30 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!message.trim() || aiState !== "idle" || isChatLocked}
                className="shrink-0 m-1.5 h-10 w-10 flex items-center justify-center bg-primary text-black rounded-[8px] disabled:opacity-30 disabled:bg-white/10 disabled:text-white/40 hover:brightness-110 transition-all"
              >
                {aiState === "idle" ? (
                  <Send size={16} />
                ) : (
                  <Loader2 size={16} className="animate-spin" />
                )}
              </button>
            </form>
          </div>
        </main>

        {/* Sidebar — desktop only here; mobile drawer rendered inside TranscriptPanel */}
        <TranscriptPanel
          messages={messages}
          avatarName={avatar.name}
          isMobileOpen={isTranscriptOpen}
          onMobileClose={() => setIsTranscriptOpen(false)}
        />
      </div>

      {/* ═══════════ Locked Overlay ═══════════ */}
      <AnimatePresence>
        {isChatLocked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center"
          >
            <AlertCircle
              size={48}
              className="text-red-500 mb-4 animate-pulse"
            />
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              Credits Depleted
            </h2>
            <p className="max-w-md text-sm text-white/50 mb-8">
              Neural energy has run out. Please replenish credits to resume
              communication.
            </p>
            <Link
              href="/avatars"
              className="px-6 py-3 border border-white/20 rounded-[8px] text-white font-bold text-sm hover:bg-white hover:text-black transition-all"
            >
              Go to Dashboard
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ChatRoom;
