"use client";

import Link from "next/link";
import { useState } from "react";
import { Spinner } from "../../components/Spinner";
import {
  isLikelyAleoAddress,
  ATTESTATION_EXAMPLES,
} from "../../lib/attestation";
import {
  EXPLORER_TX_URL,
  PROGRAM_ID,
  buildSubmitAttestationTransaction,
  describeWalletError,
  isFailedStatus,
  pollTransactionStatus,
} from "../../lib/aleo";
import { useWallet } from "../../lib/wallet-context";

type SubmitState =
  | "idle"
  | "building"
  | "broadcasting"
  | "confirmed"
  | "failed"
  | "demo-done";

export default function AttestPage() {
  const {
    status,
    isDemo,
    executeTransaction,
    transactionStatus,
    address,
  } = useWallet();

  const [owner, setOwner] = useState(address || "");
  const [inputText, setInputText] = useState("");
  const [inputHash, setInputHash] = useState("");
  const [verdict, setVerdict] = useState<boolean>(true);

  const [submit, setSubmit] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tempTransactionId, setTempTransactionId] = useState<string | null>(null);
  const [onchainTransactionId, setOnchainTransactionId] = useState<string | null>(null);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);

  // Quick utility to hash a string deterministically into an Aleo field representation
  // in case the user writes custom text instead of selecting a template.
  function computeSimpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    const positiveHash = Math.abs(hash);
    return `${positiveHash}field`;
  }

  function applyExample(key: keyof typeof ATTESTATION_EXAMPLES) {
    const ex = ATTESTATION_EXAMPLES[key];
    setInputText(ex.input);
    setInputHash(ex.hash);
    setVerdict(ex.verdict);
  }

  const ownerValid = isLikelyAleoAddress(owner);
  const textValid = inputText.trim().length > 0;
  const hashToSubmit = inputHash.trim() !== "" ? inputHash.trim() : computeSimpleHash(inputText);

  const canSubmit =
    status === "connected" &&
    ownerValid &&
    textValid &&
    submit === "idle";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);

    const finalHash = hashToSubmit;

    if (isDemo || !executeTransaction || !transactionStatus) {
      // Demo mode fallback
      setSubmit("building");
      window.setTimeout(() => setSubmit("demo-done"), 1100);
      return;
    }

    try {
      setSubmit("building");
      const tx = buildSubmitAttestationTransaction(owner.trim(), finalHash, verdict);

      setSubmit("broadcasting");
      const result = await executeTransaction(tx);
      const tempId = result?.transactionId ?? null;
      setTempTransactionId(tempId);
      if (!tempId) throw new Error("Wallet did not return a transaction id.");

      const polled = await pollTransactionStatus(transactionStatus, tempId);
      setFinalStatus(polled.status);
      setOnchainTransactionId(polled.transactionId ?? null);
      setSubmit(isFailedStatus(polled.status) ? "failed" : "confirmed");
    } catch (err) {
      setSubmitError(describeWalletError(err));
      setSubmit("idle");
    }
  }

  function reset() {
    setInputText("");
    setInputHash("");
    setVerdict(true);
    setSubmit("idle");
    setSubmitError(null);
    setTempTransactionId(null);
    setOnchainTransactionId(null);
    setFinalStatus(null);
  }

  if (status !== "connected") {
    return (
      <div className="max-w-lg border border-rule bg-paper px-7 py-8">
        <p className="display text-[1.375rem]">Connect your wallet first</p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          Submitting an attestation requires a connected wallet to sign the transition.
        </p>
        <Link
          href="/app"
          className="mt-6 inline-flex bg-ink px-5 py-2.5 text-[0.8125rem] font-semibold text-cream"
        >
          Go to Connect
        </Link>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">Step two</p>
      <h1 className="display mt-5 max-w-lg text-[2.25rem] sm:text-[2.875rem]">
        Submit an <span className="display-accent">AI attestation.</span>
      </h1>
      <p className="prose-body mt-6 max-w-lg text-[0.9375rem] leading-relaxed">
        Record AI verdicts on-chain privately. The hash commitment locks the model input,
        and only the owner holds the disclosure rights to verify it against the plaintext input later.
      </p>

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
        <form onSubmit={handleSubmit} className="space-y-6">
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
                Use my connected address
              </button>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="input-text">
              Input Description / Plaintext
            </label>
            <textarea
              id="input-text"
              className="field"
              rows={3}
              placeholder="Describe the scan, audit report, or text evaluated by the agent..."
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                setInputHash(""); // Clear precomputed hash to force regeneration
              }}
            />
            <div className="mt-2 flex gap-4 text-[0.75rem]">
              <button
                type="button"
                className="font-semibold text-ink-soft hover:text-ink"
                onClick={() => applyExample("medical")}
              >
                Load clean medical scan example
              </button>
              <button
                type="button"
                className="font-semibold text-ink-soft hover:text-ink"
                onClick={() => applyExample("security")}
              >
                Load vulnerable smart contract example
              </button>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="input-hash">
              Input Commitment Hash
            </label>
            <input
              id="input-hash"
              className="field field-mono"
              placeholder="Auto-computed deterministically..."
              value={inputText.trim() && !inputHash ? computeSimpleHash(inputText) : inputHash}
              readOnly
            />
            <p className="mt-1 text-[0.75rem] text-ink-soft">
              This hash represents the zero-knowledge commitment to the off-chain data.
            </p>
          </div>

          <div>
            <span className="field-label block mb-2">Agent Verdict</span>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setVerdict(true)}
                className={`flex-1 py-3 text-[0.8125rem] font-semibold border ${
                  verdict
                    ? "bg-paper border-ink text-ink font-bold"
                    : "border-rule text-ink-soft hover:text-ink"
                }`}
              >
                Pass / Clean (True)
              </button>
              <button
                type="button"
                onClick={() => setVerdict(false)}
                className={`flex-1 py-3 text-[0.8125rem] font-semibold border ${
                  !verdict
                    ? "bg-paper border-ink text-ink font-bold"
                    : "border-rule text-ink-soft hover:text-ink"
                }`}
              >
                Fail / Vulnerable (False)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 bg-ink px-6 py-3 text-[0.8125rem] font-semibold text-cream disabled:opacity-40"
          >
            {(submit === "building" || submit === "broadcasting") && <Spinner />}
            {submit === "building"
              ? "Building proof…"
              : submit === "broadcasting"
                ? "Broadcasting…"
                : "Submit Attestation"}
          </button>
          {submitError && (
            <p className="text-[0.8125rem] text-accent">{submitError}</p>
          )}
        </form>

        <aside className="space-y-6">
          <div className="border border-rule bg-paper px-6 py-5">
            <p className="field-label mb-3">On-chain privacy guarantee</p>
            <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
              The contract program is <code>{PROGRAM_ID}</code>. Unlike traditional ledgers,
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
                  Local validation complete
                </li>
                <li className="flex items-center gap-2 text-ink">
                  {submit === "building" ? (
                    <Spinner className="text-ink-soft" />
                  ) : (
                    <span className="dot dot-ok" />
                  )}
                  {submit === "building" ? "Building the proof…" : "Proof built"}
                </li>
                <li className="flex items-start gap-2 text-ink-soft">
                  {submit === "broadcasting" ? (
                    <Spinner className="mt-0.5 text-ink-soft" />
                  ) : (
                    <span
                      className={`dot mt-1.5 ${
                        submit === "confirmed"
                          ? "dot-ok"
                          : submit === "failed"
                            ? "bg-accent"
                            : "dot-pending"
                      }`}
                    />
                  )}
                  {submit === "demo-done" && (
                    <span>
                      Not broadcast — no real wallet connected in demo mode.
                      Connect Shield or Leo Wallet to submit this attestation on-chain.
                    </span>
                  )}
                  {submit === "broadcasting" && "Waiting on the wallet…"}
                  {submit === "confirmed" && (
                    <span>
                      Submitted{finalStatus && ` (${finalStatus})`}.{" "}
                      {onchainTransactionId ? (
                        <>
                          On-chain id:{" "}
                          <span className="field-mono text-xs">{onchainTransactionId}</span>
                          .{" "}
                          <a
                            href={EXPLORER_TX_URL(onchainTransactionId)}
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
                          <span className="field-mono text-xs">{tempTransactionId}</span>
                          . Still waiting on the on-chain id to finalize.
                        </>
                      )}
                    </span>
                  )}
                  {submit === "failed" && (
                    <span>
                      The wallet reported this transaction failed
                      {finalStatus && ` (${finalStatus})`}.
                    </span>
                  )}
                </li>
              </ol>
              {(submit === "demo-done" ||
                submit === "confirmed" ||
                submit === "failed") && (
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
