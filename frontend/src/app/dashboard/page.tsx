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
  Cpu,
  Globe,
  Fingerprint,
  Layers,
  ShieldCheck,
  TrendingUp,
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
        // Use the typed API helper instead of raw fetch
        const dashboardData = await getSystemOverviewSubmit();
        setData(dashboardData);
      } catch (err) {
        console.error("Dashboard failed to synchronize with Neural Core");
      }
    };

    fetchStats();

    // 2. Check for First Time User
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
      target: "training",
    },
    {
      title: "Memory Injection",
      desc: "Upload files here to give your Twin a long-term memory.",
      target: "vault",
    },
    {
      title: "Neural Chat",
      desc: "Start a live visual session with your digital Twin.",
      target: "chat",
    },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 p-4 lg:p-10 font-sans relative overflow-hidden">
      {/* ONBOARDING MANUAL OVERLAY */}
      <AnimatePresence>
        {showManual && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0d0d12] border border-primary/30 p-8 rounded-3xl max-w-md w-full relative shadow-[0_0_50px_rgba(var(--primary-rgb),0.2)]"
            >
              <button
                onClick={() => setShowManual(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-white"
              >
                <X size={20} />
              </button>
              <div className="mb-6">
                <span className="text-[10px] text-primary font-black uppercase tracking-widest">
                  Manual Step {currentStep + 1}/3
                </span>
                <h3 className="text-2xl font-bold text-white mt-1">
                  {manualSteps[currentStep].title}
                </h3>
                <p className="text-gray-400 mt-2 leading-relaxed">
                  {manualSteps[currentStep].desc}
                </p>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex gap-1">
                  {manualSteps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 w-4 rounded-full ${i === currentStep ? "bg-primary" : "bg-white/10"}`}
                    />
                  ))}
                </div>
                <button
                  onClick={() =>
                    currentStep === 2
                      ? completeManual()
                      : setCurrentStep((prev) => prev + 1)
                  }
                  className="px-6 py-2 bg-primary text-black font-bold rounded-xl text-sm"
                >
                  {currentStep === 2 ? "Initialize System" : "Next Protocol"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Fingerprint className="text-primary w-5 h-5" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 italic">
              ArkLife OS Protocol
            </span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tighter text-white">
            Neural Command Center
          </h1>
        </div>
      </header>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* STATS FROM API */}
        {(data?.stats || [{}, {}, {}]).map((stat: any, i: number) => (
          <div
            key={i}
            className="lg:col-span-4 bg-[#0a0a0c] border border-white/5 p-6 rounded-2xl flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 font-bold">
                {stat.label || "Loading..."}
              </p>
              <p className="text-2xl font-black font-mono">
                {stat.value || "---"}
              </p>
            </div>
            <Zap className="text-primary opacity-20" size={24} />
          </div>
        ))}

        {/* REDIRECTS & INTERACTIVITY */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-[#0d0d12] border border-white/10 rounded-3xl p-8">
            <h3 className="text-xl font-bold text-white flex items-center gap-2 mb-8">
              <Activity className="text-primary w-5 h-5" /> Core Synthesis
              Status
            </h3>
            <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${data?.trainingProgress || 0}%` }}
                className="h-full bg-primary"
              />
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LINK TO CHAT */}
            <button
              onClick={() =>
                router.push(
                  data?.activeAvatarId
                    ? `/avatars/${data.activeAvatarId}/chat`
                    : "/avatars",
                )
              }
              className="relative p-8 rounded-3xl bg-primary text-black transition-all hover:scale-[1.02] active:scale-95 text-left"
            >
              <h4 className="text-2xl font-black tracking-tighter mb-2">
                Neural Chat
              </h4>
              <p className="text-sm opacity-80">Link with your Digital Twin</p>
              <Play className="mt-4" size={24} fill="currentColor" />
            </button>

            {/* LINK TO VAULT */}
            <button
              onClick={() => router.push("/memory")}
              className="relative p-8 rounded-3xl bg-[#0d0d12] border border-white/10 hover:border-primary/50 transition-all text-left"
            >
              <h4 className="text-2xl font-black tracking-tighter mb-2 text-white">
                Memory Injection
              </h4>
              <p className="text-sm text-gray-500">Expand semantic knowledge</p>
              <Database className="mt-4 text-primary" size={24} />
            </button>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#0d0d12] border border-white/10 rounded-3xl p-6">
            <h4 className="text-sm font-bold uppercase tracking-widest text-primary mb-4">
              Vault Capacity
            </h4>
            <div className="space-y-4">
              <div className="flex justify-between text-xs font-mono">
                <span>Usage</span>
                <span>{Math.round(data?.vaultUsage || 0)}%</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${data?.vaultUsage || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
