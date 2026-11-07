// ═══════════════════════════════════════════════════════════════════════
// HUD building blocks for the twin Overview (reference design: dark panels,
// thin borders, tiny uppercase labels, cyan accents, corner-bracket frame).
// ═══════════════════════════════════════════════════════════════════════
import React from "react";

export function HudPanel({
  title,
  badge,
  action,
  children,
  className = "",
}: {
  title: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`relative rounded-lg border border-border/70 bg-surface-elevated/60 backdrop-blur-sm p-4 ${className}`}
    >
      <header className="flex items-center justify-between gap-2 mb-3">
        <h2 className="hud-title text-[13px] text-foreground tracking-[0.12em]">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          {badge}
          {action}
        </div>
      </header>
      {children}
    </section>
  );
}

/** Small label / value pair (IDENTITY card). */
export function HudField({
  label,
  value,
  placeholder = "—",
}: {
  label: string;
  value?: React.ReactNode;
  placeholder?: string;
}) {
  const empty = value === undefined || value === null || value === "";
  return (
    <div className="min-w-0">
      <p className="hud-label !text-[9.5px] !tracking-[0.14em]">{label}</p>
      <p
        className={`text-[13px] mt-0.5 truncate ${empty ? "text-foreground-subtle" : "text-foreground"}`}
      >
        {empty ? placeholder : value}
      </p>
    </div>
  );
}

export function DemoBadge({ title }: { title?: string }) {
  return (
    <span
      title={title || "Sample values — connect a wearable for live data"}
      className="text-[9px] font-semibold uppercase tracking-wider text-warning/90 border border-warning/30 bg-warning/10 px-1.5 py-0.5 rounded"
    >
      Demo data
    </span>
  );
}

/** Circular score gauge (HEALTH OVERVIEW 92/100). */
export function ScoreRing({
  value,
  max = 100,
  size = 104,
}: {
  value: number;
  max?: number;
  size?: number;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--divider)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--arklife-primary)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          style={{ filter: "drop-shadow(0 0 6px rgba(24,185,205,0.45))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="hud-metric text-[34px] leading-none text-foreground">
          {value}
        </span>
        <span className="text-[10px] text-foreground-subtle mt-0.5">/{max}</span>
      </div>
    </div>
  );
}

/** Icon + small label + value (HEART RATE 72 bpm). */
export function StatLine({
  icon,
  label,
  value,
  unit,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-primary shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="hud-label !text-[8.5px] !tracking-[0.12em] leading-tight">
          {label}
        </p>
        <p className="text-[13px] text-foreground leading-tight">
          {value}
          {unit && (
            <span className="text-[10px] text-foreground-subtle ml-0.5">
              {unit}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

/** Row used in VITALS: label left, value right. */
export function MetricRow({
  label,
  value,
  unit,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-t border-divider/70 first:border-t-0">
      <span className="hud-label !text-[9.5px]">{label}</span>
      <span className="hud-metric text-[15px] text-foreground">
        {value}
        {unit && (
          <span className="text-[10px] text-foreground-subtle ml-1 font-normal">
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}

/** Horizontal bar used in LIFESTYLE. */
export function LevelBar({
  label,
  value,
  level,
}: {
  label: string;
  value: number; // 0..100
  level: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="hud-label !text-[9.5px]">{label}</span>
        <span className="text-[10px] text-foreground-muted">{level}</span>
      </div>
      <div className="h-1.5 rounded-full bg-divider overflow-hidden">
        <div
          className="h-full rounded-full bg-primary"
          style={{
            width: `${Math.max(0, Math.min(100, value))}%`,
            boxShadow: "0 0 8px rgba(24,185,205,0.5)",
          }}
        />
      </div>
    </div>
  );
}

/** Smooth line chart for VITALS (no chart library needed). */
export function Sparkline({
  points,
  height = 56,
}: {
  points: number[];
  height?: number;
}) {
  const w = 240;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [
    (i / (points.length - 1)) * w,
    height - 6 - ((p - min) / span) * (height - 12),
  ]);
  const d = xy
    .map(([x, y], i) => {
      if (i === 0) return `M${x},${y}`;
      const [px, py] = xy[i - 1];
      const cx = (px + x) / 2;
      return `C${cx},${py} ${cx},${y} ${x},${y}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      className="w-full"
      style={{ height }}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--arklife-primary)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--arklife-primary)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${w},${height} L0,${height} Z`} fill="url(#spark-fill)" />
      <path
        d={d}
        fill="none"
        stroke="var(--arklife-primary)"
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Corner brackets around the portrait (the reference's camera-frame look). */
export function CornerFrame({ active }: { active?: boolean }) {
  const c = active ? "border-primary" : "border-foreground-muted/60";
  const base = `absolute w-8 h-8 sm:w-10 sm:h-10 ${c} transition-colors duration-300 pointer-events-none z-20`;
  return (
    <>
      <span className={`${base} top-3 left-3 border-t-2 border-l-2`} />
      <span className={`${base} top-3 right-3 border-t-2 border-r-2`} />
      <span className={`${base} bottom-3 left-3 border-b-2 border-l-2`} />
      <span className={`${base} bottom-3 right-3 border-b-2 border-r-2`} />
    </>
  );
}

/** Animated voice waveform (BIOMETRIC ID → voice). */
export function Waveform({ active = true }: { active?: boolean }) {
  const bars = [3, 6, 4, 9, 14, 8, 18, 11, 22, 13, 26, 16, 20, 10, 15, 7, 12, 5, 8, 4, 6, 3];
  return (
    <div className="flex items-center gap-[2px] h-7" aria-hidden>
      {bars.map((h, i) => (
        <span
          key={i}
          className={`w-[2px] rounded-full ${active ? "bg-primary twin-wave" : "bg-foreground-subtle"}`}
          style={{ height: h, animationDelay: `${(i % 7) * 0.09}s` }}
        />
      ))}
    </div>
  );
}
