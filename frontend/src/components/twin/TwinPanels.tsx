"use client";
// ═══════════════════════════════════════════════════════════════════════
// Twin Overview panels — layout from the ArkLife reference design:
//   left:  IDENTITY · VERIFIED · BIOMETRIC ID
//   right: HEALTH OVERVIEW · VITALS · LIFESTYLE
// Real data where it exists; health metrics are clearly marked as demo
// data until a wearable integration exists (future milestone).
// ═══════════════════════════════════════════════════════════════════════
import React, { useState } from "react";
import Link from "next/link";
import {
  Activity,
  Droplet,
  Fingerprint,
  Heart,
  Loader2,
  MessageSquare,
  Moon,
  Pencil,
  ScanFace,
  X,
} from "lucide-react";
import { Avatar, AvatarIdentity, updateAvatar } from "@/api/avatars";
import {
  CornerFrame,
  DemoBadge,
  HudField,
  HudPanel,
  LevelBar,
  MetricRow,
  ScoreRing,
  Sparkline,
  StatLine,
  Waveform,
} from "./Hud";

export const twinDisplayId = (id: string) =>
  `${id.slice(-8, -4)}.${id.slice(-4)}`.toUpperCase();

// ─── Top bar: logo · name · ID · tabs ──────────────────────────────────
export function TwinNav({
  avatar,
  active,
  onOpenChat,
  messageCount,
}: {
  avatar: Avatar;
  active: "overview" | "health" | "biography" | "settings";
  onOpenChat?: () => void;
  messageCount?: number;
}) {
  const tabs = [
    { key: "overview", label: "Overview", href: `/avatars/${avatar._id}/chat` },
    { key: "health", label: "Health", href: "/clinical" },
    { key: "biography", label: "Biography", href: `/avatars/${avatar._id}` },
    { key: "social", label: "Social", href: null },
    { key: "settings", label: "Settings", href: "/settings" },
  ] as const;

  return (
    <div className="w-full min-w-0 flex items-center gap-4 lg:gap-8 px-4 lg:px-6 h-14 border-b border-border/70 bg-background/80 backdrop-blur">
      <div className="flex items-center gap-3 min-w-0 shrink-0">
        <span className="h-8 w-8 rounded-full border border-foreground-muted/50 flex items-center justify-center shrink-0">
          <ScanFace size={15} className="text-foreground-muted" />
        </span>
        <span className="font-[family-name:var(--font-display)] text-lg sm:text-xl tracking-[0.12em] uppercase truncate max-w-[9rem] sm:max-w-none">
          {avatar.name}
        </span>
        <span className="hidden sm:inline text-[10px] tracking-[0.12em] text-foreground-subtle">
          ID: {twinDisplayId(avatar._id)}
        </span>
      </div>

      <nav className="flex-1 min-w-0 flex items-center gap-5 lg:gap-9 overflow-x-auto no-scrollbar">
        {tabs.map((t) =>
          t.href ? (
            <Link
              key={t.key}
              href={t.href}
              className={`relative text-[11px] uppercase tracking-[0.14em] whitespace-nowrap py-4 transition-colors ${
                active === t.key
                  ? "text-primary"
                  : "text-foreground-muted hover:text-foreground"
              }`}
            >
              {t.label}
              {active === t.key && (
                <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-primary shadow-[0_0_8px_rgba(24,185,205,0.7)]" />
              )}
            </Link>
          ) : (
            <span
              key={t.key}
              title="Coming in a future milestone"
              className="text-[11px] uppercase tracking-[0.14em] whitespace-nowrap text-foreground-subtle/60 cursor-default"
            >
              {t.label}
            </span>
          ),
        )}
      </nav>

      {onOpenChat && (
        <button
          onClick={onOpenChat}
          className="shrink-0 flex items-center gap-2 text-[11px] uppercase tracking-[0.12em] px-3 py-1.5 rounded-md border border-border hover:border-primary/60 hover:text-primary transition-colors"
        >
          <MessageSquare size={14} />
          <span className="hidden md:inline">Conversation</span>
          {!!messageCount && (
            <span className="text-[10px] text-primary">{messageCount}</span>
          )}
        </button>
      )}
    </div>
  );
}

