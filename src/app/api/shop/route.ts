import { NextRequest, NextResponse } from "next/server";
import { createOrder, captureOrder, getOrder } from "@/lib/paypal";
import { shopkeeperReply } from "@/lib/ai";
import { updateStore } from "@/lib/store";
import { CATALOG } from "@/lib/catalog";
import { channel3Available, searchProducts, getProduct } from "@/lib/channel3";


/**
 * POST /api/shop — one endpoint, three actions:
 *  {action:"chat", history:[...]}          → AI shopkeeper reply
 *  {action:"buy", itemName, quantity?}     → creates PayPal order, returns approveUrl
 *  {action:"capture", orderId}             → captures after buyer approval
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "chat") {
      // Channel3 mode: search REAL products for the user's message
      if (channel3Available()) {
        const last = (body.history ?? []).filter((m: { role: string }) => m.role === "user").at(-1);
        const products = await searchProducts(String(last?.content ?? ""), 6);
        if (products.length) {
          const reply = await shopkeeperReply({
            history: body.history ?? [],
            catalog: products.map((p) => ({ name: p.name, price: p.price, blurb: p.blurb })),
          });
          return NextResponse.json({ reply: reply.text, via: reply.via, products });
        }
      }
      const reply = await shopkeeperReply({ history: body.history ?? [], catalog: CATALOG });
      return NextResponse.json({ reply: reply.text, via: reply.via, catalog: CATALOG });
    }
    if (body.action === "buyProduct") {
      // Channel3 product — re-fetch server-side so the price is authoritative
      const p = await getProduct(String(body.productId));
      if (!p) return NextResponse.json({ error: "Product not found" }, { status: 404 });
      const order = await createOrder([{ name: p.name, quantity: 1, unitAmount: p.price }], p.currency);
      return NextResponse.json({ ...order, item: p.name, quantity: 1 });
    }
    if (body.action === "buy") {
      const item = CATALOG.find((c) => c.name.toLowerCase().includes(String(body.itemName ?? "").toLowerCase()));
      if (!item) return NextResponse.json({ error: `No catalog item matching "${body.itemName}"` }, { status: 404 });
      const qty = Math.max(1, Math.min(10, Number(body.quantity ?? 1)));
      const order = await createOrder([{ name: item.name, quantity: qty, unitAmount: item.price }]);
      return NextResponse.json({ ...order, item: item.name, quantity: qty });
    }
    if (body.action === "capture") {
      const res = await captureOrder(String(body.orderId));
      const capture = res.purchase_units?.[0]?.payments?.captures?.[0];
      await updateStore((s) => {
        s.capturedOrders.push({
          orderId: String(body.orderId),
          total: capture?.amount?.value ?? "?",
          capturedAt: new Date().toISOString(),
        });
      });
      return NextResponse.json({ status: res.status, captureId: capture?.id, amount: capture?.amount });
    }
    if (body.action === "status") {
      const res = await getOrder(String(body.orderId));
      return NextResponse.json({ status: res.status });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ catalog: CATALOG });
}
