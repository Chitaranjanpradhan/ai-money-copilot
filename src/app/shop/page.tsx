"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Button, PageHeader, Thinking, Typewriter } from "@/components/ui";

interface Msg {
  role: "user" | "assistant";
  content: string;
  checkout?: { approveUrl?: string; orderId: string; total: string; item: string; quantity: number };
  products?: C3Product[];
}

interface C3Product {
  id: string;
  name: string;
  price: string;
  currency: string;
  blurb: string;
  imageUrl?: string;
  brand?: string;
  merchant?: string;
}

interface CatalogItem {
  name: string;
  price: string;
  blurb: string;
}

export default function ShopPage() {
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Welcome to the Copilot Store! Ask me anything about our products — and when you're ready, just say “buy <item>” and I'll create a secure PayPal checkout right here in the chat.",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/shop").then((r) => r.json()).then((d) => setCatalog(d.catalog ?? []));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  const buyProduct = async (p: C3Product) => {
    if (busy) return;
    setBusy(true);
    try {
      const d = await fetch("/api/shop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "buyProduct", productId: p.id }),
      }).then((r) => r.json());
      if (d.error) {
        setMessages((m) => [...m, { role: "assistant", content: `Couldn't create the order: ${d.error}` }]);
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: `Excellent taste! ${d.item} comes to $${d.total}. Your secure PayPal checkout is ready:`,
            checkout: d,
          },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const history = [...messages, { role: "user" as const, content: text }];
    setMessages(history);
    setBusy(true);
    try {
      const buyMatch = text.match(/\bbuy\s+(?:(\d+)\s*[x×]?\s*)?(.+)/i);
      if (buyMatch) {
        const quantity = buyMatch[1] ? Number(buyMatch[1]) : 1;
        const d = await fetch("/api/shop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "buy", itemName: buyMatch[2], quantity }),
        }).then((r) => r.json());
        if (d.error) {
          setMessages((m) => [...m, { role: "assistant", content: `Hmm — ${d.error}. Try one of the items on the right!` }]);
        } else {
          setMessages((m) => [
            ...m,
            {
              role: "assistant",
              content: `Great choice! ${d.quantity} × ${d.item} comes to $${d.total}. Your secure PayPal checkout is ready:`,
              checkout: d,
            },
          ]);
        }
      } else {
        const d = await fetch("/api/shop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "chat",
            history: history.map(({ role, content }) => ({ role, content })),
          }),
        }).then((r) => r.json());
        setMessages((m) => [
          ...m,
          { role: "assistant", content: d.reply ?? d.error ?? "…", products: d.products },
        ]);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Chat-to-"
        accent="Checkout"
        subtitle="An AI shopkeeper that sells in conversation. The moment you commit, it mints a real PayPal order and hands you the approval link — the same agentic-commerce flow PayPal is shipping with ChatGPT and Perplexity."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat */}
        <div className="card lg:col-span-2 flex flex-col h-150">
          <div className="flex-1 overflow-y-auto scroll-thin p-5 space-y-4">
            <AnimatePresence>
              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-[var(--accent-deep)] text-white rounded-br-md"
                        : "bg-[var(--surface-2)] border border-[var(--hairline)] rounded-bl-md"
                    }`}
                  >
                    {m.role === "assistant" && i === messages.length - 1 && !m.checkout ? (
                      <Typewriter text={m.content} speed={10} />
                    ) : (
                      m.content
                    )}
                    {m.products && m.products.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {m.products.map((p, pi) => (
                          <motion.div
                            key={p.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 + pi * 0.1 }}
                            className="rounded-xl bg-[var(--surface)] border border-[var(--hairline)] overflow-hidden"
                          >
                            {p.imageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imageUrl} alt={p.name} className="h-28 w-full object-cover" />
                            )}
                            <div className="p-3">
                              <div className="text-xs font-medium leading-snug line-clamp-2">{p.name}</div>
                              <div className="text-[10px] text-[var(--ink-muted)] mt-0.5">
                                {p.brand ?? p.merchant} · via Channel3
                              </div>
                              <div className="mt-2 flex items-center justify-between">
                                <span className="text-sm font-semibold text-[var(--aqua)]">${p.price}</span>
                                <button
                                  onClick={() => buyProduct(p)}
                                  className="text-[11px] font-semibold bg-[var(--accent)] hover:bg-[#4a93ea] text-white rounded-full px-3 py-1 transition-colors"
                                >
                                  Buy
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                    {m.checkout && (
                      <motion.a
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                        href={m.checkout.approveUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-sweep mt-3 flex items-center justify-center gap-2 rounded-xl bg-[#ffc439] text-[#0b0b0b] font-semibold px-4 py-2.5 hover:bg-[#ffd14f] transition-colors"
                      >
                        <span className="italic font-bold">Pay</span>Pal · Pay ${m.checkout.total}
                      </motion.a>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {busy && <Thinking label="Shopkeeper is typing" />}
            <div ref={bottomRef} />
          </div>
          <div className="border-t border-[var(--hairline)] p-4 flex gap-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder='Try: "something for my desk" — then "buy orbit phone stand"'
              className="flex-1 bg-[var(--surface-2)] border border-[var(--hairline)] rounded-full px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)] transition-colors"
            />
            <Button onClick={send} disabled={busy || !input.trim()}>
              Send
            </Button>
          </div>
        </div>

        {/* Catalog */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--ink-muted)]">
            Catalog
          </h2>
          {catalog.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="card card-hover p-4 cursor-pointer"
              onClick={() => setInput(`buy ${c.name}`)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{c.name}</span>
                <span className="text-sm font-semibold text-[var(--aqua)]">${c.price}</span>
              </div>
              <p className="text-xs text-[var(--ink-2)] mt-1">{c.blurb}</p>
            </motion.div>
          ))}
          <p className="text-xs text-[var(--ink-muted)] pt-1">
            Click an item to prefill “buy …”. Approve payments with your sandbox buyer account.
          </p>
        </div>
      </div>
    </div>
  );
}
