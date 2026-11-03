# 💸 AI Money Copilot — PayPal × Claude

**One AI agent for the whole money loop.** It *earns* in chat, *collects* what you're owed,
*audits* what drains you, and *pays* who you trust — all on PayPal, with a human hand on every dollar.

Built for the **“Build What’s Next with PayPal and AI”** hackathon.

## The four modules

| Module | What the AI does | PayPal API |
|---|---|---|
| 🧲 **Invoice Chaser** | Scans invoices, computes who's overdue (PayPal has no OVERDUE status — the agent owns that logic), drafts escalating follow-ups with Claude (friendly → firm → final), sends the official PayPal reminder, celebrates with confetti when paid | Invoicing v2 |
| 🛍️ **Chat-to-Checkout** | An AI shopkeeper sells in conversation and mints a live PayPal checkout link right in the chat — the same agentic-commerce pattern PayPal is shipping with ChatGPT & Perplexity | Orders v2 |
| 🔍 **Subscription Auditor** | Keeps its own subscription ledger (there is no list-all API), pulls live status, and has Claude classify each as HEALTHY / AT_RISK / ZOMBIE — cleanup only on your click | Subscriptions v1 |
| 💸 **Payout Manager** | Compiles a plain-English rule (“pay everyone for approved tasks, cap at $90”) into exact payout items; nothing moves until a human approves; then one Payouts batch pays everyone | Payouts v1 |

**The safety story:** the AI drafts, plans, and explains — a human approves every irreversible action
(reminder sends are safe; payouts and cancellations sit behind explicit approval buttons).

## Stack

- **Next.js 16** (App Router, TypeScript) + Tailwind + Framer Motion
- **Claude** (`claude-sonnet-5-5`) via Vercel AI SDK — drafting, auditing, rule compilation
- **PayPal REST** (sandbox): OAuth2 client-credentials, Invoicing v2, Orders v2, Subscriptions v1, Payouts v1
- Graceful degradation: without an Anthropic key, every AI feature falls back to deterministic templates — the demo never hard-fails

## Run it

### 1. PayPal sandbox setup (5 min)

1. Create a [PayPal Developer](https://developer.paypal.com/dashboard) account
2. **Testing Tools → Sandbox Accounts**: create a **US Business** account and a **US Personal** (buyer) account
   ⚠️ Must be **US** — several APIs (invoicing send, payouts) are restricted for some countries (e.g. India)
3. **Apps & Credentials → Create App** (Merchant), linked to the US business account → copy Client ID + Secret

### 2. Configure

```bash
cp .env.example .env.local
# fill in PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, PAYPAL_BUYER_EMAIL
# optional: ANTHROPIC_API_KEY for real Claude drafting (template fallback otherwise)
```

### 3. Run

```bash
npm install
npm run dev     # → http://localhost:3000
```

### 4. The demo loop

1. **Invoices** → *Seed demo invoices* → *Run chaser* → watch the agent stream its work
2. Open an invoice's **pay ↗** link, log in as your sandbox **personal** account, pay → the dashboard flips it to PAID with confetti
3. **Chat-to-Checkout** → chat, then `buy orbit phone stand` → click the PayPal button → approve as the sandbox buyer → captured 🎉
4. **Sub Auditor** → *Seed demo subscriptions* → approve one or two via the links (mixed portfolio) → *Re-audit* → cancel the zombies
5. **Payouts** → edit the rule → *Compile with AI* → review the plan → *Approve & pay*

All money is sandbox money.

## Architecture

```
src/
  lib/paypal.ts      # OAuth token cache + typed wrappers for all 4 PayPal APIs
  lib/ai.ts          # Claude calls (draft / shopkeeper / audit / rule-compile) + fallbacks
  lib/store.ts       # JSON ledger for IDs PayPal can't enumerate (subscriptions, batches)
  app/api/
    invoices/        # GET list+overdue · POST seed
    chase/           # POST — streaming NDJSON agent run
    shop/            # chat · buy (create order) · capture · status
    subscriptions/   # GET live status + AI audit · POST seed/cancel/suspend
    payouts/         # GET roster+history · POST plan/execute
  app/               # Overview, Invoices, Shop (+return), Subscriptions, Payouts
```

## AI tools used

- **Claude (Anthropic)** — chase-message drafting, shopkeeper conversation, subscription audit verdicts, natural-language payout-rule compilation
- Built with **Claude Code** as the pair programmer

## License

MIT
