/**
 * Tiny JSON file store (.data/store.json) — tracks IDs the PayPal API can't
 * enumerate for us (subscriptions have no list-all endpoint) plus demo state.
 */
import { promises as fs } from "fs";
import path from "path";

export interface TrackedSubscription {
  id: string;
  planId: string;
  planName: string;
  price: string;
  createdAt: string;
  lastStatus?: string;
}

export interface TrackedPayout {
  batchId: string;
  createdAt: string;
  ruleText: string;
  items: { email: string; amount: string; note?: string }[];
  lastStatus?: string;
}

export interface StoreShape {
  seededInvoiceIds: string[];
  subscriptions: TrackedSubscription[];
  payouts: TrackedPayout[];
  capturedOrders: { orderId: string; total: string; capturedAt: string }[];
}

const EMPTY: StoreShape = { seededInvoiceIds: [], subscriptions: [], payouts: [], capturedOrders: [] };
const FILE = path.join(process.cwd(), ".data", "store.json");

export async function readStore(): Promise<StoreShape> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY };
  }
}

export async function writeStore(data: StoreShape): Promise<void> {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(data, null, 2));
}

export async function updateStore(fn: (s: StoreShape) => StoreShape | void): Promise<StoreShape> {
  const s = await readStore();
  const next = fn(s) ?? s;
  await writeStore(next);
  return next;
}
