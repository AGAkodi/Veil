"use client";

import { useState } from "react";
import {
  DEMO_SANCTIONS_LIST,
  buildProveComplianceTransaction,
  describeWalletError,
  isFailedStatus,
  pollTransactionStatus,
} from "../../lib/aleo";
import {
  COMPLIANCE_EXAMPLES,
  EXPLORER_TX_URL,
  LIVE_COMPLIANCE_TX,
  checkCompliance,
  isLikelyAleoAddress,
} from "../../lib/compliance";
import { Spinner } from "../../components/Spinner";
import { useWallet } from "../../lib/wallet-context";

type Result = "idle" | "clean" | "sanctioned" | "invalid";
type OnChainState = "idle" | "building" | "broadcasting" | "confirmed" | "failed";

export default function CompliancePage() {
  const { status, isDemo, executeTransaction, transactionStatus } = useWallet();
  const [inputAddress, setInputAddress] = useState("");
  const [result, setResult] = useState<Result>("idle");

  const [onChain, setOnChain] = useState<OnChainState>("idle");
  const [onChainError, setOnChainError] = useState<string | null>(null);
  const [onChainTempId, setOnChainTempId] = useState<string | null>(null);
  const [onChainTxId, setOnChainTxId] = useState<string | null>(null);
  const [onChainStatus, setOnChainStatus] = useState<string | null>(null);

  function runCheck(value: string) {
    setInputAddress(value);
    setOnChain("idle");
    setOnChainError(null);
    setOnChainTempId(null);
    setOnChainTxId(null);
    setOnChainStatus(null);
    if (!isLikelyAleoAddress(value)) {
      setResult(value.trim() === "" ? "idle" : "invalid");
      return;
    }
    setResult(checkCompliance(value));
  }

  const canRunOnChain =
    status === "connected" &&
    !isDemo &&
    !!executeTransaction &&
    !!transactionStatus &&
    result !== "idle" &&
    result !== "invalid" &&
    onChain === "idle";

  async function runOnChain() {
    if (!canRunOnChain || !executeTransaction || !transactionStatus) return;
    setOnChainError(null);
    try {
      setOnChain("building");
      const tx = buildProveComplianceTransaction(
        inputAddress.trim(),
        DEMO_SANCTIONS_LIST
      );
      setOnChain("broadcasting");
      const result = await executeTransaction(tx);
      const tempId = result?.transactionId ?? null;
      setOnChainTempId(tempId);
      if (!tempId) throw new Error("Wallet did not return a transaction id.");

      const polled = await pollTransactionStatus(transactionStatus, tempId);
      setOnChainStatus(polled.status);
      setOnChainTxId(polled.transactionId ?? null);
      setOnChain(isFailedStatus(polled.status) ? "failed" : "confirmed");
    } catch (err) {
      setOnChainError(describeWalletError(err));
      setOnChain("idle");
    }
  }

  return (
    <div>
      <p className="eyebrow">Screening</p>
      <h1 className="display mt-5 max-w-xl text-[2.25rem] sm:text-[2.875rem]">
        Prove absence, not{" "}
        <span className="display-accent">identity.</span>
      </h1>
      <p className="prose-body mt-6 max-w-xl text-[0.9375rem] leading-relaxed">
        <code>prove_compliance</code> takes the sanctions list as a{" "}
        <strong>public</strong> input — anyone can audit what a call actually
        checked against — while the counterparty being screened stays
        private. A failed check traps the transition before it produces
        anything.
      </p>

      <div className="mt-8 max-w-xl border border-rule bg-paper px-6 py-5">
        <p className="field-label mb-2">Proven live, not simulated</p>
        <p className="text-[0.875rem] leading-relaxed text-ink-soft">
          This exact function already ran on Aleo testnet against a clean
          address and returned <code>true</code>.
        </p>
        <a
          href={EXPLORER_TX_URL(LIVE_COMPLIANCE_TX)}
          target="_blank"
          rel="noreferrer"
          className="link-arrow mt-3 inline-flex items-center gap-1.5 text-[0.8125rem] font-semibold text-ink underline-offset-4 hover:underline"
        >
          View the transaction
        </a>
      </div>

      <div className="mt-10 max-w-xl">
        <label className="field-label" htmlFor="check-address">
          Address to screen
        </label>
        <input
          id="check-address"
          className="field field-mono"
          placeholder="aleo1…"
          value={inputAddress}
          onChange={(e) => runCheck(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="mt-2 flex gap-4 text-[0.75rem]">
          <button
            type="button"
            className="font-semibold text-ink-soft hover:text-ink"
            onClick={() => runCheck(COMPLIANCE_EXAMPLES.clean.address)}
          >
            Try the clean example
          </button>
          <button
            type="button"
            className="font-semibold text-ink-soft hover:text-ink"
            onClick={() => runCheck(COMPLIANCE_EXAMPLES.sanctioned.address)}
          >
            Try the sanctioned example
          </button>
        </div>

        <div className="mt-6">
          {result === "idle" && (
            <span className="pill pill-neutral">Enter an address to check</span>
          )}
          {result === "invalid" && (
            <span className="pill pill-neutral">
              Doesn&apos;t look like an Aleo address yet
            </span>
          )}
          {result === "clean" && (
            <div>
              <span className="pill pill-ok">Clear — not on the sanctions list</span>
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
                {inputAddress === COMPLIANCE_EXAMPLES.clean.address
                  ? COMPLIANCE_EXAMPLES.clean.note
                  : "Simulated client-side against this build's demo fixture — connect a wallet to run the real transition below."}
              </p>
            </div>
          )}
          {result === "sanctioned" && (
            <div>
              <span className="pill pill-blocked">Blocked — on the sanctions list</span>
              <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
                {COMPLIANCE_EXAMPLES.sanctioned.note} On-chain, this address
                would fail the transition&apos;s assertion rather than
                return false — the button below will actually trigger that.
              </p>
            </div>
          )}
        </div>

        {status === "connected" && !isDemo && result !== "idle" && result !== "invalid" && (
          <div className="mt-6 border border-rule bg-paper px-6 py-5">
            <p className="field-label mb-3">Run this exact check on-chain</p>
            {onChain === "idle" && (
              <>
                <button
                  type="button"
                  onClick={runOnChain}
                  disabled={!canRunOnChain}
                  className="inline-flex items-center gap-2 bg-ink px-5 py-2.5 text-[0.8125rem] font-semibold text-cream disabled:opacity-40"
                >
                  Run on testnet
                </button>
                <p className="mt-3 text-[0.75rem] leading-relaxed text-ink-soft">
                  Uses the same 10-entry demo list as{" "}
                  <code>program/tests/test_veil.leo</code> (real
                  BHP256 hash of the sanctioned example included, not a
                  placeholder) — costs a small real testnet fee.
                </p>
                {onChainError && (
                  <p className="mt-2 text-[0.8125rem] text-accent">{onChainError}</p>
                )}
              </>
            )}
            {(onChain === "building" || onChain === "broadcasting") && (
              <span className="inline-flex items-center gap-2 text-[0.8125rem] text-ink-soft">
                <Spinner />
                {onChain === "building" ? "Building the proof…" : "Waiting on the wallet…"}
              </span>
            )}
            {onChain === "confirmed" && (
              <div className="text-[0.8125rem] leading-relaxed">
                <span className="pill pill-ok">Confirmed</span>
                <p className="mt-3 text-ink-soft">
                  {onChainStatus && `Status: ${onChainStatus}. `}
                  {onChainTxId ? (
                    <>
                      On-chain id:{" "}
                      <span className="field-mono">{onChainTxId}</span>.{" "}
                      <a
                        href={EXPLORER_TX_URL(onChainTxId)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-ink underline-offset-4 hover:underline"
                      >
                        View on the explorer
                      </a>
                    </>
                  ) : (
                    <>
                      Wallet transaction id:{" "}
                      <span className="field-mono">{onChainTempId}</span>. Still
                      waiting on the on-chain id to finalize.
                    </>
                  )}
                </p>
              </div>
            )}
            {onChain === "failed" && (
              <div className="text-[0.8125rem] leading-relaxed">
                <span className="pill pill-blocked">Failed</span>
                <p className="mt-3 text-ink-soft">
                  The wallet reports this execution failed
                  {onChainStatus && ` (${onChainStatus})`} — expected if{" "}
                  <code>prove_compliance</code>&apos;s assertion trapped
                  because this address is on the list just used.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
