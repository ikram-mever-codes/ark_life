"use client";
import React from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCcw } from "lucide-react";

export default function NotFound() {
  return (
    <main className="min-h-[80vh] text-white flex flex-col items-center justify-center">
      <div className="w-full max-w-md text-center space-y-8">
        {/* Error Code */}
        <div className="relative inline-block">
          <h1 className="text-9xl font-black text-white/5 italic select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <AlertTriangle size={48} className="text-primary animate-bounce" />
          </div>
        </div>

        {/* Message */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold uppercase tracking-tighter italic text-primary">
            Neural Path Desynchronized
          </h2>
          <p className="text-sm text-white/40 leading-relaxed uppercase tracking-widest text-[10px]">
            The requested coordinate does not exist within the current ArkLife
            protocol.
          </p>
        </div>

        {/* Terminal Box for Aesthetic */}
        <div className="bg-white/5 border border-white/10 p-4 rounded-md font-mono text-[10px] text-left text-primary/60">
          <p>{`> ERROR_CODE: 0xNF404`}</p>
          <p>{`> STATUS: SEGMENT_NOT_FOUND`}</p>
          <p>{`> ACTION: REVERT_TO_BASE_COMMAND`}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-black py-3 rounded font-black text-[11px] uppercase tracking-widest hover:brightness-110 transition-all"
          >
            <Home size={14} /> Back to Dashboard
          </Link>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 flex items-center justify-center gap-2 border border-white/10 py-3 rounded font-black text-[11px] uppercase tracking-widest hover:bg-white/5 transition-all"
          >
            <RefreshCcw size={14} /> Retry Sync
          </button>
        </div>
      </div>
    </main>
  );
}
