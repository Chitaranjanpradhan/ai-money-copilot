import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AI Money Copilot — PayPal × Claude",
  description:
    "One AI agent that earns, collects, audits, and pays — the full money loop on PayPal sandbox.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/invoices", label: "Invoice Chaser" },
  { href: "/shop", label: "Chat-to-Checkout" },
  { href: "/subscriptions", label: "Sub Auditor" },
  { href: "/payouts", label: "Payouts" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-[rgba(13,13,13,0.75)] border-b border-[var(--hairline)]">
          <div className="mx-auto max-w-6xl px-5 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-[#86b6ef] via-[#3987e5] to-[#9085e9]" />
              <span>
                Money<span className="gradient-text">Copilot</span>
              </span>
            </Link>
            <nav className="flex items-center gap-1 text-sm overflow-x-auto scroll-thin">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="px-3 py-1.5 rounded-full text-[var(--ink-2)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors whitespace-nowrap"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <span className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-xs text-[var(--ink-muted)] border border-[var(--hairline)] rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--good)]" />
              PayPal Sandbox
            </span>
          </div>
        </header>
        <main className="flex-1 mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
        <footer className="border-t border-[var(--hairline)] py-5 text-center text-xs text-[var(--ink-muted)]">
          Built for “Build What’s Next with PayPal and AI” · PayPal REST APIs + Claude · All money is sandbox money
        </footer>
      </body>
    </html>
  );
}
