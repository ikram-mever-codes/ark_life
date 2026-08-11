"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare,
  Database,
  Activity,
  Zap,
  Play,
  Fingerprint,
  ShieldCheck,
  ChevronRight,
  X,
} from "lucide-react";
import { getSystemOverviewSubmit } from "@/api/auth";

const Dashboard: React.FC = () => {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [showManual, setShowManual] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const dashboardData = await getSystemOverviewSubmit();
        setData(dashboardData);
      } catch (err) {
        console.error("Dashboard failed to synchronize with Neural Core");
      }
    };
    fetchStats();
    const hasSeenManual = localStorage.getItem("ark_manual_seen");
    if (!hasSeenManual) setShowManual(true);
  }, []);

  const completeManual = () => {
    localStorage.setItem("ark_manual_seen", "true");
    setShowManual(false);
  };

  const manualSteps = [
    {
      title: "Neural Core",
      desc: "This is your Avatar's brain status. Keep it synced for better responses.",
    },
    {
      title: "Memory Injection",
      desc: "Upload files here to give your Twin a long-term memory.",
    },
    {
      title: "Neural Chat",
      desc: "Start a live visual session with your digital Twin.",
    },
  ];

  const handleChatRedirection = () => router.push("/avatars");

  const progress = data?.trainingProgress || 0;
  const stats = data?.stats || [{}, {}, {}];

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-overlay backdrop-blur-sm flex items-end sm:items-center justify-center"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-surface-elevated border border-primary/30 p-6 sm:p-8 rounded-t-3xl sm:rounded-3xl max-w-md w-full relative shadow-2xl"
            >
              <button
                onClick={() => setShowManual(false)}
                className="absolute top-4 right-4 text-foreground-subtle hover:text-foreground"
              >
                <X size={20} />
              </button>
              <span className="text-[10px] text-primary font-black uppercase tracking-widest">
                Step {currentStep + 1} of 3
              </span>
              <h3 className="text-xl sm:text-2xl font-bold mt-1">
                {manualSteps[currentStep].title}
              </h3>
              <p className="text-foreground-muted mt-2 text-sm leading-relaxed">
                {manualSteps[currentStep].desc}
              </p>
              <div className="flex justify-between items-center mt-6">
                <div className="flex gap-1">
                  {manualSteps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all ${i === currentStep ? "w-6 bg-primary" : "w-3 bg-border"}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() =>
                    currentStep === 2
                      ? completeManual()
                      : setCurrentStep((p) => p + 1)
                  }
                  className="px-5 py-2.5 bg-primary text-background font-bold rounded-xl text-sm active:scale-95 transition-transform"
                >
                  {currentStep === 2 ? "Start" : "Next"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 pt-6 sm:px-8 sm:pt-8 lg:px-10">
        <div className="flex items-center gap-2">
          <Fingerprint className="text-primary w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary/80">
            ArkLife OS
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-foreground-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          System Online
        </div>
      </div>

      <div className="px-4 sm:px-8 lg:px-10 mt-3 mb-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight">
          Neural Command Center
        </h1>
      </div>

      {/* Hero status card — progress ring + primary CTA, single focal point */}
      <div className="px-4 sm:px-8 lg:px-10">
        <div className="bg-surface border border-border rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div
            className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-full grid place-items-center"
            style={{
              background: `conic-gradient(var(--arklife-primary) ${progress * 3.6}deg, var(--border-color) 0deg)`,
            }}
          >
            <div className="w-[calc(100%-10px)] h-[calc(100%-10px)] rounded-full bg-surface grid place-items-center">
              <div className="text-center">
                <p className="text-2xl font-black">{Math.round(progress)}%</p>
                <p className="text-[9px] uppercase tracking-widest text-foreground-subtle font-bold">
                  Synced
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 text-center sm:text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">
              Core Synthesis Status
            </p>
            <p className="text-foreground-muted text-sm mb-4 max-w-sm">
              Your Digital Twin's neural core, live and improving with every
              memory you add.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleChatRedirection}
                className="flex items-center justify-center gap-2 bg-primary text-background font-bold text-sm px-6 py-3 rounded-xl hover:brightness-110 active:scale-95 transition-all"
              >
                <Play size={16} fill="currentColor" /> Neural Chat
              </button>
              <button
                onClick={() => router.push("/memory")}
                className="flex items-center justify-center gap-2 bg-surface-elevated border border-border font-bold text-sm px-6 py-3 rounded-xl hover:border-primary/40 transition-colors"
              >
                <Database size={16} className="text-primary" /> Memory Vault
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat strip — horizontal scroll on mobile, grid on desktop */}
      <div className="mt-6 sm:mt-8">
        <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 sm:px-8 lg:px-10 pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible">
          {stats.map((stat: any, i: number) => (
            <div
              key={i}
              className="snap-start shrink-0 w-40 sm:w-auto bg-surface border border-border p-5 rounded-2xl flex items-center justify-between"
            >
              <div>
                <p className="text-[9px] uppercase tracking-widest text-foreground-subtle mb-1 font-bold">
                  {stat.label || "Loading..."}
                </p>
                <p className="text-xl font-black font-mono">
                  {stat.value || "---"}
                </p>
              </div>
              <Zap className="text-primary opacity-30 shrink-0" size={20} />
            </div>
          ))}
        </div>
      </div>

      {/* Secondary row — vault capacity, quick links */}
      <div className="px-4 sm:px-8 lg:px-10 mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-primary">
              Vault Capacity
            </h4>
            <span className="text-xs font-mono text-foreground-muted">
              {Math.round(data?.vaultUsage || 0)}%
            </span>
          </div>
          <div className="h-2 w-full bg-border/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-info transition-all"
              style={{ width: `${data?.vaultUsage || 0}%` }}
            />
          </div>
        </div>

        <button
          onClick={() => router.push("/avatars")}
          className="bg-surface border border-border rounded-2xl p-6 flex items-center justify-between hover:border-primary/40 transition-colors text-left"
        >
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-foreground-muted mb-1">
              Manage
            </h4>
            <p className="font-bold text-sm">All Digital Twins</p>
          </div>
          <ChevronRight className="text-primary" size={20} />
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
