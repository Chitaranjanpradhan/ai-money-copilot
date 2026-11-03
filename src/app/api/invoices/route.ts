import { NextResponse } from "next/server";
import { searchInvoices, createInvoice, sendInvoice, getInvoice } from "@/lib/paypal";
import { updateStore } from "@/lib/store";


/** GET /api/invoices — all recent invoices with computed overdue state. */
export async function GET() {
  try {
    const items = await searchInvoices({}, 50);
    // Enrich with recipient view URL (search results omit metadata)
    const detailed = await Promise.all(
      items.map(async (i) => {
        if (i.recipientViewUrl) return i;
        try {
          const d = await getInvoice(i.id);
          return { ...i, recipientViewUrl: d.detail?.metadata?.recipient_view_url, memo: d.detail?.memo };
        } catch {
          return i;
        }
      })
    );
    const overdue = detailed.filter(
      (i) => ["SENT", "UNPAID", "PARTIALLY_PAID", "PAYMENT_PENDING"].includes(i.status) && i.daysOverdue > 0
    );
    return NextResponse.json({ invoices: detailed, overdueCount: overdue.length });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

const DEMO_INVOICES = [
  { itemName: "Website redesign — milestone 2", amount: "1250.00", daysAgoDue: 32, name: ["Priya", "Sharma"] },
  { itemName: "Monthly SEO retainer — September", amount: "480.00", daysAgoDue: 14, name: ["Marco", "Rossi"] },
  { itemName: "Logo + brand kit", amount: "320.00", daysAgoDue: 5, name: ["Aisha", "Khan"] },
  { itemName: "Consulting — Q4 strategy session", amount: "900.00", daysAgoDue: -10, name: ["John", "Doe"] }, // not yet due
];

/** POST /api/invoices — seed demo invoices (some overdue) and send them. */
export async function POST() {
  const buyer = process.env.PAYPAL_BUYER_EMAIL;
  if (!buyer) return NextResponse.json({ error: "PAYPAL_BUYER_EMAIL unset" }, { status: 500 });
  const created: string[] = [];
  const errors: string[] = [];
  for (const d of DEMO_INVOICES) {
    try {
      const due = new Date(Date.now() - d.daysAgoDue * 86_400_000);
      const invoiceDate = new Date(due.getTime() - 15 * 86_400_000);
      const id = await createInvoice({
        recipientEmail: buyer,
        recipientGivenName: d.name[0],
        recipientSurname: d.name[1],
        itemName: d.itemName,
        amount: d.amount,
        invoiceDate: invoiceDate.toISOString().slice(0, 10),
        dueDate: due.toISOString().slice(0, 10),
        memo: "Seeded by AI Money Copilot demo",
      });
      await sendInvoice(id);
      created.push(id);
    } catch (e) {
      errors.push(String(e));
    }
  }
  await updateStore((s) => {
    s.seededInvoiceIds.push(...created);
  });
  return NextResponse.json({ created, errors });
}
