"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Button, PageHeader, StatusChip, StatTile, Thinking, Typewriter } from "@/components/ui";

interface Contractor {
  name: string;
  email: string;
  tasksApproved: number;
  ratePerTask: string;
}

interface PlanItem {
  email: string;
  amount: string;
  note: string;
}

interface PayoutHistory {
  batchId: string;
  createdAt: string;
  ruleText: string;
  items: { email: string; amount: string }[];
  lastStatus?: string;
}

export default function PayoutsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [history, setHistory] = useState<PayoutHistory[]>([]);
  const [rule, setRule] = useState("Pay every contractor for their approved tasks, but cap any single payment at $90");
  const [plan, setPlan] = useState<{ items: PlanItem[]; explanation: string; via: string } | null>(null);
  const [planning, setPlanning] = useState(false);
  const [executing, setExecuting] = useState(false);

  const load = useCallback(async () => {
    const d = await fetch("/api/payouts").then((r) => r.json());
    setContractors(d.contractors ?? []);
    setHistory(d.payouts ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const makePlan = async () => {
    setPlanning(true);
    setPlan(null);
    try {
      const d = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "plan", rule }),
      }).then((r) => r.json());
      if (d.items) setPlan(d);
    } finally {
      setPlanning(false);
    }
  };

  const execute = async () => {
    if (!plan) return;
    setExecuting(true);
    try {
      const d = await fetch("/api/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute", rule, items: plan.items }),
      }).then((r) => r.json());
      if (d.batchId) {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.4 } });
        setPlan(null);
        await load();
      } else if (d.error) {
        alert(d.error.includes("PAYOUT_NOT_AVAILABLE")
          ? "Payouts aren't available for this sandbox business account's country (e.g. India). Create a US sandbox business account + app and swap the credentials in .env.local."
          : d.error);
      }
    } finally {
      setExecuting(false);
    }
  };

  const totalPlanned = plan?.items.reduce((s, i) => s + Number(i.amount), 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="Payout"
        accent="Manager"
        subtitle="Write the rule in plain English. Claude compiles it into exact payout items. Nothing moves until you approve — then one PayPal Payouts batch pays everyone."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatTile label="Contractors" value={contractors.length} />
        <StatTile
          label="Approved tasks"
          value={contractors.reduce((s, c) => s + c.tasksApproved, 0)}
          delay={0.1}
        />
        <StatTile label="Batches sent" value={history.length} delay={0.2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Rule input */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-3">
              1 · The rule
            </h2>
            <textarea
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              rows={3}
              className="w-full bg-[var(--surface-2)] border border-[var(--hairline)] rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--accent)] transition-colors resize-none"
            />
            <div className="mt-3">
              <Button onClick={makePlan} disabled={planning || !rule.trim()}>
                {planning ? "Claude is planning…" : "⚡ Compile rule with AI"}
              </Button>
            </div>
          </div>

          {/* Roster */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-3">
              Contractor roster
            </h2>
            <ul className="space-y-2.5">
              {contractors.map((c, i) => (
                <motion.li
                  key={c.email}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.07 }}
                  className="flex items-center justify-between text-sm"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-[var(--ink-muted)]">{c.email}</div>
                  </div>
                  <div className="text-xs text-[var(--ink-2)] text-right">
                    {c.tasksApproved} tasks · ${c.ratePerTask}/task
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          {/* Plan review */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-3">
              2 · Review &amp; approve
            </h2>
            {planning && <Thinking label="Compiling rule into payout items" />}
            {!planning && !plan && (
              <p className="text-sm text-[var(--ink-2)]">
                Compile a rule to see exactly who gets paid what — the human-approval gate is the point.
              </p>
            )}
            <AnimatePresence>
              {plan && (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                  <p className="text-xs text-[var(--ink-2)] italic mb-3">
                    <Typewriter text={plan.explanation} speed={10} />
                  </p>
                  <ul className="space-y-2 mb-4">
                    {plan.items.map((it, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + i * 0.1 }}
                        className="flex items-center justify-between text-sm bg-[var(--surface-2)] border border-[var(--hairline)] rounded-xl px-4 py-2.5"
                      >
                        <span className="text-[var(--ink-2)] text-xs truncate mr-3">{it.email}</span>
                        <span className="font-semibold tabular-nums">${it.amount}</span>
                      </motion.li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--ink-2)]">
                      Total: <b className="text-[var(--ink)]">${totalPlanned.toFixed(2)}</b>
                    </span>
                    <Button onClick={execute} disabled={executing}>
                      {executing ? "Sending batch…" : "✓ Approve & pay via PayPal"}
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* History */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-3">
              Batch history
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--ink-2)]">No payouts yet.</p>
            ) : (
              <ul className="space-y-3">
                {history.map((h) => (
                  <li key={h.batchId} className="text-sm border-b border-[var(--hairline)] pb-3 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-[var(--ink-muted)]">{h.batchId}</span>
                      <StatusChip status={h.lastStatus ?? "PENDING"} />
                    </div>
                    <p className="text-xs text-[var(--ink-2)] mt-1 italic truncate">“{h.ruleText}”</p>
                    <p className="text-xs text-[var(--ink-muted)] mt-0.5">
                      {h.items.length} recipient(s) · $
                      {h.items.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