// ─── IDENTITY ──────────────────────────────────────────────────────────
export function IdentityPanel({
  avatar,
  onUpdated,
}: {
  avatar: Avatar;
  onUpdated: (a: Avatar) => void;
}) {
  const [editing, setEditing] = useState(false);
  const id = avatar.identity || {};
  return (
    <HudPanel
      title="Identity"
      action={
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded text-foreground-subtle hover:text-primary"
          title="Edit identity"
          aria-label="Edit identity"
        >
          <Pencil size={13} />
        </button>
      }
    >
      <div className="space-y-3">
        <HudField label="Full name" value={avatar.name} />
        <div className="grid grid-cols-2 gap-3">
          <HudField label="Age" value={id.age ?? undefined} />
          <HudField label="Gender" value={id.gender} />
        </div>
        <HudField label="Location" value={id.location} />
        <HudField label="Occupation" value={id.occupation} />
        <HudField label="Languages" value={id.languages} />
        <div className="grid grid-cols-3 gap-3">
          <HudField label="Height" value={id.height} />
          <HudField label="Weight" value={id.weight} />
          <HudField label="Eyes" value={id.eyes} />
        </div>
      </div>
      {editing && (
        <IdentityEditor
          avatar={avatar}
          onClose={() => setEditing(false)}
          onSaved={(a) => {
            onUpdated(a);
            setEditing(false);
          }}
        />
      )}
    </HudPanel>
  );
}

