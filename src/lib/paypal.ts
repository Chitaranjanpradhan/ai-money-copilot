/**
 * PayPal REST client — sandbox-first, token-cached.
 * Covers the four modules: Invoicing v2, Orders v2 (checkout), Payouts v1, Subscriptions v1.
 */

const BASE = process.env.PAYPAL_API_BASE ?? "https://api-m.sandbox.paypal.com";

/** Public base URL of this app — explicit env, Render's injected URL, or localhost. */
export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? process.env.RENDER_EXTERNAL_URL ?? "http://localhost:3000";
}

let cached: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(): Promise<string> {
  if (cached && Date.now() < cached.expiresAt - 60_000) return cached.token;
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET in .env.local");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}): ${await res.text()}`);
  const data = await res.json();
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

export class PayPalError extends Error {
  constructor(public status: number, public body: string, path: string) {
    super(`PayPal ${status} on ${path}: ${body}`);
  }
}

/** Generic authenticated PayPal call. */
export async function pp<T = unknown>(
  path: string,
  opts: { method?: string; json?: unknown; headers?: Record<string, string> } = {}
): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...opts.headers,
    },
    body: opts.json !== undefined ? JSON.stringify(opts.json) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new PayPalError(res.status, text, path);
  return (text ? JSON.parse(text) : {}) as T;
}

/* ------------------------------------------------------------------ */
/* Module 1 — Invoicing v2 (AI invoice chaser)                         */
/* ------------------------------------------------------------------ */

export interface InvoiceSummary {
  id: string;
  status: string;
  invoiceNumber?: string;
  recipientEmail?: string;
  recipientName?: string;
  amount?: { currency_code: string; value: string };
  dueAmount?: { currency_code: string; value: string };
  dueDate?: string;
  memo?: string;
  recipientViewUrl?: string;
  daysOverdue: number;
}

// Raw shapes are loose on purpose — PayPal objects are large; we pick what we need.
/* eslint-disable @typescript-eslint/no-explicit-any */

function toSummary(inv: any): InvoiceSummary {
  const due = inv.detail?.payment_term?.due_date ?? inv.due_date;
  const daysOverdue = due
    ? Math.floor((Date.now() - new Date(due + "T00:00:00Z").getTime()) / 86_400_000)
    : 0;
  return {
    id: inv.id,
    status: inv.status,
    invoiceNumber: inv.detail?.invoice_number,
    recipientEmail:
      inv.primary_recipients?.[0]?.billing_info?.email_address ??
      inv.recipient_email,
    recipientName: [
      inv.primary_recipients?.[0]?.billing_info?.name?.given_name,
      inv.primary_recipients?.[0]?.billing_info?.name?.surname,
    ]
      .filter(Boolean)
      .join(" "),
    amount: inv.amount ?? inv.total_amount,
    dueAmount: inv.due_amount,
    dueDate: due,
    memo: inv.detail?.memo,
    recipientViewUrl: inv.detail?.metadata?.recipient_view_url,
    daysOverdue: Math.max(0, daysOverdue),
  };
}

/** Search invoices (POST /v2/invoicing/search-invoices). */
export async function searchInvoices(body: Record<string, unknown> = {}, pageSize = 50): Promise<InvoiceSummary[]> {
  const data = await pp<any>(`/v2/invoicing/search-invoices?page=1&page_size=${pageSize}&total_required=true`, {
    method: "POST",
    json: body,
  });
  return (data.items ?? []).map(toSummary);
}

export async function getInvoice(id: string) {
  return pp<any>(`/v2/invoicing/invoices/${id}`);
}

/** Create a draft invoice. */
export async function createInvoice(opts: {
  recipientEmail: string;
  recipientGivenName?: string;
  recipientSurname?: string;
  itemName: string;
  amount: string;
  currency?: string;
  invoiceDate?: string; // YYYY-MM-DD
  dueDate?: string; // YYYY-MM-DD → DUE_ON_DATE_SPECIFIED
  memo?: string;
}) {
  const currency = opts.currency ?? "USD";
  const detail: any = {
    currency_code: currency,
    invoice_date: opts.invoiceDate,
    memo: opts.memo,
    payment_term: opts.dueDate
      ? { term_type: "DUE_ON_DATE_SPECIFIED", due_date: opts.dueDate }
      : { term_type: "DUE_ON_RECEIPT" },
  };
  const res = await pp<any>("/v2/invoicing/invoices", {
    method: "POST",
    json: {
      detail,
      primary_recipients: [
        {
          billing_info: {
            email_address: opts.recipientEmail,
            name: { given_name: opts.recipientGivenName ?? "John", surname: opts.recipientSurname ?? "Doe" },
          },
        },
      ],
      items: [
        {
          name: opts.itemName,
          quantity: "1",
          unit_amount: { currency_code: currency, value: opts.amount },
        },
      ],
    },
  });
  // Create returns { href } pointing at the new invoice
  const id: string = res.id ?? res.href?.split("/").pop();
  return id;
}

/** Send an invoice (makes it SENT / UNPAID). */
export async function sendInvoice(id: string) {
  return pp<any>(`/v2/invoicing/invoices/${id}/send`, {
    method: "POST",
    json: { send_to_recipient: true, send_to_invoicer: false },
  });
}

/** Official PayPal reminder nudge (email text is system-defined). */
export async function remindInvoice(id: string) {
  return pp<any>(`/v2/invoicing/invoices/${id}/remind`, {
    method: "POST",
    json: { notification: { send_to_recipient: true, send_to_invoicer: false } },
  });
}

