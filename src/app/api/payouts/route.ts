import { NextRequest, NextResponse } from "next/server";
import { createPayoutBatch, getPayoutBatch } from "@/lib/paypal";
import { parsePayoutRule } from "@/lib/ai";
import { readStore, updateStore } from "@/lib/store";

export const maxDuration = 120;

/** Demo contractor roster — the "work system" the payout rules act on. */
const CONTRACTORS = [
  { name: "Devi Patel", email: "sb-contractor1@personal.example.com", tasksApproved: 4, ratePerTask: "25.00" },
  { name: "Liam Chen", email: "sb-contractor2@personal.example.com", tasksApproved: 2, ratePerTask: "40.00" },
  { name: "Sofia Garcia", email: "sb-contractor3@personal.example.com", tasksApproved: 0, ratePerTask: "30.00" },
];

/** GET — roster + payout history with live batch status. */
export async function GET() {
  const store = await readStore();
  const history = await Promise.all(
    store.payouts.map(async (p) => {
      try {
        const d = await getPayoutBatch(p.batchId);
        return { ...p, lastStatus: d.batch_header?.batch_status as string };
      } catch {
        return p;
      }
    })
  );
  return NextResponse.json({ contractors: CONTRACTORS, payouts: history.reverse() });
}

/**
 * POST /api/payouts
 *  {action:"plan", rule}            → AI parses rule into payout items (no money moves)
 *  {action:"execute", rule, items}  → human-approved: creates the PayPal payout batch
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "plan") {
      const plan = await parsePayoutRule(String(body.rule ?? ""), CONTRACTORS);
      return NextResponse.json(plan);
    }
    if (body.action === "execute") {
      const items = (body.items ?? []) as { email: string; amount: string; note?: string }[];
      if (!items.length) return NextResponse.json({ error: "No payout items" }, { status: 400 });
      const batch = await createPayoutBatch(
        items.map((i) => ({ email: i.email, amount: i.amount, note: i.note })),
        "Contractor payout — AI Money Copilot"
      );
      await updateStore((s) => {
        s.payouts.push({
          batchId: batch.batchId,
          createdAt: new Date().toISOString(),
          ruleText: String(body.rule ?? ""),
          items,
          lastStatus: batch.status,
        });
      });
      return NextResponse.json(batch);
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
