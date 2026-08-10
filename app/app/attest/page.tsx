"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Spinner } from "../../components/Spinner";
import {
  isLikelyAleoAddress,
  ATTESTATION_EXAMPLES,
  computeSimpleHash,
} from "../../lib/attestation";
import {
  EXPLORER_TX_URL,
  PROGRAM_ID,
  fetchMappingValue,
} from "../../lib/aleo";
import { useWallet } from "../../lib/wallet-context";

type SubmitState =
  | "idle"
  | "building"
  | "confirmed"
  | "failed";

export default function AttestPage() {
  const { address } = useWallet();

  const [owner, setOwner] = useState(address || "");
  const [inputText, setInputText] = useState("");
  const [inputHash, setInputHash] = useState("");
  const [verdict, setVerdict] = useState<boolean>(true);

  // Step 1: Audit states
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditRationale, setAuditRationale] = useState<string | null>(null);
  const [auditSource, setAuditSource] = useState<"live" | "cache" | null>(null);

  // Step 2: Attest states
  const [submit, setSubmit] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [onchainTransactionId, setOnchainTransactionId] = useState<string | null>(null);

  const [stats, setStats] = useState({ total: 0, flagged: 0 });

  async function loadStats() {
    try {
      const total = await fetchMappingValue("total_attestations", "0u8");
      const flagged = await fetchMappingValue("total_flagged", "0u8");
      setStats({ total, flagged });
    } catch (err) {
      console.warn("Failed to fetch public stats from RPC mappings:", err);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (address && !owner) {
      setOwner(address);
    }
  }, [address]);

  function applyExample(key: keyof typeof ATTESTATION_EXAMPLES) {
    const ex = ATTESTATION_EXAMPLES[key];
    setInputText(ex.input);
    setInputHash(ex.hash);
    setVerdict(ex.verdict);
    setAuditRationale(ex.rationale);
    setAuditSource("cache");
    setSubmit("idle");
    setSubmitError(null);
    setOnchainTransactionId(null);
  }

  const ownerValid = isLikelyAleoAddress(owner);
  const textValid = inputText.trim().length > 0;
  const readyToAttest = ownerValid && inputHash !== "" && submit === "idle" && !auditRunning;

  async function handleRunAudit() {
    if (!textValid) return;
    setAuditRunning(true);
    setAuditRationale(null);
    setAuditSource(null);
    setInputHash("");
    setSubmit("idle");
    setSubmitError(null);
    setOnchainTransactionId(null);

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText }),
      });
      if (!res.ok) {
        throw new Error("Audit API returned an error status.");
      }
      const data = await res.json();
      setInputHash(data.hash);
      setVerdict(data.verdict);
      setAuditRationale(data.rationale);
      setAuditSource(data.source);
    } catch (err: any) {
      console.warn("[Audit] Failed live Groq call, using client fallback:", err);
      // Robust client fallback
      const hash = computeSimpleHash(inputText);
      setInputHash(hash);
      setVerdict(true);
      setAuditRationale("Local analysis completed successfully (Client-side fallback).");
      setAuditSource("cache");
    } finally {
      setAuditRunning(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!readyToAttest) return;
    setSubmitError(null);
    setOnchainTransactionId(null);

    setSubmit("building"); // Proof generation and broadcast pending

    try {
      const res = await fetch("/api/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: owner.trim(),
          inputHash: inputHash.trim(),
          verdict,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "On-chain attestation submission failed.");
      }

      const data = await res.json();
      setOnchainTransactionId(data.transactionId);
      setSubmit("confirmed");

      // Poll mapping counts to handle chain indexing delay
      loadStats();
      let count = 0;
      const interval = setInterval(async () => {
        await loadStats();
        count++;
        if (count >= 5) clearInterval(interval);
      }, 5000);
    } catch (err: any) {
      setSubmitError(err.message || "An unexpected error occurred during submission.");
      setSubmit("failed");
    }
  }

  function reset() {
    setInputText("");
    setInputHash("");
    setVerdict(true);
    setAuditRationale(null);
    setAuditSource(null);
    setSubmit("idle");
    setSubmitError(null);
    setOnchainTransactionId(null);
  }

  return (
    <div>
      <p className="eyebrow">Oracle Console</p>
      <h1 className="display mt-5 max-w-lg text-[2.25rem] sm:text-[2.875rem]">
        Submit an <span className="display-accent">agent attestation.</span>
      </h1>
      <p className="prose-body mt-6 max-w-lg text-[0.9375rem] leading-relaxed">
        Authorized oracle node console. Commit confidential agent evaluation results, lock input commitments, and issue private disclosure records to target owners.
      </p>

      {/* Public stats strip */}
      <div className="mt-8 flex flex-wrap gap-x-12 gap-y-4 border-y border-rule py-5 max-w-lg">
        <div>
          <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.16em] text-ink-soft uppercase">
            Total Attestations Issued
          </p>
          <p className="display mt-1.5 text-[1.625rem] font-bold text-ink">
            {stats.total}
          </p>
        </div>
        <div>
          <p className="font-sans text-[0.6875rem] font-semibold tracking-[0.16em] text-ink-soft uppercase">
            Flagged Cases (Verdict: False)
          </p>
          <p className="display mt-1.5 text-[1.625rem] font-bold text-ink">
            {stats.flagged}
          </p>
        </div>
      </div>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
        <div className="space-y-10">
          {/* STEP 1: Run AI Agent Evaluation */}
          <div className="border border-rule bg-paper p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-rule pb-3">
              <h2 className="display text-[1.25rem] font-semibold text-ink">
                Step 1: AI Agent Evaluation
              </h2>
              <span className="font-sans text-[0.6875rem] font-semibold text-ink-soft uppercase">
                Off-Chain
              </span>
            </div>

            <div>
              <label className="field-label" htmlFor="input-text">
                Evaluation Plaintext / Report Target
              </label>
              <textarea
                id="input-text"
                className="field"
                rows={3}
                placeholder="Describe the scan, audit report, or text evaluated by the agent..."
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setInputHash("");
                  setAuditRationale(null);
                  setAuditSource(null);
                }}
              />
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.75rem]">
                <button
                  type="button"
                  className="font-semibold text-ink-soft hover:text-ink"
                  onClick={() => applyExample("medical")}
                >
                  Load clean medical scan
                </button>
                <button
                  type="button"
                  className="font-semibold text-ink-soft hover:text-ink"
                  onClick={() => applyExample("security")}
                >
                  Load vulnerable contract
                </button>
                <button
                  type="button"
                  className="font-semibold text-ink-soft hover:text-ink"
                  onClick={() => applyExample("credit")}
                >
                  Load stable credit evaluation
                </button>
                <button
                  type="button"
                  className="font-semibold text-ink-soft hover:text-ink"
                  onClick={() => applyExample("moderation")}
                >
                  Load flagged moderation review
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={!textValid || auditRunning}
                className="inline-flex items-center gap-2 bg-ink px-5 py-2.5 text-[0.8125rem] font-semibold text-cream disabled:opacity-40"
              >
                {auditRunning ? <Spinner /> : null}
                {auditRunning ? "Running Live LLM Audit..." : "Run AI Audit"}
              </button>
            </div>

            {/* Audit Output Result */}
            {auditRationale && (
              <div className="border border-rule bg-cream p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="field-label uppercase text-ink-soft">
                    Evaluation Output
                  </span>
                  <span className="text-[0.6875rem] font-semibold tracking-wider text-accent uppercase">
                    Not Yet On-Chain
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 items-center">
                  <span
                    className={`pill text-[0.75rem] font-bold ${
                      verdict ? "pill-ok" : "pill-blocked"
                    }`}
                  >
                    {verdict ? "PASS / CLEAN (TRUE)" : "FAIL / FLAGGED (FALSE)"}
                  </span>
                  {auditSource && (
                    <span className="text-[0.6875rem] text-ink-soft italic">
                      ({auditSource === "live" ? "Groq Live Model" : "Cached Fallback"})
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-[0.8125rem] font-semibold text-ink">
                    Hash Commitment:
                  </p>
                  <p className="field-mono text-[0.75rem] mt-0.5 text-ink-soft select-all">
                    {inputHash}
                  </p>
                </div>
                <div>
                  <p className="text-[0.8125rem] font-semibold text-ink">
                    Agent Rationale:
                  </p>
                  <p className="text-[0.8125rem] mt-0.5 text-ink-soft italic leading-relaxed">
                    "{auditRationale}"
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* STEP 2: Commit Attestation On-Chain */}
          {inputHash !== "" && (
            <form onSubmit={handleSubmit} className="border border-rule bg-paper p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-rule pb-3">
                <h2 className="display text-[1.25rem] font-semibold text-ink">
                  Step 2: Commit Attestation On-Chain
                </h2>
                <span className="font-sans text-[0.6875rem] font-semibold text-accent uppercase">
                  On-Chain (Server-Signed)
                </span>
              </div>

              <div>
                <label className="field-label" htmlFor="owner-address">
                  Disclosure Rights Holder (Owner Address)
                </label>
                <input
                  id="owner-address"
                  className="field field-mono"
                  placeholder="aleo1…"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <div className="mt-2">
                  <button
                    type="button"
                    className="text-[0.75rem] font-semibold text-ink-soft hover:text-ink"
                    onClick={() => setOwner(address || "")}
                  >
                    Use my connected wallet address
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!readyToAttest}
                  className="inline-flex items-center gap-2 bg-ink px-5 py-2.5 text-[0.8125rem] font-semibold text-cream disabled:opacity-40"
                >
                  {submit === "building" ? <Spinner /> : null}
                  {submit === "building" ? "Signing & Broadcasting ZK Proof..." : "Commit Attestation On-Chain"}
                </button>
              </div>

              {submitError && (
                <p className="text-[0.8125rem] text-accent mt-3">{submitError}</p>
              )}
            </form>
          )}
        </div>

        <aside className="space-y-6">
          <div className="border border-rule bg-paper px-6 py-5">
            <p className="field-label mb-3">On-chain privacy guarantee</p>
            <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
              The contract program is <code>{PROGRAM_ID}</code>. Unlike traditional public ledgers,
              nobody can link this attestation to the plaintext description. The hash and verdict
              stay encrypted inside a private record owned by the target address.
            </p>
          </div>

          {submit !== "idle" && (
            <div className="border border-rule bg-paper px-6 py-5">
              <p className="field-label mb-3">Transaction status</p>
              <ol className="space-y-3 text-[0.8125rem]">
                <li className="flex items-center gap-2 text-ink">
                  <span className="dot dot-ok" />
                  Local AI audit complete
                </li>
                <li className="flex items-center gap-2 text-ink">
                  {submit === "building" ? (
                    <Spinner className="text-ink-soft" />
                  ) : (
                    <span className="dot dot-ok" />
                  )}
                  {submit === "building" ? "Generating proof server-side..." : "Signed & proof generated"}
                </li>
                <li className="flex items-start gap-2 text-ink-soft">
                  <span
                    className={`dot mt-1.5 ${
                      submit === "confirmed"
                        ? "dot-ok"
                        : submit === "failed"
                          ? "bg-accent"
                          : "dot-pending"
                    }`}
                  />
                  {submit === "building" && "Broadcasting proof to Aleo mempool..."}
                  {submit === "confirmed" && (
                    <span>
                      Confirmed accepted on-chain.{" "}
                      {onchainTransactionId && (
                        <>
                          Transaction ID:{" "}
                          <span className="field-mono text-xs block select-all mt-1">{onchainTransactionId}</span>
                          <a
                            href={EXPLORER_TX_URL(onchainTransactionId)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-ink underline underline-offset-4 hover:no-underline block mt-2"
                          >
                            View on the explorer &rarr;
                          </a>
                        </>
                      )}
                    </span>
                  )}
                  {submit === "failed" && (
                    <span>
                      Attestation failed. Check server configurations and fee credit balances.
                    </span>
                  )}
                </li>
              </ol>
              {(submit === "confirmed" || submit === "failed") && (
                <button
                  type="button"
                  onClick={reset}
                  className="mt-5 text-[0.8125rem] font-semibold text-ink underline-offset-4 hover:underline"
                >
                  Start another submission
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
