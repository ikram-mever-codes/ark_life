"use client";
import React from "react";

const Loading = () => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050505] text-white">
      {/* Pulse Logo */}
      <div className="relative mb-8">
        <div className="flex h-16 w-16 items-center justify-center border-2 border-primary rounded-sm animate-pulse">
          <span className="font-bold text-3xl text-primary italic">A</span>
        </div>
        {/* Radar Effect */}
        <div className="absolute inset-0 border border-primary rounded-sm animate-ping opacity-20" />
      </div>

      {/* Calibration Text */}
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.4em] text-primary font-black animate-pulse">
          Synchronizing Neural Baseline
        </span>

        {/* Scanning Bar */}
        <div className="w-48 h-[1px] bg-white/10 relative overflow-hidden">
          <div className="absolute inset-0 bg-primary w-1/3 animate-[scan_1.5s_ease-in-out_infinite]" />
        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(300%);
          }
        }
      `}</style>
    </div>
  );
};

export default Loading;
