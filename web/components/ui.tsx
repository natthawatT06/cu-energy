import type { ReactNode } from "react";

export function DataTag({ children }: { children: ReactNode }) {
  return (
    <span className="chip inline-flex items-center gap-1 px-2 py-0.5 text-[11px] text-faint">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <circle cx="5" cy="5" r="4" stroke="currentColor" />
        <path d="M5 3v2.5L6.5 6.5" stroke="currentColor" strokeLinecap="round" />
      </svg>
      {children}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  desc,
  id,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  id?: string;
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
        {eyebrow}
      </div>
      <h2 className="mt-2 font-display text-2xl font-semibold text-fg sm:text-3xl">
        {title}
      </h2>
      {desc && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{desc}</p>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  unit,
  sub,
  accent = "fg",
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: "fg" | "primary" | "accent" | "warn" | "danger";
}) {
  const color = {
    fg: "text-fg",
    primary: "text-primary",
    accent: "text-accent",
    warn: "text-warn",
    danger: "text-danger",
  }[accent];
  return (
    <div className="panel-soft p-4">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className={`tnum text-2xl font-semibold sm:text-[28px] ${color}`}>{value}</span>
        {unit && <span className="text-sm text-faint">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-semibold sm:text-[26px]">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-sm text-muted">{desc}</p>}
      </div>
      {action}
    </div>
  );
}

const PILL: Record<string, string> = {
  green: "text-primary border-primary/30 bg-primary/10",
  pink: "text-accent border-accent/30 bg-accent/10",
  amber: "text-warn border-warn/30 bg-warn/10",
  red: "text-danger border-danger/30 bg-danger/10",
  gray: "text-muted border-border bg-black/[0.02]",
};

export function Pill({ tone = "gray", children }: { tone?: keyof typeof PILL | string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${PILL[tone] ?? PILL.gray}`}>
      {children}
    </span>
  );
}

export function Bar({ v, max, color }: { v: number; max: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]">
      <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: color }} />
    </div>
  );
}
