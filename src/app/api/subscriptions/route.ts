import { NextRequest, NextResponse } from "next/server";
import {
  createProduct,
  createPlan,
  createSubscription,
  getSubscription,
  cancelSubscription,
  suspendSubscription,
} from "@/lib/paypal";
import { auditSubscriptions } from "@/lib/ai";
import { readStore, updateStore } from "@/lib/store";

export const maxDuration = 120;

const DEMO_PLANS = [
  { name: "Starter Analytics", price: "9.00" },
  { name: "Pro Analytics", price: "29.00" },
  { name: "Legacy Reports Add-on", price: "4.00" },
];

/** GET /api/subscriptions — tracked subs with live status + AI audit verdicts. */
export async function GET() {
  try {
    const store = await readStore();
    const live = await Promise.all(
      store.subscriptions.map(async (s) => {
        try {
          const d = await getSubscription(s.id);
          return {
            ...s,
            status: d.status as string,
            nextBilling: d.billing_info?.next_billing_time as string | undefined,
            failedPayments: (d.billing_info?.failed_payments_count ?? 0) as number,
            lastPayment: d.billing_info?.last_payment?.time as string | undefined,
          };
        } catch {
          return {
            ...s,
            status: s.lastStatus ?? "UNKNOWN",
            failedPayments: 0,
            nextBilling: undefined as string | undefined,
            lastPayment: undefined as string | undefined,
          };
        }
      })
    );
    const verdicts = await auditSubscriptions(
      live.map((s) => ({
        id: s.id,
        planName: s.planName,
        price: s.price,
        status: s.status,
        lastPayment: s.lastPayment,
        failedPayments: s.failedPayments,
        nextBilling: s.nextBilling,
      }))
    );
    const merged = live.map((s) => ({ ...s, audit: verdicts.find((v) => v.id === s.id) }));
    return NextResponse.json({ subscriptions: merged });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * POST /api/subscriptions
 *  {action:"seed"} → create demo product/plans/subscriptions (approval links returned)
 *  {action:"cancel"|"suspend", id, reason}
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const buyer = process.env.PAYPAL_BUYER_EMAIL ?? "buyer@example.com";

    if (body.action === "seed") {
      const productId = await createProduct("AI Money Copilot Demo SaaS", "Demo product for subscription auditor");
      const results: { planName: string; subId: string; approveUrl?: string }[] = [];
      for (const p of DEMO_PLANS) {
        const planId = await createPlan(productId, p.name, p.price);
        const sub = await createSubscription(planId, buyer);
        results.push({ planName: p.name, subId: sub.id, approveUrl: sub.approveUrl });
        await updateStore((s) => {
          s.subscriptions.push({
            id: sub.id,
            planId,
            planName: p.name,
            price: p.price,
            createdAt: new Date().toISOString(),
            lastStatus: sub.status,
          });
        });
      }
      return NextResponse.json({ seeded: results });
    }

    if (body.action === "cancel") {
      await cancelSubscription(String(body.id), String(body.reason ?? "Cleaned up by AI auditor"));
      return NextResponse.json({ ok: true });
    }
    if (body.action === "suspend") {
      await suspendSubscription(String(body.id), String(body.reason ?? "Paused by AI auditor"));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
