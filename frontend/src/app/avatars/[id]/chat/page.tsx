"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownToSpeech } from "@/utils/util";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings2,
  Send,
  Mic,
  MicOff,
  Loader2,
  MessageSquare,
  AlertTriangle,
  X,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useSelector } from "react-redux";
import { selectIsEmailVerified } from "@/app/Redux/features/userSlice";
import {
  BiometricPanel,
  CornerFrame,
  HealthOverviewPanel,
  IdentityPanel,
  LifestylePanel,
  TwinNav,
  VerifiedPanel,
  VitalsPanel,
} from "@/components/twin/TwinPanels";
import { toast } from "react-hot-toast";
import { getAvatarById, testAvatarSpeech, Avatar } from "@/api/avatars";
import { getAssetUrl } from "../page";
import { getChatHistory, sendMessageToAvatar, ChatMessage } from "@/api/chat";

type EngineState = "idle" | "speaking" | "listening";

const AvatarChatPage = () => {
  const { id } = useParams();
  const router = useRouter();

  const [avatar, setAvatar] = useState<Avatar | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [engineState, setEngineState] = useState<EngineState>("idle");

  const [caption, setCaption] = useState("");
  const [captionDone, setCaptionDone] = useState(true);
  const [audioFailed, setAudioFailed] = useState(false);

  const [rightOpen, setRightOpen] = useState(false); // conversation drawer
  const emailVerified = useSelector(selectIsEmailVerified);

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  // Voice input language (Italian by default — ArkLife users are mostly Italian).
  const [speechLang, setSpeechLang] = useState<"it-IT" | "en-US">("it-IT");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("arklife_voice_lang");
      if (saved === "it-IT" || saved === "en-US") setSpeechLang(saved);
    } catch {}
  }, []);
  const [videoBroken, setVideoBroken] = useState(false);
  const recognitionRef = useRef<any>(null);
  const interimTextRef = useRef("");

  const historyEndRef = useRef<HTMLDivElement | null>(null);
  const typeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getAvatarById(id as string);
        setAvatar(data);
        try {
          const history = await getChatHistory(id as string);
          setMessages(history);
          const lastAvatarMsg = [...history]
            .reverse()
            .find((m) => m.role === "avatar");
          if (lastAvatarMsg) {
            setCaption(lastAvatarMsg.text);
            setCaptionDone(true);
          }
        } catch {}
      } catch (err) {
        setLoadError(true);
        toast.error("Could not load this twin. Returning to directory.");
        router.push("/avatars");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, router]);

  /* ── Auto-scroll chat history ────────────────────────────────────── */
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, rightOpen]);

  /* ── Master video playback — driven purely by engineState, which is
   * itself only ever set to "speaking" by the audio element's real
   * `onplaying` event (see playCaptionWithAudio below), never by the
   * TTS API call starting. The <video> element is ALWAYS mounted (see
   * JSX) so the browser has already buffered it well before it's needed
   * — this effect only play()/pause()s an element that's already loaded,
   * which is instant, instead of mounting a fresh <video> each time
   * (which was the cause of both the lag and the blank-screen flash).
   * ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const video = videoElRef.current;
    if (!video || !avatar?.masterVideoUrl || videoBroken) return;

    if (engineState === "speaking") {
      video.currentTime = 0;
      video.play().catch(() => {
        // Autoplay could theoretically be blocked here too, but by this
        // point the *audio* is already playing (user-gesture chain from
        // Send/mic), so this is extremely unlikely. If it happens, the
        // hero image underneath is still visible — no broken UI.
      });
    } else {
      video.pause();
    }
  }, [engineState, avatar?.masterVideoUrl]);

  /* ── Cleanup on unmount ───────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  /* ── Fallback: word-timer caption (no audio available) ──────────────
   * No real audio exists in this path, so there's nothing to sync
   * playback to — the video (if any) starts immediately alongside the
   * typed caption rather than waiting on an event that will never fire.
   */
  const playCaptionTimer = useCallback((text: string) => {
    if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
    setCaption("");
    setCaptionDone(false);
    setEngineState("speaking");
    let i = 0;
    typeIntervalRef.current = setInterval(() => {
      i++;
      setCaption(text.slice(0, i));
      if (i >= text.length) {
        if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
        setCaptionDone(true);
        setEngineState("idle");
      }
    }, 22);
  }, []);

  /* ── Primary: audio playback with caption + video sync ──────────────
   * Uses the same testAvatarSpeech(voiceId, text) endpoint the Avatars
   * grid already uses for voice previews — the backend's chat.interact
   * route returns text + voiceId only, it does not synthesize audio
   * itself, so synthesis happens client-side via this call.
   *
   * engineState stays whatever it already was (set to "listening" by
   * dispatchMessage) all the way through the network fetch and audio
   * decode — it only flips to "speaking" on the browser's `onplaying`
   * event, which fires once the audio is ACTUALLY producing sound, not
   * when .play() is called or when this function starts. That's what
   * keeps the master-video swap genuinely in sync with audible speech
   * instead of firing early and sitting on a black/loading frame.
   */
  const playCaptionWithAudio = useCallback(
    async (text: string, voiceId?: string) => {
      if (typeIntervalRef.current) clearInterval(typeIntervalRef.current);
      setCaption("");
      setCaptionDone(false);
      setAudioFailed(false);

      if (!voiceId) {
        playCaptionTimer(text);
        return;
      }

      const words = text.split(/\s+/).filter(Boolean);

      try {
        const audioBlob = await testAvatarSpeech(voiceId, text);
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplaying = () => {
          // Fires only once real playback has begun (after any
          // buffering) — this is the sole trigger for showing the
          // master video and the "Speaking" state. It may fire more
          // than once if playback stalls and resumes mid-clip; setting
          // the same state again is a harmless no-op for React.
          setEngineState("speaking");
        };

        audio.ontimeupdate = () => {
          if (!audio.duration || isNaN(audio.duration)) return;
          const progress = Math.min(audio.currentTime / audio.duration, 1);
          const revealCount = Math.max(1, Math.round(progress * words.length));
          setCaption(words.slice(0, revealCount).join(" "));
        };

        audio.onended = () => {
          setCaption(text);
          setCaptionDone(true);
          setEngineState("idle");
          URL.revokeObjectURL(audioUrl);
        };

        audio.onerror = () => {
          setAudioFailed(true);
          URL.revokeObjectURL(audioUrl);
          playCaptionTimer(text);
        };

        await audio.play();
      } catch (err) {
        // Synthesis or playback failed (no credits, network, autoplay
        // block, etc.) — still show the reply via the timer fallback.
        setAudioFailed(true);
        playCaptionTimer(text);
      }
    },
    [playCaptionTimer],
  );

  /* ── Core send — shared by text input and voice transcript ──────── */
  const dispatchMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMsg: ChatMessage = {
      _id: `local_${Date.now()}`,
      role: "user",
      text: trimmed,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsSending(true);
    setEngineState("listening");

    try {
      const res: any = await sendMessageToAvatar(id as string, trimmed);
      const replyText: string = res?.data?.reply ?? res?.reply ?? "";
      const voiceId: string | undefined =
        res?.data?.voiceId ?? res?.voiceId ?? avatar?.voiceId;

      const avatarMsg: ChatMessage = {
        _id: `local_reply_${Date.now()}`,
        role: "avatar",
        text: replyText,
        createdAt: new Date().toISOString(),
        sources: res?.data?.sources ?? [],
      };
      setMessages((prev) => [...prev, avatarMsg]);

      if (replyText) {
        // engineState stays "listening" (set above) through the entire
        // TTS fetch inside playCaptionWithAudio — it only becomes
        // "speaking" once audio.onplaying actually fires.
        playCaptionWithAudio(markdownToSpeech(replyText), voiceId);
      } else {
        setEngineState("idle");
      }
    } catch (err) {
      setEngineState("idle");
      // handleApiError inside sendMessageToAvatar already toasts
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = () => dispatchMessage(inputText);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Voice input — Web Speech API transcription ──────────────────
   * No audio-upload endpoint exists on the backend (chat.controller.ts
   * only exposes text `interact` + `getHistory`), so voice messages are
   * transcribed client-side and sent through the same text pipeline.
   */
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLang;

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += transcript;
        else interim += transcript;
      }
      interimTextRef.current = final || interim;
      setInputText(final || interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed")
        toast.error("Microphone access denied");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
    };
  }, [speechLang]);

  const toggleListening = () => {
    if (!speechSupported) {
      toast.error("Voice input isn't supported in this browser");
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      const finalText = interimTextRef.current.trim();
      if (finalText) {
        dispatchMessage(finalText);
        interimTextRef.current = "";
      }
    } else {
      setInputText("");
      interimTextRef.current = "";
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch {
        // recognition already active — ignore
      }
    }
  };

  /* ── Guards ───────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={36} />
      </div>
    );
  }

  if (!avatar || loadError) return null;

  if (avatar.status !== "ready") {
    return (
      <div className="h-[100dvh] bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="text-warning mx-auto mb-4" size={36} />
          <h1 className="hud-title text-xl text-foreground normal-case mb-2">
            {avatar.name} isn't ready yet
          </h1>
          <p className="text-sm text-foreground-muted mb-6">
            This twin needs at least one photo and one voice sample connected
            before you can chat.
          </p>
          <Link
            href={`/avatars/${avatar._id}`}
            className="inline-flex items-center gap-2 bg-primary text-background px-6 py-3 rounded-xl font-bold text-sm hover:brightness-110 transition-all"
          >
            <Settings2 size={16} /> Finish Setup
          </Link>
        </div>
      </div>
    );
  }

  const stateLabel =
    engineState === "speaking"
      ? "Speaking"
      : engineState === "listening"
        ? "Thinking"
        : "Idle";
  const stateColor =
    engineState === "speaking"
      ? "text-primary"
      : engineState === "listening"
        ? "text-warning"
        : "text-foreground-subtle";

  // Whether the (always-mounted, pre-buffered) video should be VISIBLE
  // right now. The element itself never mounts/unmounts — only opacity
  // and play/pause toggle, which is what removes both the lag and the
  // blank-frame flash.
  const showMasterVideo =
    engineState === "speaking" && !!avatar.masterVideoUrl && !videoBroken;

  const lastReply = [...messages].reverse().find((m) => m.role === "avatar");
  const typing = !captionDone && !!caption;

  return (
    <div className="twin-page min-h-[calc(100dvh-4rem)] w-full min-w-0 overflow-x-hidden text-foreground scrollbar-theme">
      <TwinNav
        avatar={avatar}
        active="overview"
        onOpenChat={() => setRightOpen(true)}
        messageCount={messages.length}
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 p-3 sm:p-4 lg:p-5 lg:grid-cols-[minmax(250px,290px)_minmax(0,1fr)_minmax(270px,320px)] lg:h-[calc(100dvh-4rem-3.5rem)]">
        {/* ── LEFT — identity · verified · biometric ─────────────────── */}
        <aside className="order-2 lg:order-none flex flex-col gap-4 lg:overflow-y-auto lg:pr-1 min-h-0">
          <IdentityPanel avatar={avatar} onUpdated={(a) => setAvatar(a)} />
          <VerifiedPanel emailVerified={!!emailVerified} />
          <BiometricPanel
            avatar={avatar}
            imageUrl={
              avatar.heroImageUrl ? getAssetUrl(avatar.heroImageUrl) : undefined
            }
            speaking={engineState === "speaking"}
          />
        </aside>

        {/* ── CENTER — portrait · reply · input ──────────────────────── */}
        <section className="order-1 lg:order-none flex flex-col gap-3 min-h-0 min-w-0">
          <div className="relative h-[52vh] sm:h-[60vh] lg:h-auto lg:flex-1 lg:min-h-0 rounded-lg overflow-hidden border border-border/50 bg-[radial-gradient(ellipse_at_center,rgba(24,185,205,0.06),transparent_70%)]">
            <CornerFrame active={engineState !== "idle"} />

            {avatar.heroImageUrl ? (
              <motion.img
                src={getAssetUrl(avatar.heroImageUrl)}
                alt={avatar.name}
                className="absolute inset-0 w-full h-full object-cover object-top"
                animate={{ opacity: showMasterVideo ? 0 : 1 }}
                transition={{ duration: 0.15 }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-foreground-subtle">
                <MessageSquare size={40} strokeWidth={1} />
                <span className="hud-label">No photo yet</span>
              </div>
            )}

            {/* Master video: always mounted and pre-buffered; only opacity
                and play/pause change (avoids lag and blank frames). */}
            {avatar.masterVideoUrl && (
              <motion.video
                ref={videoElRef}
                src={avatar.masterVideoUrl}
                className="absolute inset-0 w-full h-full object-cover object-top"
                animate={{ opacity: showMasterVideo ? 1 : 0 }}
                transition={{ duration: 0.15 }}
                loop
                muted
                playsInline
                preload="auto"
                onError={() => setVideoBroken(true)}
              />
            )}

            {/* bottom fade */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-background/90 to-transparent pointer-events-none z-10" />

            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-background/70 backdrop-blur-md border border-border px-2.5 py-1 rounded-full z-30">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  engineState === "speaking"
                    ? "bg-primary animate-pulse"
                    : engineState === "listening"
                      ? "bg-warning animate-pulse"
                      : "bg-foreground-subtle"
                }`}
              />
              <span className="hud-label !text-[9.5px]">{stateLabel}</span>
            </div>
          </div>

          {/* Reply panel: live caption while speaking, full answer after */}
          <div className="rounded-lg border border-border/70 bg-surface-elevated/60 px-4 py-3 shrink-0">
            <div className="flex items-center justify-between mb-1">
              <span className="hud-label !text-[9.5px] flex items-center gap-1.5 text-primary/80">
                {audioFailed ? <VolumeX size={11} /> : <Volume2 size={11} />}
                {audioFailed
                  ? "Reply (audio unavailable)"
                  : typing
                    ? "Speaking"
                    : "Last reply"}
              </span>
              {lastReply?.sources && lastReply.sources.length > 0 && !typing && (
                <span className="text-[10px] text-foreground-subtle truncate ml-3">
                  📄 {lastReply.sources.map((s) => s.fileName).join(" · ")}
                </span>
              )}
            </div>
            <div className="max-h-32 lg:max-h-36 overflow-y-auto text-sm leading-relaxed pr-1">
              {typing ? (
                <p className="text-foreground">
                  {caption}
                  <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                </p>
              ) : lastReply ? (
                <div className="chat-md text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {lastReply.text}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-foreground-subtle">
                  Say hello to start the conversation with {avatar.name}.
                </p>
              )}
            </div>
          </div>

          {/* Input bar */}
          <div className="sticky bottom-0 lg:static z-30 rounded-lg border border-border/70 bg-surface/95 backdrop-blur px-2 py-2 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={toggleListening}
                disabled={isSending}
                className={`shrink-0 w-10 h-10 rounded-md border flex items-center justify-center transition-colors disabled:opacity-40 ${
                  isListening
                    ? "bg-error/15 border-error/50 text-error"
                    : "border-border text-foreground-muted hover:text-primary hover:border-primary/40"
                }`}
                title={
                  speechSupported
                    ? "Voice message"
                    : "Voice input not supported in this browser"
                }
              >
                {isListening ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
              <button
                onClick={() => {
                  const next = speechLang === "it-IT" ? "en-US" : "it-IT";
                  setSpeechLang(next);
                  try {
                    localStorage.setItem("arklife_voice_lang", next);
                  } catch {}
                }}
                disabled={isListening}
                className="shrink-0 h-10 px-2 rounded-md border border-border text-[11px] font-semibold text-foreground-muted hover:text-primary hover:border-primary/40 disabled:opacity-40"
                title="Voice input language"
              >
                {speechLang === "it-IT" ? "IT" : "EN"}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
                placeholder={
                  isListening ? "Listening..." : `Message ${avatar.name}...`
                }
                className="flex-1 min-w-0 bg-background border border-border rounded-md px-3.5 py-2.5 text-sm outline-none focus:border-primary/60 transition-colors disabled:opacity-60"
              />
              <button
                onClick={handleSend}
                disabled={isSending || !inputText.trim()}
                className="shrink-0 w-10 h-10 rounded-md bg-primary text-background flex items-center justify-center disabled:opacity-30 hover:brightness-110 transition-all"
              >
                {isSending ? (
                  <Loader2 size={17} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>
            {isListening && (
              <p className="hud-label text-error mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />{" "}
                Recording — tap mic to send
              </p>
            )}
          </div>
        </section>

        {/* ── RIGHT — health overview · vitals · lifestyle ───────────── */}
        <aside className="order-3 lg:order-none flex flex-col gap-4 lg:overflow-y-auto lg:pl-1 min-h-0">
          <HealthOverviewPanel />
          <VitalsPanel />
          <LifestylePanel />
        </aside>
      </div>

      {/* ── Conversation drawer ─────────────────────────────────────────── */}
      <AnimatePresence>
        {rightOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-overlay backdrop-blur-sm"
            onClick={() => setRightOpen(false)}
          >
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              className="h-full w-[92%] max-w-md bg-surface border-l border-border flex flex-col ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <span className="hud-title text-sm">Conversation</span>
                <button
                  onClick={() => setRightOpen(false)}
                  className="text-foreground-subtle hover:text-foreground"
                >
                  <X size={18} />
                </button>
              </div>
              <RightPanelContent
                messages={messages}
                historyEndRef={historyEndRef}
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .twin-page {
          background:
            radial-gradient(
              ellipse 60% 50% at 50% 30%,
              rgba(24, 185, 205, 0.05),
              transparent 70%
            ),
            var(--background);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          scrollbar-width: none;
        }
        .scrollbar-theme *::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .scrollbar-theme *::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-theme *::-webkit-scrollbar-thumb {
          background: var(--border-color);
          border-radius: 999px;
        }
        .scrollbar-theme *::-webkit-scrollbar-thumb:hover {
          background: var(--arklife-primary);
        }
        .scrollbar-theme * {
          scrollbar-width: thin;
          scrollbar-color: var(--border-color) transparent;
        }
        .twin-wave {
          animation: twinWave 1.1s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes twinWave {
          0%,
          100% {
            transform: scaleY(0.45);
          }
          50% {
            transform: scaleY(1);
          }
        }
        .twin-scan {
          animation: twinScan 3.2s ease-in-out infinite;
        }
        @keyframes twinScan {
          0% {
            top: 8%;
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          85% {
            opacity: 1;
          }
          100% {
            top: 92%;
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
};

/* ── Right panel — chat history only ─────────────────────────────────── */
const RightPanelContent = ({
  messages,
  historyEndRef,
}: {
  messages: ChatMessage[];
  historyEndRef: any;
}) => (
  <>
    <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
      {messages.length === 0 && (
        <p className="text-xs text-foreground-subtle text-center mt-8 px-2">
          No messages yet. Say hello to start.
        </p>
      )}
      {messages.map((m) => (
        <MessageBubble key={m._id} message={m} />
      ))}
      <div ref={historyEndRef} />
    </div>
  </>
);

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] rounded-xl px-3 py-1.5 text-xs leading-relaxed ${
          isUser
            ? "bg-primary text-background rounded-br-sm"
            : "bg-surface-elevated border border-border text-foreground rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{message.text}</div>
        ) : (
          <div className="chat-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.text}
            </ReactMarkdown>
          </div>
        )}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-border/60 text-[10px] text-foreground-muted">
            📄 {message.sources.map((s) => s.fileName).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
};

export default AvatarChatPage;
