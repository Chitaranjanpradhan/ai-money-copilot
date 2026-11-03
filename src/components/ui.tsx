"use client";

import { motion, useInView, useMotionValue, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/* ---------- Animated count-up number ---------- */
export function CountUp({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  className = "",
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 80, damping: 20 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView) mv.set(value);
  }, [inView, value, mv]);

  useEffect(() => {
    return spring.on("change", (v) =>
      setDisplay(
        v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
      )
    );
  }, [spring, decimals]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {display}
      {suffix}
    </span>
  );
}

/* ---------- Stat tile (hero number, no plot → no hover layer needed) ---------- */
export function StatTile({
  label,
  value,
  prefix,
  suffix,
  decimals,
  hint,
  delay = 0,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  hint?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="card p-5"
    >
      <div className="text-xs uppercase tracking-wider text-[var(--ink-muted)]">{label}</div>
      <div className="mt-1.5 text-3xl font-semibold tracking-tight">
        <CountUp value={value} prefix={prefix} suffix={suffix} decimals={decimals} />
      </div>
      {hint && <div className="mt-1 text-xs text-[var(--ink-2)]">{hint}</div>}
    </motion.div>
  );
}

/* ---------- Typewriter text (used for streamed AI drafts) ---------- */
export function Typewriter({
  text,
  speed = 14,
  className = "",
  onDone,
}: {
  text: string;
  speed?: number;
  className?: string;
  onDone?: () => void;
}) {
  const [shown, setShown] = useState(0);
  const done = shown >= text.length;
  useEffect(() => {
    setShown(0);
  }, [text]);
  useEffect(() => {
    if (done) {
      onDone?.();
      return;
    }
    const chunk = Math.max(1, Math.round(text.length / 220));
    const t = setTimeout(() => setShown((s) => Math.min(text.length, s + chunk)), speed);
    return () => clearTimeout(t);
  }, [shown, done, text, speed, onDone]);
  return (
    <span className={`${className} ${done ? "" : "typewriter-caret"}`}>{text.slice(0, shown)}</span>
  );
}

/* ---------- Status chip — icon + label, never color alone ---------- */
const STATUS_STYLES: Record<string, { color: string; icon: string }> = {
  PAID: { color: "var(--good)", icon: "✓" },
  MARKED_AS_PAID: { color: "var(--good)", icon: "✓" },
  COMPLETED: { color: "var(--good)", icon: "✓" },
  ACTIVE: { color: "var(--good)", icon: "✓" },
  HEALTHY: { color: "var(--good)", icon: "✓" },
  SUCCESS: { color: "var(--good)", icon: "✓" },
  SENT: { color: "var(--warning)", icon: "◷" },
  UNPAID: { color: "var(--warning)", icon: "◷" },
  PENDING: { color: "var(--warning)", icon: "◷" },
  PROCESSING: { color: "var(--warning)", icon: "◷" },
  APPROVAL_PENDING: { color: "var(--warning)", icon: "◷" },
  AT_RISK: { color: "var(--serious)", icon: "⚠" },
  PARTIALLY_PAID: { color: "var(--serious)", icon: "⚠" },
  SUSPENDED: { color: "var(--serious)", icon: "⚠" },
  UNCLAIMED: { color: "var(--serious)", icon: "⚠" },
  OVERDUE: { color: "var(--critical)", icon: "✕" },
  CANCELLED: { color: "var(--critical)", icon: "✕" },
  ZOMBIE: { color: "var(--critical)", icon: "✕" },
  DENIED: { color: "var(--critical)", icon: "✕" },
  FAILED: { color: "var(--critical)", icon: "✕" },
};

export function StatusChip({ status, label }: { status: string; label?: string }) {
  const s = STATUS_STYLES[status] ?? { color: "var(--ink-muted)", icon: "·" };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium"
      style={{ color: s.color, borderColor: "var(--hairline)", background: "var(--surface-2)" }}
    >
      <span aria-hidden>{s.icon}</span>
      {label ?? status.replaceAll("_", " ")}
    </span>
  );
}

/* ---------- Agent "thinking" indicator ---------- */
export function Thinking({ label = "Agent thinking" }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-[var(--ink-2)]">
      <div className="flex items-center gap-1">
        <span className="thinking-dot" />
        <span className="thinking-dot" />
        <span className="thinking-dot" />
      </div>
      <span className="shimmer-text">{label}…</span>
    </div>
  );
}

/* ---------- Primary / ghost buttons ---------- */
export function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const base =
    "btn-sweep inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98]";
  const styles =
    variant === "primary"
      ? "bg-[var(--accent)] text-white hover:bg-[#4a93ea]"
      : variant === "danger"
        ? "bg-transparent border border-[var(--critical)] text-[var(--critical)] hover:bg-[rgba(208,59,59,0.12)]"
        : "bg-transparent border border-[var(--hairline)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-[var(--ink-muted)]";
  return (
    <button onClick={onClick} disabled={disabled} className={`${base} ${styles} ${className}`}>
      {children}
    </button>
  );
}

/* ---------- Section heading with fade-up ---------- */
export function PageHeader({ title, accent, subtitle }: { title: string; accent?: string; subtitle?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      className="mb-8"
    >
      <h1 className="text-3xl font-semibold tracking-tight">
        {title} {accent && <span className="gradient-text">{accent}</span>}
      </h1>
      {subtitle && <p className="mt-2 text-[var(--ink-2)] max-w-2xl">{subtitle}</p>}
    </motion.div>
  );
}
