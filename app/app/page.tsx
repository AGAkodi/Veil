"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowIcon } from "../components/ArrowIcon";
import { Spinner } from "../components/Spinner";
import {
  useWallet,
  truncateAddress,
  type WalletOption,
} from "../lib/wallet-context";

function AddressCard({
  address,
  isDemo,
}: {
  address: string;
  isDemo: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border border-rule bg-paper px-5 py-4">
      <div>
        <p className="field-label mb-1">
          {isDemo ? "Demo address (no real wallet connected)" : "Connected address"}
        </p>
        <p className="field-mono text-[0.9375rem]">{truncateAddress(address)}</p>
      </div>
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(address)}
        className="text-[0.8125rem] font-semibold text-ink underline-offset-4 hover:underline"
      >
        Copy
      </button>
    </div>
  );
}

function WalletRow({
  option,
  connecting,
  onConnect,
}: {
  option: WalletOption;
  connecting: boolean;
  onConnect: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-rule px-6 py-5 last:border-b-0">
      <div>
        <div className="flex items-center gap-2">
          <p className="display text-[1.0625rem]">{option.displayName}</p>
          {option.recommended && (
            <span className="pill pill-ok">Recommended</span>
          )}
        </div>
        <p className="mt-1 text-[0.8125rem] text-ink-soft">
          {option.recommended
            ? "Built by Provable with the Aleo Network Foundation — the recommended wallet for Aleo."
            : "Widely used third-party wallet with an official Aleo adapter."}
        </p>
      </div>
      {option.installed ? (
        <button
          type="button"
          onClick={onConnect}
          disabled={connecting}
          className="inline-flex items-center gap-2 bg-ink px-5 py-2.5 text-[0.8125rem] font-semibold text-cream disabled:opacity-60"
        >
          {connecting && <Spinner />}
          {connecting ? "Connecting…" : "Connect"}
        </button>
      ) : (
        <a
          href={option.installUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 border border-ink px-5 py-2.5 text-[0.8125rem] font-semibold text-ink"
        >
          Install
        </a>
      )}
    </div>
  );
}

export default function ConnectPage() {
  const {
    status,
    address,
    isDemo,
    error,
    walletOptions,
    connect,
    connectDemo,
    disconnect,
  } = useWallet();
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectingName, setConnectingName] = useState<string | null>(null);

  async function handleConnect(option: WalletOption) {
    setConnectError(null);
    setConnectingName(option.name);
    try {
      await connect(option.name);
    } catch {
      setConnectError(error);
    } finally {
      setConnectingName(null);
    }
  }

  const noneInstalled = walletOptions.length > 0 && walletOptions.every((w) => !w.installed);

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <img src="/logo.png" alt="Veil Logo" className="w-12 h-12 object-contain" />
      </div>
      <p className="eyebrow">Step one</p>
      <h1 className="display mt-5 text-[2.25rem] sm:text-[2.875rem]">
        Connect a wallet to{" "}
        <span className="display-accent">hold the keys yourself.</span>
      </h1>
      <p className="prose-body mt-6 max-w-lg text-[0.9375rem] leading-relaxed">
        Veil never touches your private key. Every transfer and every
        compliance check is approved from your own wallet — this screen only
        requests a connection.
      </p>

      {status !== "connected" && (
        <div className="mt-10 border border-rule bg-cream">
          {walletOptions.map((option) => (
            <WalletRow
              key={option.name}
              option={option}
              connecting={connectingName === option.name}
              onConnect={() => handleConnect(option)}
            />
          ))}
          <div className="px-6 py-5">
            {connectError && (
              <p className="mb-3 text-[0.8125rem] text-accent">{connectError}</p>
            )}
            <p className="mb-3 text-[0.8125rem] text-ink-soft">
              {noneInstalled
                ? "Neither wallet extension is detected in this browser."
                : "Detection updates automatically once an extension is installed."}
            </p>
            <button
              type="button"
              onClick={connectDemo}
              className="text-[0.8125rem] font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Continue in testnet demo mode instead
            </button>
          </div>
        </div>
      )}

      {status === "connected" && address && (
        <div className="mt-10 border border-rule bg-cream">
          <div className="flex items-center justify-between gap-4 border-b border-rule px-6 py-5">
            <p className="display text-[1.0625rem]">Wallet connected</p>
            <button
              type="button"
              onClick={disconnect}
              className="text-[0.8125rem] font-semibold text-ink-soft underline-offset-4 hover:text-ink hover:underline"
            >
              Disconnect
            </button>
          </div>
          <div className="px-6 py-5">
            <AddressCard address={address} isDemo={isDemo} />
          </div>
        </div>
      )}

      {status === "connected" && (
        <div className="mt-10 grid gap-px bg-rule sm:grid-cols-2">
          <Link
            href="/app/attest"
            className="link-arrow group block bg-cream px-6 py-6 sm:pr-8"
          >
            <p className="display text-[1.25rem]">Submit an attestation</p>
            <p className="mt-2 text-[0.8125rem] text-ink-soft">
              Commit model inputs, verdicts, and assign disclosure rights to any address.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink">
              Go to Attest
              <ArrowIcon />
            </span>
          </Link>
          <Link
            href="/app/verify"
            className="link-arrow group block bg-cream px-6 py-6 sm:pl-8"
          >
            <p className="display text-[1.25rem]">Verify an attestation</p>
            <p className="mt-2 text-[0.8125rem] text-ink-soft">
              Verify any private attestation record against its commitment hash in zero-knowledge.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink">
              Go to Verify
              <ArrowIcon />
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
