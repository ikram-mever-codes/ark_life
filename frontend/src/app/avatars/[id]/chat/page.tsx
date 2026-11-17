"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prepareSpeech, splitForSpeech } from "@/utils/util";
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
  Square,
  Maximize2,
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

  const [audioFailed, setAudioFailed] = useState(false);

  const [rightOpen, setRightOpen] = useState(false); // conversation drawer
  const [readerOpen, setReaderOpen] = useState(false); // full-answer reader
  // Escape closes the reader / conversation drawer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setReaderOpen(false);
        setRightOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  /* ── Voice playback: chunked & pipelined ───────────────────────────
   * Long answers used to be synthesised in ONE ElevenLabs request, so
   * nothing played until the whole audio existed (seconds of silence) and
   * the text was revealed word-by-word in sync with it.
   *
   * Now: the full answer is shown immediately in the reply panel, and the
   * speech text is split into sentence chunks. The first chunk is short so
   * the voice starts fast; each next chunk is fetched while the current one
   * plays. `speechGenRef` cancels an older reply when a new one starts.
   * engineState becomes "speaking" only on real playback (audio.onplaying)
   * so the master video stays in sync with audible speech.
   */
  const speechGenRef = useRef(0);

  const stopSpeech = useCallback(() => {
    speechGenRef.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setEngineState("idle");
  }, []);

  const playBlob = useCallback(
    (blob: Blob, gen: number) =>
      new Promise<boolean>((resolve) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        const done = (ok: boolean) => {
          URL.revokeObjectURL(url);
          resolve(ok);
        };
        audio.onplaying = () => {
          if (gen === speechGenRef.current) setEngineState("speaking");
        };
        audio.onended = () => done(true);
        audio.onerror = () => done(false);
        audio.onpause = () => {
          // stopSpeech() pauses the element: end this chunk immediately.
          if (gen !== speechGenRef.current) done(false);
        };
        audio.play().catch(() => done(false));
      }),
    [],
  );

  const speakReply = useCallback(
    async (markdown: string, voiceId?: string) => {
      const gen = ++speechGenRef.current;
      if (audioRef.current) audioRef.current.pause();
      setAudioFailed(false);

      const chunks = splitForSpeech(prepareSpeech(markdown));
      if (!voiceId || chunks.length === 0) {
        setEngineState("idle");
        return;
      }

      const fetchChunk = (i: number) =>
        testAvatarSpeech(voiceId, chunks[i], { silent: true });

      let next: Promise<Blob> = fetchChunk(0);
      for (let i = 0; i < chunks.length; i++) {
        let blob: Blob;
        try {
          blob = await next;
        } catch {
          if (gen === speechGenRef.current) {
            setAudioFailed(true);
            setEngineState("idle");
          }
          return;
        }
        if (gen !== speechGenRef.current) return; // a newer reply took over
        if (i + 1 < chunks.length) {
          next = fetchChunk(i + 1); // prefetch while this chunk plays
          next.catch(() => {});
        }
        const ok = await playBlob(blob, gen);
        if (gen !== speechGenRef.current) return;
        if (!ok) {
          setAudioFailed(true);
          break;
        }
      }
      if (gen === speechGenRef.current) setEngineState("idle");
    },
    [playBlob],
  );

  // Stop any voice when leaving the page.
  useEffect(() => () => stopSpeech(), [stopSpeech]);

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
        speakReply(replyText, voiceId);
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
          <div className="relative h-[52vh] sm:h-[60vh] lg:h-auto lg:flex-1 lg:min-h-[240px] rounded-lg overflow-hidden border border-border/50 bg-[radial-gradient(ellipse_at_center,rgba(24,185,205,0.06),transparent_70%)]">
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

          {/* Reply panel: the FULL answer is shown immediately (Markdown),
              scrollable, with an expand button for long answers and a stop
              button for the voice. */}
          <div className="rounded-lg border border-border/70 bg-surface-elevated/60 px-4 py-3 shrink-0 lg:shrink lg:min-h-[7rem] lg:max-h-[46%] flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 mb-1.5 shrink-0">
              <span className="hud-label !text-[9.5px] flex items-center gap-1.5 text-primary/80 shrink-0">
                {audioFailed ? <VolumeX size={11} /> : <Volume2 size={11} />}
                {audioFailed
                  ? "Reply (audio unavailable)"
                  : engineState === "speaking"
                    ? "Speaking"
                    : engineState === "listening"
                      ? "Thinking…"
                      : "Last reply"}
              </span>
              <div className="flex items-center gap-1.5 min-w-0">
                {lastReply?.sources && lastReply.sources.length > 0 && (
                  <span className="hidden sm:inline text-[10px] text-foreground-subtle truncate">
                    📄 {lastReply.sources.map((s) => s.fileName).join(" · ")}
                  </span>
                )}
                {engineState === "speaking" && (
                  <button
                    onClick={stopSpeech}
                    className="shrink-0 flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-border hover:border-error/60 hover:text-error"
                    title="Stop voice"
                  >
                    <Square size={10} /> Stop
                  </button>
                )}
                {lastReply && (
                  <button
                    onClick={() => setReaderOpen(true)}
                    className="shrink-0 p-1 rounded border border-border text-foreground-muted hover:text-primary hover:border-primary/50"
                    title="Read full answer"
                    aria-label="Read full answer"
                  >
                    <Maximize2 size={12} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0 max-h-[45vh] lg:max-h-none overflow-y-auto overscroll-contain text-sm leading-relaxed pr-1">
              {lastReply ? (
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

      {/* ── Full-answer reader ──────────────────────────────────────────── */}
      <AnimatePresence>
        {readerOpen && lastReply && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-overlay backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
            onClick={() => setReaderOpen(false)}
          >
            <div
              className="ui-panel-elevated w-full max-w-3xl max-h-[88vh] rounded-lg flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
                <span className="hud-title text-sm">{avatar.name} — answer</span>
                <button
                  onClick={() => setReaderOpen(false)}
                  className="text-foreground-subtle hover:text-foreground"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 text-[15px] leading-relaxed">
                <div className="chat-md text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {lastReply.text}
                  </ReactMarkdown>
                </div>
                {lastReply.sources && lastReply.sources.length > 0 && (
                  <p className="mt-4 pt-3 border-t border-border text-xs text-foreground-muted">
                    📄 {lastReply.sources.map((s) => s.fileName).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