/** Record an external payment → invoice becomes MARKED_AS_PAID. */
export async function recordInvoicePayment(id: string, amount: string, currency = "USD") {
  return pp<any>(`/v2/invoicing/invoices/${id}/payments`, {
    method: "POST",
    json: {
      method: "BANK_TRANSFER",
      payment_date: new Date().toISOString().slice(0, 10),
      amount: { currency_code: currency, value: amount },
      note: "Recorded by AI Money Copilot after reconciliation",
    },
  });
}

/* ------------------------------------------------------------------ */
/* Module 2 — Orders v2 (chat-to-checkout)                             */
/* ------------------------------------------------------------------ */

export interface CartItem {
  name: string;
  quantity: number;
  unitAmount: string; // "12.99"
}

/** Create an order and return { orderId, approveUrl } for in-chat checkout. */
export async function createOrder(items: CartItem[], currency = "USD") {
  const total = items
    .reduce((s, i) => s + Number(i.unitAmount) * i.quantity, 0)
    .toFixed(2);
  const appBase = appBaseUrl();
  const res = await pp<any>("/v2/checkout/orders", {
    method: "POST",
    headers: { "PayPal-Request-Id": `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    json: {
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: currency,
            value: total,
            breakdown: { item_total: { currency_code: currency, value: total } },
          },
          items: items.map((i) => ({
            name: i.name.slice(0, 127),
            quantity: String(i.quantity),
            unit_amount: { currency_code: currency, value: i.unitAmount },
          })),
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: "PAY_NOW",
            return_url: `${appBase}/shop/return`,
            cancel_url: `${appBase}/shop?cancelled=1`,
          },
        },
      },
    },
  });
  const approveUrl: string | undefined = res.links?.find(
    (l: any) => l.rel === "payer-action" || l.rel === "approve"
  )?.href;
  return { orderId: res.id as string, approveUrl, status: res.status as string, total, currency };
}

export async function captureOrder(orderId: string) {
  return pp<any>(`/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: { "PayPal-Request-Id": `cap-${orderId}` },
  });
}

export async function getOrder(orderId: string) {
  return pp<any>(`/v2/checkout/orders/${orderId}`);
}

/* ------------------------------------------------------------------ */
/* Module 3 — Subscriptions v1 (merchant-side auditor)                 */
/* ------------------------------------------------------------------ */

export async function createProduct(name: string, description: string) {
  const res = await pp<any>("/v1/catalogs/products", {
    method: "POST",
    headers: { "PayPal-Request-Id": `prod-${name}-${Date.now()}` },
    json: { name, description, type: "SERVICE", category: "SOFTWARE" },
  });
  return res.id as string;
}

export async function createPlan(productId: string, name: string, price: string, currency = "USD") {
  const res = await pp<any>("/v1/billing/plans", {
    method: "POST",
    headers: { "PayPal-Request-Id": `plan-${name}-${Date.now()}` },
    json: {
      product_id: productId,
      name,
      status: "ACTIVE",
      billing_cycles: [
        {
          frequency: { interval_unit: "MONTH", interval_count: 1 },
          tenure_type: "REGULAR",
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: price, currency_code: currency } },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: "CONTINUE",
        payment_failure_threshold: 2,
      },
    },
  });
  return res.id as string;
}

/** Create a subscription → returns approval link for the sandbox buyer. */
export async function createSubscription(planId: string, subscriberEmail: string) {
  const appBase = appBaseUrl();
  const res = await pp<any>("/v1/billing/subscriptions", {
    method: "POST",
    json: {
      plan_id: planId,
      subscriber: { email_address: subscriberEmail },
      application_context: {
        user_action: "SUBSCRIBE_NOW",
        return_url: `${appBase}/subscriptions?approved=1`,
        cancel_url: `${appBase}/subscriptions?cancelled=1`,
      },
    },
  });
  const approveUrl = res.links?.find((l: any) => l.rel === "approve")?.href;
  return { id: res.id as string, status: res.status as string, approveUrl };
}

export async function getSubscription(id: string) {
  return pp<any>(`/v1/billing/subscriptions/${id}`);
}

export async function cancelSubscription(id: string, reason: string) {
  return pp(`/v1/billing/subscriptions/${id}/cancel`, { method: "POST", json: { reason } });
}

export async function suspendSubscription(id: string, reason: string) {
  return pp(`/v1/billing/subscriptions/${id}/suspend`, { method: "POST", json: { reason } });
}

/* ------------------------------------------------------------------ */
/* Module 4 — Payouts v1 (agentic payout manager)                      */
/* ------------------------------------------------------------------ */

export interface PayoutItemInput {
  email: string;
  amount: string;
  currency?: string;
  note?: string;
}

export async function createPayoutBatch(items: PayoutItemInput[], subject = "Payout from AI Money Copilot") {
  const senderBatchId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const res = await pp<any>("/v1/payments/payouts", {
    method: "POST",
    headers: { "PayPal-Request-Id": senderBatchId },
    json: {
      sender_batch_header: { sender_batch_id: senderBatchId, email_subject: subject },
      items: items.map((it, i) => ({
        recipient_type: "EMAIL",
        receiver: it.email,
        amount: { value: it.amount, currency: it.currency ?? "USD" },
        note: it.note ?? "Thanks for your work!",
        sender_item_id: `${senderBatchId}-item-${i}`,
      })),
    },
  });
  return {
    batchId: res.batch_header?.payout_batch_id as string,
    status: res.batch_header?.batch_status as string,
  };
}

export async function getPayoutBatch(batchId: string) {
  return pp<any>(`/v1/payments/payouts/${batchId}`);
}
