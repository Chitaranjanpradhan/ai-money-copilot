"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { Thinking } from "@/components/ui";

function ReturnInner() {
  const params = useSearchParams();
  const orderId = params.get("token"); // PayPal returns ?token=<orderId>
  const [state, setState] = useState<"capturing" | "done" | "error">("capturing");
  const [detail, setDetail] = useState<{ captureId?: string; amount?: { value: string; currency_code: string } }>({});
  const ran = useRef(false);

  useEffect(() => {
    if (!orderId || ran.current) return;
    ran.current = true;
    fetch("/api/shop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "capture", orderId }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.status === "COMPLETED") {
          setDetail(d);
          setState("done");
          confetti({ particleCount: 160, spread: 90, origin: { y: 0.4 } });
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, [orderId]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      {state === "capturing" && <Thinking label="Capturing your payment with PayPal" />}
      {state === "done" && (
        <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 160 }}>
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-3xl font-semibold">
            Payment <span className="gradient-text">captured</span>
          </h1>
          <p className="mt-3 text-[var(--ink-2)]">
            {detail.amount ? `${detail.amount.currency_code} ${detail.amount.value}` : "Your order"} — capture{" "}
            <code className="text-xs bg-[var(--surface-2)] px-1.5 py-0.5 rounded">{detail.captureId}</code>
          </p>
          <Link href="/shop" className="mt-6 inline-block text-[var(--accent)] hover:underline">
            ← Back to the store
          </Link>
        </motion.div>
      )}
      {state === "error" && (
        <div>
          <h1 className="text-2xl font-semibold text-[var(--critical)]">Capture failed</h1>
          <p className="mt-2 text-[var(--ink-2)]">The order may not have been approved. Try again from the store.</p>
          <Link href="/shop" className="mt-4 inline-block text-[var(--accent)] hover:underline">
            ← Back to the store
          </Link>
        </div>
      )}
    </div>
  );
}

export default function ReturnPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-[var(--ink-2)]">Loading…</div>}>
      <ReturnInner />
    </Suspense>
  );
}
