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

  // Input Mode: 'paste' | 'program' | 'url'
  const [inputMode, setInputMode] = useState<"paste" | "program" | "url">("paste");

  // Resolution states
  const [resolutionRunning, setResolutionRunning] = useState(false);
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [resolvedCode, setResolvedCode] = useState<string | null>(null);

  // Step 1: Audit states
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditRationale, setAuditRationale] = useState<string | null>(null);
  const [auditSource, setAuditSource] = useState<"live" | "cache" | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

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

  function resetResolutionAndAudit() {
    setInputHash("");
    setAuditRationale(null);
    setAuditSource(null);
    setAuditError(null);
    setResolutionError(null);
    setResolvedCode(null);
    setSubmit("idle");
    setSubmitError(null);
    setOnchainTransactionId(null);
  }

  function applyExample(key: keyof typeof ATTESTATION_EXAMPLES) {
    const ex = ATTESTATION_EXAMPLES[key];
    setInputText(ex.input);
    setInputHash(ex.hash);
    setVerdict(ex.verdict);
    setAuditRationale(ex.rationale);
    setAuditSource("cache");
    setAuditError(null);
    setSubmit("idle");
    setSubmitError(null);
    setOnchainTransactionId(null);
    setInputMode("paste");
    setResolutionError(null);
    setResolvedCode(null);
  }

  const ownerValid = isLikelyAleoAddress(owner);
  const textValid = inputText.trim().length > 0;
  const readyToAttest = ownerValid && inputHash !== "" && submit === "idle" && !auditRunning && !resolutionRunning;

  async function handleRunAudit() {
    if (!textValid) return;
    setAuditRunning(true);
    setAuditRationale(null);
    setAuditSource(null);
    setInputHash("");
    setSubmit("idle");
    setSubmitError(null);
    setOnchainTransactionId(null);
    setResolutionError(null);
    setResolvedCode(null);

    setAuditError(null);
    let codeToAudit = inputText.trim();

    // Auto-detect program ID or URL in raw paste mode, or explicitly set
    const isProgramPattern = /^[a-z0-9_]+\.aleo$/i.test(codeToAudit);
    const isUrlPattern = /^https?:\/\//i.test(codeToAudit) || /^github\.com/i.test(codeToAudit) || /^raw\.githubusercontent\.com/i.test(codeToAudit);

    const shouldResolveProgram = inputMode === "program" || (inputMode === "paste" && isProgramPattern && !isUrlPattern);
    const shouldResolveUrl = inputMode === "url" || (inputMode === "paste" && isUrlPattern);

    if (shouldResolveProgram) {
      setResolutionRunning(true);
      try {
        const res = await fetch("/api/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "program", target: codeToAudit }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to resolve program source.");
        }
        const data = await res.json();
        codeToAudit = data.sourceCode;
        setResolvedCode(codeToAudit);
      } catch (err: any) {
        setResolutionError(err.message || "Failed to resolve program.");
        setAuditRunning(false);
        setResolutionRunning(false);
        return;
      } finally {
        setResolutionRunning(false);
      }
    } else if (shouldResolveUrl) {
      setResolutionRunning(true);
      try {
        const res = await fetch("/api/resolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "url", target: codeToAudit }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Failed to resolve URL.");
        }
        const data = await res.json();
        codeToAudit = data.sourceCode;
        setResolvedCode(codeToAudit);
      } catch (err: any) {
        setResolutionError(err.message || "Failed to resolve URL.");
        setAuditRunning(false);
        setResolutionRunning(false);
        return;
      } finally {
        setResolutionRunning(false);
      }
    }

    try {
      const res = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: codeToAudit }),
      });
      if (!res.ok) {
        let errText = "Audit API returned an error status.";
        try {
          const errData = await res.json();
          if (errData.error) {
            errText = errData.error;
          }
        } catch {}
        throw new Error(errText);
      }
      const data = await res.json();
      setInputHash(data.hash);
      setVerdict(data.verdict);
      setAuditRationale(data.rationale);
      setAuditSource(data.source);
    } catch (err: any) {
      console.warn("[Audit] Failed live Groq call:", err);

      let matchedFixture = null;
      for (const key of Object.keys(ATTESTATION_EXAMPLES)) {
        if (ATTESTATION_EXAMPLES[key].input === codeToAudit) {
          matchedFixture = ATTESTATION_EXAMPLES[key];
          break;
        }
      }

      if (matchedFixture) {
        console.log("[Audit] Matched demo fixture, using client-side cache fallback");
        const hash = computeSimpleHash(codeToAudit);
        setInputHash(hash);
        setVerdict(matchedFixture.verdict);
        setAuditRationale(matchedFixture.rationale);
        setAuditSource("cache");
      } else {
        setAuditError(err.message || "Audit failed.");
        setInputHash("");
        setVerdict(true);
        setAuditRationale(null);
        setAuditSource(null);
      }
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
    setAuditError(null);
    setSubmit("idle");
    setSubmitError(null);
    setOnchainTransactionId(null);
    setResolutionError(null);
    setResolvedCode(null);
  }

  return (
    <div>
      <div className="mb-6">
        <img src="/logo.png" alt="Veil Logo" className="w-12 h-12 object-contain" />
      </div>
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

            {/* Input Mode Selector */}
            <div className="flex border-b border-rule pb-2 mb-4 gap-4">
              <button
                type="button"
                className={`pb-2 text-[0.8125rem] font-semibold border-b-2 transition-all ${
                  inputMode === "paste"
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
                onClick={() => {
                  setInputMode("paste");
                  resetResolutionAndAudit();
                }}
              >
                Paste Code
              </button>
              <button
                type="button"
                className={`pb-2 text-[0.8125rem] font-semibold border-b-2 transition-all ${
                  inputMode === "program"
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
                onClick={() => {
                  setInputMode("program");
                  resetResolutionAndAudit();
                }}
              >
                Aleo Program ID
              </button>
              <button
                type="button"
                className={`pb-2 text-[0.8125rem] font-semibold border-b-2 transition-all ${
                  inputMode === "url"
                    ? "border-ink text-ink"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
                onClick={() => {
                  setInputMode("url");
                  resetResolutionAndAudit();
                }}
              >
                GitHub URL
              </button>
            </div>

            <div>
              <label className="field-label" htmlFor="input-text">
                {inputMode === "paste"
                  ? "Evaluation Plaintext / Report Target"
                  : inputMode === "program"
                    ? "Aleo Program ID"
                    : "GitHub URL"}
              </label>
              <textarea
                id="input-text"
                className="field"
                rows={inputMode === "paste" ? 3 : 2}
                placeholder={
                  inputMode === "paste"
                    ? "Describe the scan, audit report, or text evaluated by the agent..."
                    : inputMode === "program"
                      ? "e.g. credits.aleo or veil_attest_v2.aleo"
                      : "e.g. https://github.com/facebook/react/blob/main/README.md"
                }
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  setInputHash("");
                  setAuditRationale(null);
                  setAuditSource(null);
                  setResolutionError(null);
                  setResolvedCode(null);
                }}
              />
              {inputMode === "paste" && (
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
              )}
            </div>

            {resolutionError && (
              <div className="border border-accent bg-cream/50 p-4 text-[0.8125rem] text-accent font-semibold">
                Error resolving program: {resolutionError}
              </div>
            )}

            {auditError && (
              <div className="border border-accent bg-cream/50 p-4 text-[0.8125rem] text-accent font-semibold">
                Audit Error: {auditError}
              </div>
            )}

            {resolvedCode && (
              <div className="border border-rule bg-cream p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="field-label uppercase text-ink-soft">
                    Resolved Source Code
                  </span>
                  <span className="text-[0.6875rem] font-semibold text-ink-soft">
                    {resolvedCode.length} characters
                  </span>
                </div>
                <pre className="text-[0.75rem] bg-paper p-3 overflow-x-auto max-h-40 border border-rule font-mono leading-relaxed select-all">
                  {resolvedCode}
                </pre>
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={!textValid || auditRunning || resolutionRunning}
                className="inline-flex items-center gap-2 bg-ink px-5 py-2.5 text-[0.8125rem] font-semibold text-cream disabled:opacity-40"
              >
                {(resolutionRunning || auditRunning) ? <Spinner /> : null}
                {resolutionRunning
                  ? "Resolving Program Source..."
                  : auditRunning
                    ? "Running Live LLM Audit..."
                    : "Run AI Audit"}
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
