"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import dynamic from "next/dynamic";
import { Button, PageHeader, StatusChip, StatTile, Thinking, Typewriter } from "@/components/ui";

const InvoiceGrid = dynamic(() => import("@/components/InvoiceGrid"), { ssr: false });

interface Invoice {
  id: string;
  status: string;
  invoiceNumber?: string;
  recipientName?: string;
  recipientEmail?: string;
  amount?: { currency_code: string; value: string };
  dueDate?: string;
  daysOverdue: number;
  recipientViewUrl?: string;
}

type AgentEvent =
  | { type: "scan"; message: string }
  | { type: "scanned"; total: number; overdue: number }
  | { type: "found"; invoice: Invoice }
  | { type: "draft"; id: string; tone: string; message: string; via: string }
  | { type: "reminded"; id: string }
  | { type: "error"; id: string; error: string }
  | { type: "fatal"; error: string }
  | { type: "done"; summary: { scanned: number; overdue: number; reminded: number } };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [view, setView] = useState<"cards" | "grid">("cards");
  const prevPaid = useRef<number>(-1);
  const logRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/invoices").then((r) => r.json());
      if (d.invoices) {
        setInvoices(d.invoices);
        const paid = d.invoices.filter((i: Invoice) => ["PAID", "MARKED_AS_PAID"].includes(i.status)).length;
        if (prevPaid.current >= 0 && paid > prevPaid.current) {
          confetti({ particleCount: 120, spread: 75, origin: { y: 0.3 } });
        }
        prevPaid.current = paid;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000); // poll so a sandbox payment flips PAID live + confetti
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  const seed = async () => {
    setSeeding(true);
    await fetch("/api/invoices", { method: "POST" });
    await load();
    setSeeding(false);
  };

  const runAgent = async () => {
    setRunning(true);
    setEvents([]);
    const res = await fetch("/api/chase", { method: "POST" });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line) as AgentEvent;
          setEvents((e) => [...e, ev]);
        } catch {}
      }
    }
    setRunning(false);
    load();
  };

  const overdue = invoices.filter(
    (i) => ["SENT", "UNPAID", "PARTIALLY_PAID", "PAYMENT_PENDING"].includes(i.status) && i.daysOverdue > 0
  );
  const outstanding = overdue.reduce((s, i) => s + Number(i.amount?.value ?? 0), 0);
  const paidCount = invoices.filter((i) => ["PAID", "MARKED_AS_PAID"].includes(i.status)).length;

  return (
    <div>
      <PageHeader
        title="Invoice"
        accent="Chaser"
        subtitle="The agent scans your PayPal invoices, decides who's overdue and how firmly to ask, drafts each message with Claude, and sends the official PayPal reminder."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatTile label="Overdue invoices" value={overdue.length} />
        <StatTile label="Overdue amount" value={outstanding} prefix="$" decimals={2} delay={0.1} />
        <StatTile label="Paid" value={paidCount} delay={0.2} hint="pays trigger confetti 🎉" />
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <Button onClick={runAgent} disabled={running || overdue.length === 0}>
          {running ? "Agent running…" : `▶ Run chaser on ${overdue.length} overdue`}
        </Button>
        <Button variant="ghost" onClick={seed} disabled={seeding}>
          {seeding ? "Seeding…" : "Seed demo invoices"}
        </Button>
        <Button variant="ghost" onClick={load}>
          ↻ Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice list */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
              Invoices
            </h2>
            <div className="flex rounded-full border border-[var(--hairline)] p-0.5 text-xs">
              {(["cards", "grid"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1 rounded-full transition-colors ${
                    view === v ? "bg-[var(--accent)] text-white" : "text-[var(--ink-2)] hover:text-[var(--ink)]"
                  }`}
                >
                  {v === "cards" ? "Cards" : "Grid"}
                </button>
              ))}
            </div>
          </div>
          {view === "grid" && !loading ? (
            <InvoiceGrid invoices={invoices} />
          ) : loading ? (
            <Thinking label="Loading invoices from PayPal" />
          ) : invoices.length === 0 ? (
            <p className="text-sm text-[var(--ink-2)]">No invoices yet — hit “Seed demo invoices”.</p>
          ) : (
            <ul className="space-y-3">
              <AnimatePresence>
                {invoices.map((inv, i) => (
                  <motion.li
                    key={inv.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {inv.recipientName || inv.recipientEmail || inv.id}
                      </div>
                      <div className="text-xs text-[var(--ink-muted)]">
                        {inv.invoiceNumber ?? inv.id} · due {inv.dueDate ?? "—"}
                        {inv.daysOverdue > 0 && (
                          <span className="text-[var(--critical)]"> · {inv.daysOverdue}d late</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold tabular-nums">
                        ${inv.amount?.value ?? "—"}
                      </span>
                      <StatusChip status={inv.daysOverdue > 0 && !["PAID", "MARKED_AS_PAID", "CANCELLED"].includes(inv.status) ? "OVERDUE" : inv.status} />
                      {inv.recipientViewUrl && (
                        <a
                          href={inv.recipientViewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--accent)] hover:underline whitespace-nowrap"
                        >
                          pay ↗
                        </a>
                      )}
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* Agent timeline */}
        <div className="card p-5 flex flex-col">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-4">
            Agent timeline
          </h2>
          <div ref={logRef} className="flex-1 max-h-130 overflow-y-auto scroll-thin space-y-4 pr-1">
            {events.length === 0 && !running && (
              <p className="text-sm text-[var(--ink-2)]">
                Press <span className="text-[var(--ink)]">Run chaser</span> and watch the agent work —
                every step streams here live.
              </p>
            )}
            <AnimatePresence>
              {events.map((ev, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {ev.type === "scan" && <Thinking label={ev.message.replace("…", "")} />}
                  {ev.type === "scanned" && (
                    <p className="text-sm text-[var(--ink-2)]">
                      Scanned <b className="text-[var(--ink)]">{ev.total}</b> invoices →{" "}
                      <b className="text-[var(--critical)]">{ev.overdue} overdue</b>
                    </p>
                  )}
                  {ev.type === "found" && (
                    <p className="text-sm">
                      🔎 <b>{ev.invoice.recipientName || "Customer"}</b> — $
                      {ev.invoice.amount?.value}, {ev.invoice.daysOverdue} days late
                    </p>
                  )}
                  {ev.type === "draft" && (
                    <div className="rounded-xl bg-[var(--surface-2)] border border-[var(--hairline)] p-4">
                      <div className="flex items-center gap-2 mb-2 text-xs text-[var(--ink-muted)]">
                        <StatusChip
                          status={ev.tone === "friendly" ? "ACTIVE" : ev.tone === "firm" ? "AT_RISK" : "OVERDUE"}
                          label={`${ev.tone} tone`}
                        />
                        <span>drafted by {ev.via === "claude" ? "Claude" : "template"}</span>
                      </div>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        <Typewriter text={ev.message} speed={8} />
                      </p>
                    </div>
                  )}
                  {ev.type === "reminded" && (
                    <p className="text-sm text-[var(--good)]">✓ Official PayPal reminder sent</p>
                  )}
                  {ev.type === "error" && (
                    <p className="text-sm text-[var(--critical)]">✕ {ev.error.slice(0, 160)}</p>
                  )}
                  {ev.type === "fatal" && (
                    <p className="text-sm text-[var(--critical)]">✕ {ev.error.slice(0, 200)}</p>
                  )}
                  {ev.type === "done" && (
                    <motion.p
                      initial={{ scale: 0.9 }}
                      animate={{ scale: 1 }}
                      className="text-sm font-medium text-[var(--good)]"
                    >
                      ✦ Done — {ev.summary.reminded}/{ev.summary.overdue} overdue invoices chased.
                      Now pay one as the sandbox buyer and watch it flip to PAID.
                    </motion.p>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            {running && events.length > 0 && <Thinking label="Working" />}
          </div>
        </div>
      </div>
    </div>
  );
}
