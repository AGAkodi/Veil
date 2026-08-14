"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner } from "../../components/Spinner";
import {
  ATTESTATION_EXAMPLES,
} from "../../lib/attestation";
import {
  EXPLORER_TX_URL,
  PROGRAM_ID,
  buildVerifyAttestationTransaction,
  describeWalletError,
  isFailedStatus,
  parseWalletRecord,
  pollTransactionStatus,
  readRecordInputHash,
  readRecordVerdict,
  readRecordUid,
  type WalletRecord,
} from "../../lib/aleo";
import { useWallet } from "../../lib/wallet-context";

type SubmitState =
  | "idle"
  | "building"
  | "broadcasting"
  | "confirmed"
  | "failed"
  | "demo-done";

export default function VerifyPage() {
  const {
    status,
    isDemo,
    requestRecords,
    executeTransaction,
    transactionStatus,
  } = useWallet();

  const [claimedHash, setClaimedHash] = useState("");
  const [records, setRecords] = useState<
    { parsed: WalletRecord; hash: string | null; verdict: boolean | null }[] | null
  >(null);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [manualRecord, setManualRecord] = useState("");
  const [useManualRecord, setUseManualRecord] = useState(false);

  const [submit, setSubmit] = useState<SubmitState>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [tempTransactionId, setTempTransactionId] = useState<string | null>(null);
  const [onchainTransactionId, setOnchainTransactionId] = useState<string | null>(null);
  const [finalStatus, setFinalStatus] = useState<string | null>(null);

  // Local verification result simulation (before transaction or in demo mode)
  const [verificationResult, setVerificationResult] = useState<"idle" | "matched" | "mismatched">("idle");

  // Fetch the connected wallet's unspent Attestation records for this program.
  useEffect(() => {
    if (isDemo || !requestRecords || status !== "connected") return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setRecordsLoading(true);
      setRecordsError(null);
    });

    requestRecords(PROGRAM_ID, true, "unspent")
      .then((raw) => {
        if (cancelled) return;
        const parsed = raw
          .map((r) => parseWalletRecord(r))
          .filter((r): r is WalletRecord => r !== null)
          .map((r) => ({
            parsed: r,
            hash: readRecordInputHash(r),
            verdict: readRecordVerdict(r),
          }));
        setRecords(parsed);
        setSelectedIndex(0);
        if (parsed.length > 0 && parsed[0].hash) {
          setClaimedHash(parsed[0].hash);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setRecordsError(describeWalletError(err));
        setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setRecordsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDemo, requestRecords, status]);

  const selectedRecord =
    records && records.length > 0 ? records[selectedIndex] : null;

  const selectedRecordUid = selectedRecord ? readRecordUid(selectedRecord.parsed) : null;

  const hasRecordInput = isDemo
    ? true
    : useManualRecord
      ? manualRecord.trim() !== ""
      : selectedRecordUid !== null;

  const hashValid = claimedHash.trim().length > 0;

  const canSubmit =
    status === "connected" &&
    hashValid &&
    hasRecordInput &&
    submit === "idle";

  function handleCheckLocal() {
    if (!hashValid) return;
    const finalHash = claimedHash.trim();

    let targetHash: string | null = null;

    if (isDemo) {
      // Demo uses the medical scan hash by default
      targetHash = ATTESTATION_EXAMPLES.medical.hash;
    } else if (useManualRecord) {
      try {
        const parsed = JSON.parse(manualRecord);
        const rawHash = parsed.input_hash ?? parsed.fields?.input_hash;
        targetHash = rawHash ? String(rawHash).replace(/\.(private|public)$/, "") : null;
      } catch {
        targetHash = null;
      }
    } else if (selectedRecord) {
      targetHash = selectedRecord.hash;
    }

    if (!targetHash) {
      setVerificationResult("mismatched");
      return;
    }

    const cleanTarget = targetHash.replace(/field$/, "");
    const cleanClaimed = finalHash.replace(/field$/, "");

    if (cleanTarget === cleanClaimed) {
      setVerificationResult("matched");
    } else {
      setVerificationResult("mismatched");
    }
  }

  const isRealTxId = (id: string | null) => !!id && id.startsWith("at1");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);

    // Compute local verdict state first
    handleCheckLocal();

    if (isDemo || !executeTransaction || !transactionStatus) {
      setSubmit("building");
      window.setTimeout(() => setSubmit("demo-done"), 1100);
      return;
    }

    try {
      setSubmit("building");
      const recordInput = useManualRecord
        ? { literal: manualRecord }
        : { uid: selectedRecordUid! };

      const tx = buildVerifyAttestationTransaction(recordInput, claimedHash.trim());

      setSubmit("broadcasting");
      console.log("[Verify] Initiating wallet executeTransaction with tx parameters:", tx);
      const result = await executeTransaction(tx);
      console.log("[Verify] executeTransaction raw result response:", result);
      const tempId = result?.transactionId ?? null;
      setTempTransactionId(tempId);
      if (!tempId) throw new Error("Wallet did not return a transaction id.");

      console.log("[Verify] Starting transaction status polling for request ref ID:", tempId);
      const polled = await pollTransactionStatus(transactionStatus, tempId);
      console.log("[Verify] pollTransactionStatus raw result response:", polled);
      setFinalStatus(polled.status);
      setOnchainTransactionId(polled.transactionId ?? null);
      
      const failed = isFailedStatus(polled.status);
      console.log("[Verify] Final transaction execution check:", { status: polled.status, failed });
      setSubmit(failed ? "failed" : "confirmed");
    } catch (err) {
      console.error("[Verify] Transaction execution failed with error:", err);
      setSubmitError(describeWalletError(err));
      setSubmit("idle");
    }
  }

  function reset() {
    setClaimedHash("");
    setSubmit("idle");
    setSubmitError(null);
    setTempTransactionId(null);
    setOnchainTransactionId(null);
    setFinalStatus(null);
    setVerificationResult("idle");
  }

  if (status !== "connected") {
    return (
      <div className="max-w-lg border border-rule bg-paper px-7 py-8">
        <p className="display text-[1.375rem]">Connect your wallet first</p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          Verifying an attestation record requires a connected wallet.
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
      <div className="mb-6">
        <img src="/logo.png" alt="Veil Logo" className="w-12 h-12 object-contain" />
      </div>
      <p className="eyebrow">Auditor Console</p>
      <h1 className="display mt-5 max-w-lg text-[2.25rem] sm:text-[2.875rem]">
        Audit a committed <span className="display-accent">verdict.</span>
      </h1>
      <p className="prose-body mt-6 max-w-lg text-[0.9375rem] leading-relaxed">
        Public auditor console. Verify that a private attestation record binds a specific claimed input commitment, confirming the verdict without exposing the raw off-chain input data.
      </p>

      {!isDemo && (
        <div className="mt-6 max-w-lg border border-rule bg-paper px-5 py-4">
          <p className="field-label mb-2">Select Attestation Record</p>
          {recordsLoading && (
            <span className="inline-flex items-center gap-2 text-[0.8125rem] text-ink-soft">
              <Spinner /> Reading records from your wallet…
            </span>
          )}
          {!recordsLoading && recordsError && (
            <p className="text-[0.8125rem] text-accent">{recordsError}</p>
          )}
          {!recordsLoading && !recordsError && records && records.length === 0 && (
            <p className="text-[0.8125rem] leading-relaxed text-ink-soft">
              No attestation records found for <code>{PROGRAM_ID}</code> in your wallet.
              Submit an attestation first to receive one.
            </p>
          )}
          {!recordsLoading && records && records.length > 0 && !useManualRecord && (
            <div className="space-y-2">
              {records.map((r, i) => (
                <label
                  key={readRecordUid(r.parsed) ?? i}
                  className="flex items-start gap-3 text-[0.8125rem]"
                >
                  <input
                    type="radio"
                    name="record"
                    checked={selectedIndex === i}
                    onChange={() => {
                      setSelectedIndex(i);
                      if (r.hash) {
                        setClaimedHash(r.hash);
                      }
                    }}
                    className="mt-0.5"
                  />
                  <div className="field-mono">
                    <p className="font-semibold text-ink">
                      Record {i + 1} ({r.verdict === true ? "Pass/Clean" : r.verdict === false ? "Fail/Vulnerable" : "Verdict Unknown"})
                    </p>
                    <p className="text-xs text-ink-soft">
                      commitment: {r.hash || "unknown"}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setUseManualRecord((v) => {
                const nextVal = !v;
                if (!nextVal && records && records[selectedIndex]) {
                  setClaimedHash(records[selectedIndex].hash || "");
                }
                return nextVal;
              });
            }}
            className="mt-3 text-[0.75rem] font-semibold text-ink-soft hover:text-ink"
          >
            {useManualRecord ? "Use wallet records instead" : "Paste record plaintext manually"}
          </button>
          {useManualRecord && (
            <textarea
              className="field field-mono mt-3"
              rows={3}
              placeholder='{"owner": "...", "input_hash": "...", "verdict": "true", ...}'
              value={manualRecord}
              onChange={(e) => setManualRecord(e.target.value)}
            />
          )}
        </div>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="field-label" htmlFor="claimed-hash">
              Claimed Input Commitment Hash
            </label>
            <input
              id="claimed-hash"
              className="field field-mono"
              placeholder="e.g. 123456789field"
              value={claimedHash}
              onChange={(e) => setClaimedHash(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.75rem]">
              <button
                type="button"
                className="font-semibold text-ink-soft hover:text-ink"
                onClick={() => setClaimedHash(ATTESTATION_EXAMPLES.medical.hash)}
              >
                Try the medical scan hash
              </button>
              <button
                type="button"
                className="font-semibold text-ink-soft hover:text-ink"
                onClick={() => setClaimedHash(ATTESTATION_EXAMPLES.security.hash)}
              >
                Try the security audit hash
              </button>
              <button
                type="button"
                className="font-semibold text-ink-soft hover:text-ink"
                onClick={() => setClaimedHash(ATTESTATION_EXAMPLES.credit.hash)}
              >
                Try the credit risk hash
              </button>
              <button
                type="button"
                className="font-semibold text-ink-soft hover:text-ink"
                onClick={() => setClaimedHash(ATTESTATION_EXAMPLES.moderation.hash)}
              >
                Try the content moderation hash
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
                : "Verify Attestation"}
          </button>
          {submitError && (
            <p className="text-[0.8125rem] text-accent">{submitError}</p>
          )}
        </form>

        <aside className="space-y-6">
          <div className="border border-rule bg-paper px-6 py-5">
            <p className="field-label mb-3">Verification Result (Local)</p>
            {verificationResult === "idle" && (
              <span className="pill pill-neutral">Enter a hash to verify</span>
            )}
            {verificationResult === "matched" && (
              <div>
                <span className="pill pill-ok">Valid Match</span>
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
                  The claimed hash matches the commitment in the attestation record. The agent verdict is verified as bound to this input.
                </p>
              </div>
            )}
            {verificationResult === "mismatched" && (
              <div>
                <span className="pill pill-blocked">Mismatch / Forged Hash</span>
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
                  The claimed hash does NOT match the commitment in the attestation. The verification failed.
                </p>
              </div>
            )}
          </div>

          {submit !== "idle" && (
            <div className="border border-rule bg-paper px-6 py-5">
              <p className="field-label mb-3">On-chain transaction</p>
              <ol className="space-y-3 text-[0.8125rem]">
                <li className="flex items-center gap-2 text-ink">
                  <span className="dot dot-ok" />
                  Local comparison complete ({verificationResult === "matched" ? "Matched" : "Mismatched"})
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
                      Not broadcast — no real wallet connected in demo mode. Connect a real wallet to submit this verification on-chain.
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
                          {isRealTxId(tempTransactionId) ? "Wallet transaction id: " : "Wallet request reference: "}
                          <span className="field-mono text-xs">{tempTransactionId}</span>
                          . Still waiting on the on-chain id to finalize.
                        </>
                      )}
                    </span>
                  )}
                  {submit === "failed" && (
                    <span>
                      The wallet reported this execution failed
                      {finalStatus && ` (${finalStatus})`}.
                      This is expected if the transaction was rejected or encountered network/provider errors.
                    </span>
                  )}
                </li>
              </ol>
              {verificationResult === "mismatched" && (
                <div className="mt-4 text-xs text-ink-soft border border-rule bg-cream/40 p-2.5">
                  <p className="font-semibold text-accent">Mismatch / Forged Hash Scenario</p>
                  <p className="mt-1 leading-relaxed">
                    Submitting this verification on-chain is permitted. Under the Leo contract design, a mismatch does not cause a transaction abort; instead, the transaction executes successfully on-chain and outputs a public matches verdict of <code>false</code>.
                  </p>
                </div>
              )}
              {(submit === "demo-done" ||
                submit === "confirmed" ||
                submit === "failed") && (
                <button
                  type="button"
                  onClick={reset}
                  className="mt-5 text-[0.8125rem] font-semibold text-ink underline-offset-4 hover:underline"
                >
                  Verify another hash
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
