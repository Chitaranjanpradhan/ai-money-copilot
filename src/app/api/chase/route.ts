import { searchInvoices, getInvoice, remindInvoice } from "@/lib/paypal";
import { draftChaseMessage } from "@/lib/ai";

export const maxDuration = 120;

/**
 * POST /api/chase — run the invoice-chaser agent.
 * Streams NDJSON events so the UI can animate each step live:
 *   {type:"scan", ...} {type:"found", invoice} {type:"draft", id, tone, message, via}
 *   {type:"reminded", id} {type:"error", id, error} {type:"done", summary}
 */
export async function POST() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        emit({ type: "scan", message: "Scanning invoices via PayPal Invoicing API…" });
        const items = await searchInvoices({}, 50);
        const overdue = items.filter(
          (i) => ["SENT", "UNPAID", "PARTIALLY_PAID", "PAYMENT_PENDING"].includes(i.status) && i.daysOverdue > 0
        );
        emit({ type: "scanned", total: items.length, overdue: overdue.length });
        let reminded = 0;
        for (const inv of overdue) {
          try {
            const detail = await getInvoice(inv.id);
            const enriched = { ...inv, recipientViewUrl: detail.detail?.metadata?.recipient_view_url };
            emit({ type: "found", invoice: enriched });
            const draft = await draftChaseMessage(enriched);
            emit({ type: "draft", id: inv.id, ...draft });
            await remindInvoice(inv.id);
            reminded++;
            emit({ type: "reminded", id: inv.id });
          } catch (e) {
            emit({ type: "error", id: inv.id, error: String(e) });
          }
        }
        emit({ type: "done", summary: { scanned: items.length, overdue: overdue.length, reminded } });
      } catch (e) {
        emit({ type: "fatal", error: String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache" },
  });
}
