"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { StatTile, Typewriter } from "@/components/ui";

const MODULES = [
  {
    href: "/invoices",
    title: "Invoice Chaser",
    verb: "Collects",
    color: "var(--accent)",
    desc: "Scans PayPal invoices, detects overdue ones, and drafts escalating AI follow-ups — then sends the official PayPal nudge.",
    api: "Invoicing v2",
  },
  {
    href: "/shop",
    title: "Chat-to-Checkout",
    verb: "Earns",
    color: "var(--aqua)",
    desc: "An AI shopkeeper that sells in conversation and drops a live PayPal checkout link right into the chat.",
    api: "Orders v2",
  },
  {
    href: "/subscriptions",
    title: "Subscription Auditor",
    verb: "Audits",
    color: "var(--violet)",
    desc: "Tracks your merchant subscriptions, flags zombies and at-risk billing, and cleans them up on approval.",
    api: "Subscriptions v1",
  },
  {
    href: "/payouts",
    title: "Payout Manager",
    verb: "Pays",
    color: "var(--orange)",
    desc: "Turns a plain-English payout rule into a reviewed, human-approved PayPal payout batch.",
    api: "Payouts v1",
  },
];

export default function Home() {
  const [stats, setStats] = useState({ invoices: 0, overdue: 0, outstanding: 0 });

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => {
        if (!d.invoices) return;
        type Inv = { status: string; daysOverdue: number; dueAmount?: { value: string }; amount?: { value: string } };
        const open = (d.invoices as Inv[]).filter((i) =>
          ["SENT", "UNPAID", "PARTIALLY_PAID", "PAYMENT_PENDING"].includes(i.status)
        );
        const outstanding = open.reduce(
          (s, i) => s + Number(i.dueAmount?.value ?? i.amount?.value ?? 0),
          0
        );
        setStats({ invoices: d.invoices.length, overdue: d.overdueCount ?? 0, outstanding });
      })
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="py-10 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.2, 0.7, 0.2, 1] }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--hairline)] px-3 py-1 text-xs text-[var(--ink-2)] mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
            PayPal sandbox × Claude — Build What’s Next hackathon
          </div>
          <h1 className="text-5xl sm:text-6xl font-semibold tracking-tight leading-[1.05]">
            One agent for the
            <br />
            <span className="gradient-text">whole money loop</span>
          </h1>
          <p className="mt-6 text-lg text-[var(--ink-2)] max-w-xl mx-auto min-h-14">
            <Typewriter text="It earns in chat. It chases what you're owed. It audits what drains you. It pays who you trust. All on PayPal — with a human hand on every dollar." speed={18} />
          </p>
        </motion.div>
      </section>

      {/* Live stats from the sandbox */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <StatTile label="Invoices in sandbox" value={stats.invoices} delay={0.05} hint="via Invoicing v2 search" />
        <StatTile label="Overdue right now" value={stats.overdue} delay={0.15} hint="computed by the agent" />
        <StatTile label="Outstanding" value={stats.outstanding} prefix="$" decimals={2} delay={0.25} hint="awaiting collection" />
      </section>

      {/* Module cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {MODULES.map((m, i) => (
          <motion.div
            key={m.href}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1, duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
          >
            <Link href={m.href} className="card card-hover block p-6 h-full">
              <div className="flex items-center justify-between">
                <span
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: m.color }}
                >
                  {m.verb}
                </span>
                <span className="text-[10px] text-[var(--ink-muted)] border border-[var(--hairline)] rounded-full px-2 py-0.5">
                  {m.api}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-semibold">{m.title}</h2>
              <p className="mt-2 text-sm text-[var(--ink-2)] leading-relaxed">{m.desc}</p>
              <span className="mt-4 inline-block text-sm text-[var(--accent)]">Open module →</span>
            </Link>
          </motion.div>
        ))}
      </section>
    </div>
  );
}
