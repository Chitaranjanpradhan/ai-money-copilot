/**
 * AI layer — Claude via Vercel AI SDK, with graceful template fallback when
 * ANTHROPIC_API_KEY is unset so the demo never hard-fails.
 */
import { generateText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { InvoiceSummary } from "./paypal";

const MODEL_ID = "claude-sonnet-5-5";

export function aiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function model() {
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropic(MODEL_ID);
}

export type ChaseTone = "friendly" | "firm" | "final";

export function toneForDaysOverdue(days: number): ChaseTone {
  if (days <= 7) return "friendly";
  if (days <= 21) return "firm";
  return "final";
}

const FALLBACK_DRAFTS: Record<ChaseTone, (inv: InvoiceSummary) => string> = {
  friendly: (inv) =>
    `Hi ${inv.recipientName || "there"},\n\nJust a friendly nudge — invoice ${inv.invoiceNumber ?? inv.id} for ${inv.amount?.currency_code} ${inv.amount?.value} was due on ${inv.dueDate}. You can view and pay it securely here: ${inv.recipientViewUrl ?? "(link)"}\n\nThanks so much!\n`,
  firm: (inv) =>
    `Hi ${inv.recipientName || "there"},\n\nInvoice ${inv.invoiceNumber ?? inv.id} (${inv.amount?.currency_code} ${inv.amount?.value}) is now ${inv.daysOverdue} days past due. Please settle it at your earliest convenience: ${inv.recipientViewUrl ?? "(link)"}\n\nIf payment has already been made, let us know and we'll reconcile right away.\n`,
  final: (inv) =>
    `Dear ${inv.recipientName || "customer"},\n\nThis is a final notice for invoice ${inv.invoiceNumber ?? inv.id} (${inv.amount?.currency_code} ${inv.amount?.value}), now ${inv.daysOverdue} days overdue. To avoid escalation, please pay today: ${inv.recipientViewUrl ?? "(link)"}\n\nRegards,\nAccounts Receivable\n`,
};

/** Draft a personalized chase message for an overdue invoice. */
export async function draftChaseMessage(inv: InvoiceSummary): Promise<{ tone: ChaseTone; message: string; via: "claude" | "template" }> {
  const tone = toneForDaysOverdue(inv.daysOverdue);
  if (!aiAvailable()) return { tone, message: FALLBACK_DRAFTS[tone](inv), via: "template" };
  try {
    const { text } = await generateText({
      model: model(),
      system:
        "You are an accounts-receivable assistant. Write a short, professional payment-chase email (under 120 words). Match the requested tone exactly. Include the payment link verbatim. No subject line, no placeholders.",
      prompt: `Tone: ${tone}\nCustomer: ${inv.recipientName || "customer"}\nInvoice number: ${inv.invoiceNumber ?? inv.id}\nAmount: ${inv.amount?.currency_code} ${inv.amount?.value}\nDue date: ${inv.dueDate}\nDays overdue: ${inv.daysOverdue}\nPayment link: ${inv.recipientViewUrl ?? "(link unavailable)"}`,
    });
    return { tone, message: text, via: "claude" };
  } catch {
    return { tone, message: FALLBACK_DRAFTS[tone](inv), via: "template" };
  }
}

/** Shopkeeper chat for chat-to-checkout; returns assistant text (cart extraction is handled by the route). */
export async function shopkeeperReply(opts: {
  history: { role: "user" | "assistant"; content: string }[];
  catalog: { name: string; price: string; blurb: string }[];
}): Promise<{ text: string; via: "claude" | "template" }> {
  const catalogText = opts.catalog.map((c) => `- ${c.name} ($${c.price}): ${c.blurb}`).join("\n");
  if (!aiAvailable()) {
    // Keyword-match the user's last message against the catalog
    const last = opts.history.filter((m) => m.role === "user").at(-1)?.content.toLowerCase() ?? "";
    const scored = opts.catalog
      .map((c) => {
        const hay = `${c.name} ${c.blurb}`.toLowerCase();
        const score = last
          .split(/\W+/)
          .filter((w) => w.length > 2)
          .reduce((s, w) => s + (hay.includes(w) ? 1 : 0), 0);
        return { c, score };
      })
      .sort((a, b) => b.score - a.score);
    const hit = scored[0]?.score ? scored[0].c : null;
    const text = hit
      ? `The ${hit.name} ($${hit.price}) sounds perfect — ${hit.blurb.toLowerCase()}. Say "buy ${hit.name}" and I'll create a secure PayPal checkout right here.`
      : `Here's what we have: ${opts.catalog.map((c) => `${c.name} ($${c.price})`).join(", ")}. Tell me what you're after, or say "buy <item name>" for an instant PayPal checkout.`;
    return { text, via: "template" };
  }
  try {
    const { text } = await generateText({
      model: model(),
      system: `You are a charming shopkeeper for a small online store. Catalog:\n${catalogText}\nHelp the user choose. When they're ready, tell them to say "buy <item>" to get a PayPal checkout link. Keep replies under 80 words.`,
      messages: opts.history,
    });
    return { text, via: "claude" };
  } catch {
    return { text: "Tell me what you're looking for, or say \"buy <item name>\" and I'll create a secure PayPal checkout.", via: "template" };
  }
}

/** Audit subscriptions: classify each as HEALTHY / AT_RISK / ZOMBIE with a reason. */
export async function auditSubscriptions(
  subs: { id: string; planName: string; price: string; status: string; lastPayment?: string; failedPayments?: number; nextBilling?: string }[]
): Promise<{ id: string; verdict: "HEALTHY" | "AT_RISK" | "ZOMBIE"; reason: string }[]> {
  const heuristics = subs.map((s) => {
    let verdict: "HEALTHY" | "AT_RISK" | "ZOMBIE" = "HEALTHY";
    let reason = "Active and billing normally.";
    if (s.status === "SUSPENDED" || (s.failedPayments ?? 0) >= 1) {
      verdict = "AT_RISK";
      reason = `${s.failedPayments ?? 0} failed payment(s) / status ${s.status} — payment method may be stale.`;
    }
    if (s.status === "APPROVAL_PENDING" || s.status === "EXPIRED" || s.status === "CANCELLED") {
      verdict = "ZOMBIE";
      reason = `Status ${s.status} — never activated or already dead; safe to clean up.`;
    }
    return { id: s.id, verdict, reason };
  });
  if (!aiAvailable()) return heuristics;
  try {
    const { text } = await generateText({
      model: model(),
      system:
        'You audit a merchant\'s PayPal subscriptions. For each, output one line: "<id>|<HEALTHY|AT_RISK|ZOMBIE>|<reason under 20 words>". No other text.',
      prompt: JSON.stringify(subs),
    });
    const parsed = text
      .split("\n")
      .map((l) => l.split("|"))
      .filter((p) => p.length === 3)
      .map(([id, verdict, reason]) => ({
        id: id.trim(),
        verdict: verdict.trim() as "HEALTHY" | "AT_RISK" | "ZOMBIE",
        reason: reason.trim(),
      }))
      .filter((p) => subs.some((s) => s.id === p.id));
    return parsed.length ? parsed : heuristics;
  } catch {
    return heuristics;
  }
}

/** Parse a natural-language payout rule into structured payout items. */
export async function parsePayoutRule(
  ruleText: string,
  contractors: { name: string; email: string; tasksApproved: number; ratePerTask: string }[]
): Promise<{ items: { email: string; amount: string; note: string }[]; explanation: string; via: "claude" | "template" }> {
  const fallback = () => {
    const items = contractors
      .filter((c) => c.tasksApproved > 0)
      .map((c) => ({
        email: c.email,
        amount: (c.tasksApproved * Number(c.ratePerTask)).toFixed(2),
        note: `Payment for ${c.tasksApproved} approved task(s) @ $${c.ratePerTask}`,
      }));
    return {
      items,
      explanation: "Template rule applied: pay each contractor tasksApproved × ratePerTask.",
      via: "template" as const,
    };
  };
  if (!aiAvailable()) return fallback();
  try {
    const { text } = await generateText({
      model: model(),
      system:
        'Convert a natural-language payout rule into JSON. Input: rule + contractor roster. Output ONLY JSON: {"items":[{"email":"","amount":"12.34","note":""}],"explanation":""}. Respect caps/filters in the rule. Amounts are USD strings with 2 decimals.',
      prompt: `Rule: ${ruleText}\nContractors: ${JSON.stringify(contractors)}`,
    });
    const jsonStart = text.indexOf("{");
    const parsed = JSON.parse(text.slice(jsonStart));
    if (!Array.isArray(parsed.items)) throw new Error("bad shape");
    return { items: parsed.items, explanation: parsed.explanation ?? "", via: "claude" };
  } catch {
    return fallback();
  }
}
