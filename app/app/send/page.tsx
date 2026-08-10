"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Spinner } from "../../components/Spinner";
import {
  COMPLIANCE_EXAMPLES,
  checkCompliance,
  isLikelyAleoAddress,
} from "../../lib/compliance";
import {
  EXPLORER_TX_URL,
  PROGRAM_ID,
  buildPrivateTransferTransaction,
  describeWalletError,
  isFailedStatus,
  parseWalletRecord,
  pollTransactionStatus,
  readRecordAmount,
  readRecordUid,
  type WalletRecord,
} from "../../lib/aleo";
import { useWallet } from "../../lib/wallet-context";

/**
 * Mirrors the 10,000-credit PaymentRecord this build actually issued to the
 * deploy account on testnet (see README) — used only in demo mode, where
 * there's no real wallet to fetch a real record from.
 */
const DEMO_BALANCE = 10_000;

type ComplianceState = "idle" | "checking" | "clean" | "blocked";
type SubmitState =
  | "idle"
  | "building"
  | "broadcasting"
  | "confirmed"
  | "failed"
  | "demo-done";

export default function SendPage() {
  const {
    status,
    isDemo,
    requestRecords,
    executeTransaction,
    transactionStatus,
  } = useWallet();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [resolved, setResolved] = useState<{
    address: string;
    value: "clean" | "blocked";
  } | null>(null);

  const [records, setRecords] = useState<
    { parsed: WalletRecord; amount: number | null }[] | null
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

  // Fetch the connected wallet's unspent PaymentRecord(s) for this program.
  // Demo mode has no real wallet to ask, so this only runs for a real
  // connection. `statusFilter: "unspent"` does the filtering wallet-side —
  // no need to reimplement it client-side.
  useEffect(() => {
    if (isDemo || !requestRecords || status !== "connected") return;

    let cancelled = false;
    // queueMicrotask, not a synchronous setState in the effect body — the
    // fetch below is the actual async work; these two just signal that it
    // started.
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
          .map((r) => ({ parsed: r, amount: readRecordAmount(r) }));
        setRecords(parsed);
        setSelectedIndex(0);
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

  const recipientValid = isLikelyAleoAddress(recipient);
  const compliance: ComplianceState = !recipientValid
    ? "idle"
    : resolved && resolved.address === recipient
      ? resolved.value
      : "checking";

  // Only ever sets state inside the (async) timeout callback below, never
  // synchronously in the effect body — this is a debounce, not a render-time
  // derivation, so it belongs in an effect.
  useEffect(() => {
    if (!recipientValid) return;
    const t = window.setTimeout(() => {
      setResolved({
        address: recipient,
        value: checkCompliance(recipient) === "clean" ? "clean" : "blocked",
      });
    }, 550);
    return () => window.clearTimeout(t);
  }, [recipient, recipientValid]);

  const selectedRecord =
    records && records.length > 0 ? records[selectedIndex] : null;
  const availableBalance = isDemo
    ? DEMO_BALANCE
    : useManualRecord
      ? null
      : (selectedRecord?.amount ?? null);

  const amountValue = Number(amount);
  const amountValid =
    amount.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0;
  const withinBalance =
    amountValid && (availableBalance === null || amountValue <= availableBalance);

  const selectedRecordUid = selectedRecord ? readRecordUid(selectedRecord.parsed) : null;
  const hasSpendableInput = isDemo
    ? true
    : useManualRecord
      ? manualRecord.trim() !== ""
      : selectedRecordUid !== null;

  const canSubmit =
    status === "connected" &&
    compliance === "clean" &&
    amountValid &&
    withinBalance &&
    hasSpendableInput &&
    submit === "idle";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError(null);

    if (isDemo || !executeTransaction || !transactionStatus) {
      // No real wallet backing this session — keep the honest simulated
      // flow rather than fabricate a transaction hash.
      setSubmit("building");
      window.setTimeout(() => setSubmit("demo-done"), 1100);
      return;
    }

    try {
      setSubmit("building");
      const recordInput = useManualRecord
        ? { literal: manualRecord }
        : { uid: selectedRecordUid! };

      const tx = buildPrivateTransferTransaction(recordInput, recipient, amountValue);

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
    setRecipient("");
    setAmount("");
    setMemo("");
    setResolved(null);
    setSubmit("idle");
    setSubmitError(null);
    setTempTransactionId(null);
    setOnchainTransactionId(null);
    setFinalStatus(null);
    setUseManualRecord(false);
    setManualRecord("");
  }

  if (status !== "connected") {
    return (
      <div className="max-w-lg border border-rule bg-paper px-7 py-8">
        <p className="display text-[1.375rem]">Connect your wallet first</p>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-soft">
          Sending a payment needs a connected wallet to hold the record being
          spent.
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
        Send a <span className="display-accent">private</span> payment.
      </h1>
      <p className="prose-body mt-6 max-w-lg text-[0.9375rem] leading-relaxed">
        Amount, sender, and recipient never become public ledger rows. The
        recipient is screened locally before you submit — the same check{" "}
        <code>prove_compliance</code> enforces on-chain as its own transition
        (see the Compliance screen).
      </p>

      {!isDemo && (
        <div className="mt-6 max-w-lg border border-rule bg-paper px-5 py-4">
          <p className="field-label mb-2">Spendable record</p>
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
              No spendable record found for <code>{PROGRAM_ID}</code> in your
              wallet. This demo program has no faucet — an existing holder
              needs to run <code>issue</code> to your address first.
            </p>
          )}
          {!recordsLoading && records && records.length > 0 && !useManualRecord && (
            <div className="space-y-2">
              {records.map((r, i) => (
                <label
                  key={readRecordUid(r.parsed) ?? i}
                  className="flex items-center gap-3 text-[0.8125rem]"
                >
                  <input
                    type="radio"
                    name="record"
                    checked={selectedIndex === i}
                    onChange={() => setSelectedIndex(i)}
                  />
                  <span className="field-mono">
                    {r.amount !== null
                      ? `${r.amount.toLocaleString()} credits`
                      : "amount unknown"}
                  </span>
                </label>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setUseManualRecord((v) => !v)}
            className="mt-3 text-[0.75rem] font-semibold text-ink-soft hover:text-ink"
          >
            {useManualRecord ? "Use a record from my wallet instead" : "Paste a record manually instead"}
          </button>
          {useManualRecord && (
            <textarea
              className="field field-mono mt-3"
              rows={3}
              placeholder='{"owner": "...", "amount": "10000u64", ...}'
              value={manualRecord}
              onChange={(e) => setManualRecord(e.target.value)}
            />
          )}
        </div>
      )}

      <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-16">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="field-label" htmlFor="recipient">
              Recipient address
            </label>
            <input
              id="recipient"
              className="field field-mono"
              placeholder="aleo1…"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <div className="mt-2 flex gap-4 text-[0.75rem]">
              <button
                type="button"
                className="font-semibold text-ink-soft hover:text-ink"
                onClick={() => setRecipient(COMPLIANCE_EXAMPLES.clean.address)}
              >
                Use clean example
              </button>
              <button
                type="button"
                className="font-semibold text-ink-soft hover:text-ink"
                onClick={() => setRecipient(COMPLIANCE_EXAMPLES.sanctioned.address)}
              >
                Use sanctioned example
              </button>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="amount">
              Amount (credits)
            </label>
            <input
              id="amount"
              className="field field-mono"
              placeholder="0.000000"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-2 text-[0.75rem] text-ink-soft">
              {availableBalance !== null
                ? `Available: ${availableBalance.toLocaleString()} credits`
                : "Available: unknown until a record is selected"}
              {amountValid && !withinBalance && (
                <span className="text-accent"> — exceeds available balance</span>
              )}
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="memo">
              Memo (optional)
            </label>
            <input
              id="memo"
              className="field"
              placeholder="Invoice reference, note…"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
            />
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
                : "Send privately"}
          </button>
          {submitError && (
            <p className="text-[0.8125rem] text-accent">{submitError}</p>
          )}
        </form>

        <aside className="space-y-6">
          <div className="border border-rule bg-paper px-6 py-5">
            <p className="field-label mb-3">Compliance check (local)</p>
            {compliance === "idle" && (
              <span className="pill pill-neutral">Enter a recipient</span>
            )}
            {compliance === "checking" && (
              <span className="inline-flex items-center gap-2 text-[0.8125rem] text-ink-soft">
                <Spinner /> Screening against the sanctions list…
              </span>
            )}
            {compliance === "clean" && (
              <>
                <span className="pill pill-ok">Clear — not on the sanctions list</span>
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
                  A fast local check, not a proof. The on-chain{" "}
                  <code>prove_compliance</code> transition is a separate call —
                  see the Compliance screen to run it for real.
                </p>
              </>
            )}
            {compliance === "blocked" && (
              <>
                <span className="pill pill-blocked">Blocked — on the sanctions list</span>
                <p className="mt-3 text-[0.8125rem] leading-relaxed text-ink-soft">
                  Submit stays disabled. Run the real{" "}
                  <code>prove_compliance</code> transition on the Compliance
                  screen to see the same address rejected on-chain.
                </p>
              </>
            )}
          </div>

          {submit !== "idle" && (
            <div className="border border-rule bg-paper px-6 py-5">
              <p className="field-label mb-3">Transaction status</p>
              <ol className="space-y-3 text-[0.8125rem]">
                <li className="flex items-center gap-2 text-ink">
                  <span className="dot dot-ok" />
                  Compliance check passed
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
                      Connect Shield or Leo Wallet to actually submit this
                      transfer.
                    </span>
                  )}
                  {submit === "broadcasting" && "Waiting on the wallet…"}
                  {submit === "confirmed" && (
                    <span>
                      Submitted{finalStatus && ` (${finalStatus})`}.{" "}
                      {onchainTransactionId ? (
                        <>
                          On-chain id:{" "}
                          <span className="field-mono">{onchainTransactionId}</span>
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
                          <span className="field-mono">{tempTransactionId}</span>
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
                  Start another payment
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
