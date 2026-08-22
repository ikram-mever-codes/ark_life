"use client";
import React from "react";

const Loading = () => {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background text-foreground">
      {/* Pulse Logo */}
      <div className="relative mb-8">
        <div className="flex h-16 w-16 items-center justify-center border-2 border-primary rounded-sm animate-pulse">
          <span className="hud-title text-3xl text-primary normal-case">A</span>
        </div>
        {/* Radar Effect */}
        <div className="absolute inset-0 border border-primary rounded-sm animate-ping opacity-20" />
      </div>

      {/* Calibration Text */}
      <div className="flex flex-col items-center gap-2">
        <span className="hud-label text-primary text-[10px] animate-pulse">
          Synchronizing Neural Baseline
        </span>

        {/* Scanning Bar */}
        <div className="w-48 h-[1px] bg-border/40 relative overflow-hidden">
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