function IdentityEditor({
  avatar,
  onClose,
  onSaved,
}: {
  avatar: Avatar;
  onClose: () => void;
  onSaved: (a: Avatar) => void;
}) {
  const [form, setForm] = useState<AvatarIdentity>({ ...(avatar.identity || {}) });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof AvatarIdentity) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const fields: { k: keyof AvatarIdentity; label: string; ph: string; type?: string }[] = [
    { k: "age", label: "Age", ph: "34", type: "number" },
    { k: "gender", label: "Gender", ph: "Female / Male / …" },
    { k: "location", label: "Location", ph: "Milano, IT" },
    { k: "occupation", label: "Occupation", ph: "Creative Director" },
    { k: "languages", label: "Languages", ph: "Italiano, English" },
    { k: "height", label: "Height", ph: "172 cm" },
    { k: "weight", label: "Weight", ph: "68 kg" },
    { k: "eyes", label: "Eyes", ph: "Brown" },
  ];

  const save = async () => {
    setSaving(true);
    try {
      const updated = await updateAvatar(avatar._id, {
        identity: {
          ...form,
          age:
            form.age === undefined || form.age === null || String(form.age) === ""
              ? null
              : Number(form.age),
        },
      });
      onSaved(updated);
    } catch {
      /* toast shown by api */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-overlay backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="ui-panel-elevated w-full max-w-md rounded-lg p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="hud-title text-base">Edit identity</h3>
          <button onClick={onClose} className="p-1 text-foreground-subtle hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {fields.map((f) => (
            <label key={f.k} className={f.k === "occupation" || f.k === "languages" || f.k === "location" ? "col-span-2" : ""}>
              <span className="hud-label !text-[9.5px]">{f.label}</span>
              <input
                type={f.type || "text"}
                value={(form[f.k] as any) ?? ""}
                onChange={set(f.k)}
                placeholder={f.ph}
                className="mt-1 w-full bg-background border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-md border border-border">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-primary text-background font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── VERIFIED ──────────────────────────────────────────────────────────
export function VerifiedPanel({ emailVerified }: { emailVerified?: boolean }) {
  return (
    <section className="rounded-lg border border-border/70 bg-surface-elevated/60 p-4 flex items-center gap-4">
      <span className="h-12 w-12 rounded-full border border-primary/40 flex items-center justify-center shrink-0 shadow-[0_0_14px_rgba(24,185,205,0.25)]">
        <Fingerprint size={24} className="text-primary" />
      </span>
      <div className="min-w-0">
        <p className="hud-title text-[12px] text-foreground">
          {emailVerified ? "Verified" : "Not verified"}
        </p>
        <p className="text-[11px] text-foreground-muted">
          {emailVerified ? "Account e-mail verified" : "Verify your e-mail address"}
        </p>
        <p className="text-[10px] text-foreground-subtle mt-0.5">SPID / CIE: not linked</p>
      </div>
    </section>
  );
}

// ─── BIOMETRIC ID ──────────────────────────────────────────────────────
export function BiometricPanel({
  avatar,
  imageUrl,
  speaking,
}: {
  avatar: Avatar;
  imageUrl?: string;
  speaking?: boolean;
}) {
  const photos = avatar.photoUrls?.length ?? 0;
  const voices = avatar.voiceSampleUrls?.length ?? 0;
  return (
    <HudPanel title="Biometric ID">
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-28 shrink-0 rounded overflow-hidden border border-border bg-background">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-cover grayscale-[35%] opacity-90" />
          )}
          {/* face-scan grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(rgba(24,185,205,0.18) 1px, transparent 1px), linear-gradient(90deg, rgba(24,185,205,0.18) 1px, transparent 1px)",
              backgroundSize: "12px 12px",
            }}
          />
          <span className="absolute left-0 right-0 h-px bg-primary/80 twin-scan" />
          <span className="absolute top-1 left-1 w-3 h-3 border-t border-l border-primary" />
          <span className="absolute bottom-1 right-1 w-3 h-3 border-b border-r border-primary" />
        </div>
        <div className="min-w-0">
          <p className="hud-label !text-[9px] leading-tight">Facial profile</p>
          <p className="hud-metric text-2xl text-primary mt-1">{photos}</p>
          <p className="text-[10px] text-foreground-subtle">
            {photos === 1 ? "photo" : "photos"} enrolled
          </p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-divider/70">
        <p className="hud-label !text-[9px] leading-tight">Voice recognition</p>
        <div className="flex items-center justify-between gap-3 mt-1">
          <Waveform active={!!avatar.voiceId && !!speaking} />
          <div className="text-right">
            <p className={`hud-metric text-lg ${avatar.voiceId ? "text-primary" : "text-foreground-subtle"}`}>
              {avatar.voiceId ? "Active" : "Not set"}
            </p>
            <p className="text-[10px] text-foreground-subtle">
              {voices} {voices === 1 ? "sample" : "samples"}
            </p>
          </div>
        </div>
      </div>
    </HudPanel>
  );
}

// ─── HEALTH OVERVIEW / VITALS / LIFESTYLE (demo data) ──────────────────
const DEMO = {
  score: 92,
  heartRate: 72,
  sleep: 8.1,
  stress: "Low",
  oxygen: 98,
  hrvSeries: [52, 58, 55, 63, 60, 68, 64, 71, 66, 74, 70, 77, 73, 69, 75],
  hrv: 62,
  bp: "118/76",
  resp: 16,
  temp: "36.6",
  lifestyle: [
    { label: "Activity level", value: 78, level: "High" },
    { label: "Nutrition", value: 66, level: "Good" },
    { label: "Hydration", value: 72, level: "Optimal" },
    { label: "Focus", value: 84, level: "High" },
  ],
};

export function HealthOverviewPanel() {
  return (
    <HudPanel title="Health overview" badge={<DemoBadge />}>
      <div className="flex items-center gap-4">
        <ScoreRing value={DEMO.score} />
        <div className="grid grid-cols-1 gap-2.5 min-w-0">
          <StatLine icon={<Heart size={14} />} label="Heart rate" value={DEMO.heartRate} unit="bpm" />
          <StatLine icon={<Moon size={14} />} label="Sleep quality" value={DEMO.sleep} unit="/10" />
          <StatLine icon={<Activity size={14} />} label="Stress level" value={DEMO.stress} />
          <StatLine icon={<Droplet size={14} />} label="Oxygen level" value={DEMO.oxygen} unit="%" />
        </div>
      </div>
    </HudPanel>
  );
}

export function VitalsPanel() {
  return (
    <HudPanel title="Vitals" badge={<DemoBadge />}>
      <Sparkline points={DEMO.hrvSeries} />
      <div className="mt-2">
        <MetricRow label="Heart rate variability" value={DEMO.hrv} unit="ms" />
        <MetricRow label="Blood pressure" value={DEMO.bp} unit="mmHg" />
        <MetricRow label="Respiratory rate" value={DEMO.resp} unit="rpm" />
        <MetricRow label="Body temperature" value={DEMO.temp} unit="°C" />
      </div>
    </HudPanel>
  );
}

export function LifestylePanel() {
  return (
    <HudPanel title="Lifestyle" badge={<DemoBadge />}>
      <div className="space-y-3.5">
        {DEMO.lifestyle.map((l) => (
          <LevelBar key={l.label} {...l} />
        ))}
      </div>
      <p className="text-[10px] text-foreground-subtle mt-4 leading-relaxed">
        Sample values. Live data arrives with wearable integration (Biometric
        Tracking).
      </p>
    </HudPanel>
  );
}

export { CornerFrame };
