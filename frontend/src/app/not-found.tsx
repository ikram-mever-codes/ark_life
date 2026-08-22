"use client";
import React from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-[80vh] bg-background text-foreground flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Error Code */}
        <div className="relative inline-block">
          <h1 className="hud-title text-9xl text-foreground/5 normal-case select-none leading-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <AlertTriangle size={48} className="text-primary animate-bounce" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="hud-title text-2xl text-primary normal-case tracking-tight">
            Neural Path Desynchronized
          </h2>
          <p className="hud-label leading-relaxed text-foreground-subtle">
            The requested coordinate does not exist within the current ArkLife
            protocol.
          </p>
        </div>

        {/* Terminal Box for Aesthetic */}
        <div className="bg-surface-elevated border border-border p-4 rounded-md font-mono text-[10px] text-left text-primary/60">
          <p>{`> ERROR_CODE: 0xNF404`}</p>
          <p>{`> STATUS: SEGMENT_NOT_FOUND`}</p>
          <p>{`> ACTION: REVERT_TO_BASE_COMMAND`}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-background py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <Home size={14} /> Back to Dashboard
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 flex items-center justify-center gap-2 border border-border text-foreground-muted py-3 rounded-lg text-[11px] font-black uppercase tracking-widest hover:bg-surface transition-all"
          >
            <RefreshCcw size={14} /> Retry Sync
          </button>
        </div>
      </div>
    </main>
  );
}
