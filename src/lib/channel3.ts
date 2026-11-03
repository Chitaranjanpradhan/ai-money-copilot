/**
 * Channel3 (hackathon sponsor) — AI product-search API.
 * Lets the shopkeeper sell REAL products: search → show cards → PayPal checkout.
 * Without CHANNEL3_API_KEY the shop falls back to the local demo catalog.
 */

const BASE = "https://api.trychannel3.com";

export interface C3Product {
  id: string;
  name: string;
  price: string; // "425.00"
  currency: string;
  blurb: string;
  imageUrl?: string;
  brand?: string;
  merchant?: string;
}

export function channel3Available(): boolean {
  return Boolean(process.env.CHANNEL3_API_KEY);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function normalize(p: any): C3Product | null {
  const offer = (p.offers ?? []).find((o: any) => o?.price?.price != null);
  if (!offer) return null;
  return {
    id: p.id,
    name: p.title,
    price: Number(offer.price.price).toFixed(2),
    currency: offer.price.currency ?? "USD",
    blurb: (p.description ?? "").slice(0, 140),
    imageUrl: p.images?.find((i: any) => i.is_main_image)?.url ?? p.images?.[0]?.url,
    brand: p.brands?.[0]?.name,
    merchant: offer.domain,
  };
}

export async function searchProducts(query: string, limit = 6): Promise<C3Product[]> {
  const key = process.env.CHANNEL3_API_KEY;
  if (!key) return [];
  const res = await fetch(`${BASE}/v1/search`, {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit }),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.products ?? []).map(normalize).filter(Boolean).slice(0, 4) as C3Product[];
}

export async function getProduct(id: string): Promise<C3Product | null> {
  const key = process.env.CHANNEL3_API_KEY;
  if (!key) return null;
  const res = await fetch(`${BASE}/v1/products/${id}`, {
    headers: { "x-api-key": key },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return normalize(await res.json());
}
