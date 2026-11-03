"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, PageHeader, StatusChip, StatTile, Thinking } from "@/components/ui";

interface Sub {
  id: string;
  planName: string;
  price: string;
  status: string;
  nextBilling?: string;
  failedPayments?: number;
  audit?: { verdict: "HEALTHY" | "AT_RISK" | "ZOMBIE"; reason: string };
}

interface Seeded {
  planName: string;
  subId: string;
  approveUrl?: string;
}

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seeded, setSeeded] = useState<Seeded[]>([]);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetch("/api/subscriptions").then((r) => r.json());
      if (d.subscriptions) setSubs(d.subscriptions);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const seed = async () => {
    setSeeding(true);
    try {
      const d = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "seed" }),
      }).then((r) => r.json());
      if (d.seeded) setSeeded(d.seeded);
      await load();
    } finally {
      setSeeding(false);
    }
  };

  const act = async (action: "cancel" | "suspend", id: string, reason: string) => {
    setActing(id);
    try {
      await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, reason }),
      });
      await load();
    } finally {
      setActing(null);
    }
  };

  const monthly = subs
    .filter((s) => s.status === "ACTIVE")
    .reduce((sum, s) => sum + Number(s.price), 0);
  const zombies = subs.filter((s) => s.audit?.verdict === "ZOMBIE").length;
  const atRisk = subs.filter((s) => s.audit?.verdict === "AT_RISK").length;

  return (
    <div>
      <PageHeader
        title="Subscription"
        accent="Auditor"
        subtitle="PayPal has no list-all-subscriptions API — so the Copilot keeps its own ledger, pulls live status for each, and has Claude classify every subscription as healthy, at-risk, or zombie. Cleanup happens only on your click."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatTile label="Active monthly spend" value={monthly} prefix="$" decimals={2} />
        <StatTile label="Zombies found" value={zombies} delay={0.1} hint="never activated or dead" />
        <StatTile label="At risk" value={atRisk} delay={0.2} hint="failed payments / suspended" />
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <Button variant="ghost" onClick={seed} disabled={seeding}>
          {seeding ? "Creating plans + subscriptions…" : "Seed demo subscriptions"}
        </Button>
        <Button variant="ghost" onClick={load}>
          ↻ Re-audit
        </Button>
      </div>

      {seeded.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card p-5 mb-6">
          <h2 className="text-sm font-semibold mb-2">Approve as the sandbox buyer (optional)</h2>
          <p className="text-xs text-[var(--ink-2)] mb-3">
            Unapproved subscriptions stay in APPROVAL_PENDING — exactly the “zombies” the auditor hunts.
            Approve one or two to create a mixed portfolio:
          </p>
          <ul className="space-y-1.5">
            {seeded.map((s) => (
              <li key={s.subId} className="text-sm flex items-center gap-2">
                <span className="text-[var(--ink-2)]">{s.planName}</span>
                {s.approveUrl && (
                  <a href={s.approveUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)] text-xs hover:underline">
                    approve ↗
                  </a>
                )}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)] mb-4">
          Portfolio audit
        </h2>
        {loading ? (
          <Thinking label="Pulling live status + running Claude audit" />
        ) : subs.length === 0 ? (
          <p className="text-sm text-[var(--ink-2)]">No tracked subscriptions — seed the demo set first.</p>
        ) : (
          <ul className="space-y-4">
            <AnimatePresence>
              {subs.map((s, i) => (
                <motion.li
                  key={s.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="border-b border-[var(--hairline)] pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{s.planName}</div>
                      <div className="text-xs text-[var(--ink-muted)]">
                        ${s.price}/mo · {s.id}
                        {s.nextBilling && ` · next bill ${s.nextBilling.slice(0, 10)}`}
                      </div>
                    </div>
                    <StatusChip status={s.status} />
                    {s.audit && <StatusChip status={s.audit.verdict} />}
                    {["ACTIVE", "SUSPENDED", "APPROVAL_PENDING"].includes(s.status) && (
                      <div className="flex gap-2">
                        {s.status === "ACTIVE" && (
                          <Button
                            variant="ghost"
                            className="!px-3 !py-1 text-xs"
                            disabled={acting === s.id}
                            onClick={() => act("suspend", s.id, s.audit?.reason ?? "Paused by auditor")}
                          >
                            Pause
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          className="!px-3 !py-1 text-xs"
                          disabled={acting === s.id}
                          onClick={() => act("cancel", s.id, s.audit?.reason ?? "Cleaned up by auditor")}
                        >
                          {acting === s.id ? "…" : "Cancel"}
                        </Button>
                      </div>
                    )}
                  </div>
                  {s.audit && (
                    <p className="mt-2 text-xs text-[var(--ink-2)] italic">“{s.audit.reason}”</p>
                  )}
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
