"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { WalletProvider, useWallet, truncateAddress } from "../lib/wallet-context";

const NAV = [
  { href: "/app", label: "Connect" },
  { href: "/app/send", label: "Send" },
  { href: "/app/compliance", label: "Compliance" },
] as const;

function ConnectedWalletMenu({
  address,
  disconnect,
}: {
  address: string;
  disconnect: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pill pill-ok field-mono"
      >
        {truncateAddress(address)}
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-2 w-48 border border-rule bg-cream shadow-sm">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(address);
              setOpen(false);
            }}
            className="block w-full px-4 py-2.5 text-left text-[0.8125rem] text-ink hover:bg-paper"
          >
            Copy address
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
            className="block w-full border-t border-rule px-4 py-2.5 text-left text-[0.8125rem] font-semibold text-accent hover:bg-paper"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

function WalletPill() {
  const { status, address, disconnect } = useWallet();

  if (status === "connected" && address) {
    return <ConnectedWalletMenu address={address} disconnect={disconnect} />;
  }
  if (status === "connecting") {
    return <span className="pill pill-neutral">Connecting…</span>;
  }
  return <span className="pill pill-neutral">Not connected</span>;
}

function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="border-b border-rule">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-6 py-6 sm:px-10">
        <Link href="/" className="display text-[1.25rem] tracking-tight">
          Veil
        </Link>
        <nav className="hidden items-center gap-8 text-[0.8125rem] text-ink-soft sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                pathname === item.href
                  ? "text-ink font-medium"
                  : "hover:text-ink"
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <span className="eyebrow hidden md:inline">Aleo Testnet</span>
          <WalletPill />
        </div>
      </div>
      {/* Nav row for small screens, since the header nav hides below sm. */}
      <nav className="flex items-center gap-6 border-t border-rule px-6 py-3 text-[0.8125rem] text-ink-soft sm:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname === item.href ? "text-ink font-medium" : ""}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <WalletProvider>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-14 sm:px-10 sm:py-20">
        {children}
      </main>
      <footer className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span className="text-[0.8125rem] text-ink-soft">
            veil_rails_v2.aleo — Aleo testnet
          </span>
          <span className="text-[0.8125rem] text-ink-soft">
            Demo build — see the README for what&apos;s live vs. simulated.
          </span>
        </div>
      </footer>
    </WalletProvider>
  );
}
