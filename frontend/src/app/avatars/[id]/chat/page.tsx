"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
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
  PanelLeft,
  PanelRight,
  Activity,
  Heart,
  Moon,
  Droplet,
  Ruler,
  Weight,
  MapPin,
  Wind,
  Footprints,
} from "lucide-react";
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

  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
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
      };
      setMessages((prev) => [...prev, avatarMsg]);

      if (replyText) {
        // engineState stays "listening" (set above) through the entire
        // TTS fetch inside playCaptionWithAudio — it only becomes
        // "speaking" once audio.onplaying actually fires.
        playCaptionWithAudio(replyText, voiceId);
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
    recognition.lang = "en-US";

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
  }, []);

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

  return (
    <div className="h-[90vh] w-full bg-background text-foreground flex overflow-hidden scrollbar-theme">
      {/* ── Left panel — avatar info — desktop static, mobile slide-over ── */}
      <aside className="hidden lg:flex flex-col w-70 xl:w-90 border-r border-border shrink-0 bg-surface">
        <LeftPanelContent
          avatar={avatar}
          stateLabel={stateLabel}
          stateColor={stateColor}
        />
      </aside>

      <AnimatePresence>
        {leftOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-overlay backdrop-blur-sm"
            onClick={() => setLeftOpen(false)}
          >
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              className="h-full w-[80%] max-w-xs bg-surface border-r border-border flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
                <span className="hud-title text-xs text-foreground normal-case">
                  Twin Info
                </span>
                <button
                  onClick={() => setLeftOpen(false)}
                  className="text-foreground-subtle"
                >
                  <X size={18} />
                </button>
              </div>
              <LeftPanelContent
                avatar={avatar}
                stateLabel={stateLabel}
                stateColor={stateColor}
              />
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Center — avatar viewport, caption, input ────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0  overflow-hidden">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-2 py-2 border-b border-border shrink-0">
          <button
            onClick={() => setLeftOpen(true)}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-primary transition-colors"
          >
            <PanelLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${engineState === "idle" ? "bg-foreground-subtle" : "bg-primary animate-pulse"}`}
            />
            <span className="text-sm font-bold">{avatar.name}</span>
          </div>
          <button
            onClick={() => setRightOpen(true)}
            className="p-1.5 rounded-lg text-foreground-muted hover:text-primary transition-colors"
          >
            <PanelRight size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 px-2 py-2 md:px-4 md:py-3">
          <div className="relative w-full max-w-[min(58vh,24rem)] aspect-square rounded-2xl border border-border bg-surface overflow-hidden shrink-0">
            <div
              className="absolute inset-0 rounded-2xl transition-shadow duration-500 pointer-events-none z-20"
              style={{
                boxShadow:
                  engineState === "speaking"
                    ? "inset 0 0 0 2px var(--arklife-primary), 0 0 40px rgba(24,185,205,0.25)"
                    : engineState === "listening"
                      ? "inset 0 0 0 2px var(--warning), 0 0 40px rgba(245,158,11,0.15)"
                      : "inset 0 0 0 1px var(--border-color)",
              }}
            />

            {/* Still hero image — the permanent base layer. Its opacity
                is the exact inverse of the video's, so the crossfade
                below has no gap: there is never a frame where neither
                (or both, oddly) is the visible one. */}
            {avatar.heroImageUrl ? (
              <motion.img
                src={getAssetUrl(avatar.heroImageUrl)}
                alt={avatar.name}
                className="absolute inset-0 w-full h-full object-cover"
                animate={{ opacity: showMasterVideo ? 0 : 1 }}
                transition={{ duration: 0.15 }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-foreground-subtle">
                <MessageSquare size={40} strokeWidth={1} />
                <span className="hud-label">3D Avatar — Coming Soon</span>
              </div>
            )}

            {/* Master video — ALWAYS mounted when masterVideoUrl exists,
                regardless of speaking state. preload="auto" means the
                browser buffers it in the background the moment the page
                loads, so by the time engineState actually becomes
                "speaking" (driven by audio.onplaying — real playback,
                not the API call), play() is instant with nothing left to
                fetch. Muted because the audible TTS audio is a separate
                <audio> element; this clip is visual only. Play/pause is
                handled by the useEffect above, not by mounting/unmounting
                this element — that's what removes both the lag and the
                blank-screen flash between messages. */}
            {avatar.masterVideoUrl && (
              <motion.video
                ref={videoElRef}
                src={avatar.masterVideoUrl}
                className="absolute inset-0 w-full h-full object-cover"
                animate={{ opacity: showMasterVideo ? 1 : 0 }}
                transition={{ duration: 0.15 }}
                loop
                muted
                playsInline
                preload="auto"
                onError={() => {
                  // Clip failed to load (e.g. expired signed URL) — flip
                  // videoBroken so showMasterVideo stays false and the
                  // play/pause effect stops trying to use this element.
                  // The hero image underneath is already the visible
                  // layer whenever this isn't showing, so nothing else
                  // breaks.
                  setVideoBroken(true);
                }}
              />
            )}

            <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-background/70 backdrop-blur-md border border-border px-2 py-0.5 rounded-full z-30">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  engineState === "speaking"
                    ? "bg-primary animate-pulse"
                    : engineState === "listening"
                      ? "bg-warning animate-pulse"
                      : "bg-foreground-subtle"
                }`}
              />
              <span className="hud-label">{stateLabel}</span>
            </div>
          </div>

          {/* Live caption */}
          <div className="w-full max-w-[min(58vh,24rem)] min-h-[3.5rem] bg-surface border border-border rounded-xl px-3.5 py-2.5 shrink-0">
            <span className="hud-label mb-1 flex items-center gap-1.5 text-primary/80">
              {audioFailed ? (
                <>
                  <VolumeX size={11} /> Caption (audio unavailable)
                </>
              ) : (
                <>
                  <Volume2 size={11} /> Live Caption
                </>
              )}
            </span>
            <p className="text-sm text-foreground leading-relaxed line-clamp-3">
              {caption ? (
                <>
                  {caption}
                  {!captionDone && (
                    <span className="inline-block w-1.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
                  )}
                </>
              ) : (
                <span className="text-foreground-subtle">
                  Say hello to start the conversation with {avatar.name}.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Sticky input bar */}
        <div className="shrink-0 border-t border-border bg-surface px-2 py-2 md:px-4 md:py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleListening}
              disabled={isSending}
              className={`shrink-0 w-10 h-10 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-40 ${
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
              className="flex-1 min-w-0 bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-primary/60 transition-colors disabled:opacity-60"
            />

            <button
              onClick={handleSend}
              disabled={isSending || !inputText.trim()}
              className="shrink-0 w-10 h-10 rounded-lg bg-primary text-background flex items-center justify-center disabled:opacity-30 hover:brightness-110 transition-all"
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
      </div>

      {/* ── Right panel — chat history — desktop static, mobile slide-over ── */}
      <aside className="hidden lg:flex flex-col w-90 xl:w-100 border-l border-border shrink-0 bg-surface">
        <RightPanelContent messages={messages} historyEndRef={historyEndRef} />
      </aside>

      <AnimatePresence>
        {rightOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-40 bg-overlay backdrop-blur-sm"
            onClick={() => setRightOpen(false)}
          >
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.22 }}
              className="h-full w-[80%] max-w-xs bg-surface border-l border-border flex flex-col ml-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border shrink-0">
                <span className="hud-title text-xs text-foreground normal-case">
                  Conversation
                </span>
                <button
                  onClick={() => setRightOpen(false)}
                  className="text-foreground-subtle"
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

      {/* Themed scrollbars */}
      <style jsx global>{`
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

        .heartbeat-icon {
          animation: heartbeatPulse 1.15s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes heartbeatPulse {
          0%,
          100% {
            transform: scale(1);
          }
          15% {
            transform: scale(1.25);
          }
          30% {
            transform: scale(1);
          }
          45% {
            transform: scale(1.15);
          }
          60% {
            transform: scale(1);
          }
        }
        .ecg-line {
          stroke-dasharray: 260;
          stroke-dashoffset: 260;
          animation: ecgDraw 2.4s linear infinite;
        }
        @keyframes ecgDraw {
          0% {
            stroke-dashoffset: 260;
            opacity: 0.3;
          }
          50% {
            stroke-dashoffset: 0;
            opacity: 1;
          }
          100% {
            stroke-dashoffset: -260;
            opacity: 0.3;
          }
        }
        .ring-gauge-pulse {
          animation: ringPulse 2.6s ease-in-out infinite;
        }
        @keyframes ringPulse {
          0%,
          100% {
            opacity: 0.35;
          }
          50% {
            opacity: 0.9;
          }
        }
      `}</style>
    </div>
  );
};

/* ── Left panel — avatar identity + health overview + settings ──────── */
const LeftPanelContent = ({
  avatar,
  stateLabel,
  stateColor,
}: {
  avatar: Avatar;
  stateLabel: string;
  stateColor: string;
}) => (
  <>
    <div className="p-3 border-b border-border shrink-0">
      <Link
        href="/avatars"
        className="hud-label flex items-center gap-1.5 text-foreground-subtle hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} /> All Twins
      </Link>
    </div>

    <div className="p-3 flex items-center gap-3 border-b border-border shrink-0">
      <div className="relative w-14 h-14 rounded-full overflow-hidden bg-surface-elevated border border-border shrink-0">
        {avatar.heroImageUrl && (
          <img
            src={getAssetUrl(avatar.heroImageUrl)}
            className="w-full h-full object-cover"
            alt={avatar.name}
          />
        )}
        <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-background border-2 border-background flex items-center justify-center">
          <span
            className={`w-2 h-2 rounded-full ${stateColor.includes("primary") ? "bg-primary animate-pulse" : stateColor.includes("warning") ? "bg-warning animate-pulse" : "bg-foreground-subtle"}`}
          />
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate">{avatar.name}</p>
        <p className={`hud-label mt-0.5 ${stateColor}`}>{stateLabel}</p>
      </div>
    </div>

    <div className="flex-1 min-h-0 overflow-y-auto">
      <HealthOverview />
    </div>

    <div className="p-3 border-t border-border shrink-0 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-[10px] font-bold text-foreground-subtle">
        <span>{avatar.photoUrls?.length ?? 0} photos</span>
        <span>{avatar.voiceSampleUrls?.length ?? 0} voice</span>
        <span className="capitalize">{avatar.status}</span>
      </div>
      <Link
        href={`/avatars/${avatar._id}`}
        className="p-2 rounded-lg border border-border hover:border-primary/40 text-foreground-muted hover:text-primary transition-colors shrink-0"
        title="Edit Twin"
      >
        <Settings2 size={14} />
      </Link>
    </div>
  </>
);

/* ── Health Overview — the sidebar's dominant section, sample data ──── */
const HealthOverview = () => (
  <div className="p-3.5">
    <div className="flex items-center justify-between mb-3.5">
      <p className="hud-label text-primary/80 flex items-center gap-1.5 text-xs">
        <Activity size={13} /> Vitals Overview
      </p>
      <span className="flex items-center gap-1 text-[9px] font-bold text-warning uppercase tracking-wide bg-warning/10 border border-warning/25 px-2 py-0.5 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
        Demo Data
      </span>
    </div>

    {/* Heart rate — hero metric, animated ECG line */}
    <div className="bg-surface-elevated border border-border rounded-xl p-4 mb-3 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 hud-label text-foreground-muted">
          <Heart size={13} className="text-error heartbeat-icon" /> Heart Rate
        </span>
        <span className="hud-metric text-2xl text-foreground leading-none">
          72{" "}
          <span className="text-[11px] text-foreground-subtle font-normal">
            bpm
          </span>
        </span>
      </div>
      <svg
        viewBox="0 0 200 44"
        className="w-full h-10 ecg-svg"
        preserveAspectRatio="none"
      >
        <polyline
          points="0,22 30,22 40,8 50,36 60,22 90,22 100,4 110,40 120,22 200,22"
          fill="none"
          stroke="var(--arklife-primary)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ecg-line"
        />
      </svg>
      <p className="text-[10px] text-foreground-subtle mt-1">
        Resting — normal range
      </p>
    </div>

    {/* Sleep + Hydration — twin ring gauges with sample fills */}
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="bg-surface-elevated border border-border rounded-xl p-3.5 flex flex-col items-center">
        <RingGauge
          icon={<Moon size={15} className="text-info" />}
          colorVar="var(--info)"
          percent={0.82}
        />
        <span className="hud-metric text-lg text-foreground mt-2">7.4h</span>
        <span className="hud-label text-foreground-subtle">Sleep</span>
        <span className="text-[9px] text-info mt-0.5 font-bold">
          Good quality
        </span>
      </div>
      <div className="bg-surface-elevated border border-border rounded-xl p-3.5 flex flex-col items-center">
        <RingGauge
          icon={<Droplet size={15} className="text-primary" />}
          colorVar="var(--arklife-primary)"
          percent={0.64}
        />
        <span className="hud-metric text-lg text-foreground mt-2">1.6L</span>
        <span className="hud-label text-foreground-subtle">Hydration</span>
        <span className="text-[9px] text-warning mt-0.5 font-bold">
          Below goal
        </span>
      </div>
    </div>

    {/* SpO2 + Steps — secondary metrics row */}
    <div className="grid grid-cols-2 gap-3 mb-3">
      <div className="bg-surface-elevated border border-border rounded-xl p-3">
        <span className="hud-label text-foreground-muted flex items-center gap-1.5 mb-1">
          <Wind size={12} className="text-primary" /> SpO2
        </span>
        <p className="hud-metric text-lg text-foreground">
          98<span className="text-xs text-foreground-subtle">%</span>
        </p>
      </div>
      <div className="bg-surface-elevated border border-border rounded-xl p-3">
        <span className="hud-label text-foreground-muted flex items-center gap-1.5 mb-1">
          <Footprints size={12} className="text-primary" /> Steps
        </span>
        <p className="hud-metric text-lg text-foreground">6,214</p>
      </div>
    </div>

    {/* Bio — height / weight / location */}
    <div className="bg-surface-elevated border border-border rounded-xl p-3.5 space-y-2.5">
      <p className="hud-label text-foreground-subtle mb-0.5">Bio</p>
      <BioRow icon={<Ruler size={13} />} label="Height" value="178 cm" />
      <BioRow icon={<Weight size={13} />} label="Weight" value="74 kg" />
      <BioRow icon={<MapPin size={13} />} label="Location" value="Milan, IT" />
    </div>

    <p className="hud-label text-foreground-subtle mt-3 text-center leading-relaxed px-1">
      Sample data — connect a wearable for live vitals
    </p>
  </div>
);

/* Radial progress ring — accepts a real percent for sample fills */
const RingGauge = ({
  icon,
  colorVar,
  percent = 0,
}: {
  icon: React.ReactNode;
  colorVar: string;
  percent?: number;
}) => {
  const radius = 19;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percent);
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth="3.5"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke={colorVar}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="ring-gauge-pulse"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {icon}
      </span>
    </div>
  );
};

const BioRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) => (
  <div className="flex items-center justify-between">
    <span className="flex items-center gap-1.5 hud-label text-foreground-muted">
      {icon} {label}
    </span>
    <span className="text-xs font-medium text-foreground">{value}</span>
  </div>
);

const InfoRow = ({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) => (
  <div className="flex items-center justify-between px-1 py-1.5">
    <span className="hud-label">{label}</span>
    <span className="hud-metric text-xs text-foreground capitalize">
      {value}
    </span>
  </div>
);

/* ── Right panel — chat history only ─────────────────────────────────── */
const RightPanelContent = ({
  messages,
  historyEndRef,
}: {
  messages: ChatMessage[];
  historyEndRef: any;
}) => (
  <>
    <div className="px-3 py-2.5 border-b border-border shrink-0">
      <h2 className="hud-title text-xs text-foreground normal-case">
        Conversation
      </h2>
    </div>
    <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2.5 space-y-1.5">
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
        {message.text}
      </div>
    </div>
  );
};

export default AvatarChatPage;
