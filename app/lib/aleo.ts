import { WalletError } from "@provablehq/aleo-wallet-adaptor-core";
import {
  TransactionStatus,
  type TransactionOptions,
  type TransactionStatusResponse,
} from "@provablehq/aleo-types";

export const PROGRAM_ID = "veil_rails_v2.aleo";
export const RECORD_NAME = "PaymentRecord";

/**
 * Fees in microcredits. Not guessed — taken from this build's actual
 * `leo execute` dry-run output against veil_rails_v2.aleo (see TODO.md
 * Day 2-5): issue ~1,777 μcredits, private_transfer ~2,602 μcredits,
 * prove_compliance ~1,736 μcredits. Aleo charges exactly the fee you
 * specify (no refund for overestimating, confirmed by matching balance
 * deltas across every CLI call this build made), so these carry a modest
 * ~25-70% margin for proving variance rather than a large multiple.
 */
export const FEES = {
  privateTransfer: 3_500,
  proveCompliance: 2_500,
} as const;

export const EXPLORER_TX_URL = (tx: string) =>
  `https://explorer.provable.com/transaction/${tx}`;

/**
 * A record as returned by requestRecords(program, includePlaintext, statusFilter).
 *
 * Confirmed against a real Shield Wallet response (not guessed — logged and
 * inspected directly): fields live under `recordView.fields` (plain string
 * values with a type suffix, e.g. "10000u64", no `.private`/`.public`), the
 * record-pin id is `uid` (Shield's own value is prefixed "shield_..."), the
 * program name is `programName`, and there's also a `recordPlaintext`
 * string holding the raw Leo record literal
 * (`"{\n  owner: aleo1....private,\n  amount: 10000u64.private,\n  ...}"`).
 * None of this matches the shape this file originally guessed
 * (`data.amount`, `id`, `program_id`) — that guess was wrong. Kept as
 * fallbacks below in case Leo Wallet's adapter normalizes differently than
 * Shield's; `recordPlaintext` regex extraction is the last resort since
 * it's the field most likely to exist in some form across wallets.
 */
export type WalletRecord = {
  uid?: string;
  id?: string;
  programName?: string;
  program_id?: string;
  recordName?: string;
  spent?: boolean;
  recordView?: { fields?: Record<string, unknown> };
  recordPlaintext?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

function stripSuffix(value: unknown): string {
  if (typeof value !== "string") return String(value ?? "");
  // Record field values sometimes carry a visibility suffix, e.g.
  // "10000u64.private" — strip it for display/parsing.
  return value.replace(/\.(private|public)$/, "");
}

/** Best-effort extraction of the PaymentRecord.amount field for display. */
export function readRecordAmount(record: WalletRecord): number | null {
  const raw =
    record.recordView?.fields?.amount ?? record.data?.amount ?? record.amount;
  if (raw != null) {
    const cleaned = stripSuffix(raw).replace(/u64$/, "");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  const match = record.recordPlaintext?.match(/amount:\s*(\d+)u64/);
  return match ? Number(match[1]) : null;
}

/** The id used to pin this record in a `type: "record"` InputRequest. */
export function readRecordUid(record: WalletRecord): string | null {
  return record.uid ?? record.id ?? null;
}

export function isUnspentProgramRecord(record: WalletRecord): boolean {
  if (record.spent === true) return false;
  const programName = record.programName ?? record.program_id;
  if (programName && programName !== PROGRAM_ID) return false;
  return true;
}

/** Records can arrive as JSON strings or already-parsed objects. */
export function parseWalletRecord(raw: unknown): WalletRecord | null {
  if (raw == null) return null;
  if (typeof raw === "object") return raw as WalletRecord;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as WalletRecord;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Builds `private_transfer` transaction options. When `recordUid` is given
 * (the `id` field from a record returned by requestRecords), the wallet is
 * asked to supply that specific record via an `InputRequest` of
 * `type: "record"` — the SDK's documented mechanism for this, and more
 * correct than passing a manually-reconstructed record literal, since the
 * wallet resolves it from its own storage rather than trusting whatever we
 * hand it. Falls back to a raw literal string for the manual-paste path,
 * where there is no `uid` to pin.
 */
export function buildPrivateTransferTransaction(
  recordUidOrLiteral: { uid: string } | { literal: string },
  recipient: string,
  amount: number
): TransactionOptions {
  const paymentInput =
    "uid" in recordUidOrLiteral
      ? {
          type: "record" as const,
          program: PROGRAM_ID,
          recordname: RECORD_NAME,
          uid: recordUidOrLiteral.uid,
        }
      : recordUidOrLiteral.literal;

  return {
    program: PROGRAM_ID,
    function: "private_transfer",
    inputs: [paymentInput, recipient, `${amount}u64`],
    fee: FEES.privateTransfer,
    privateFee: false,
  };
}

/** Leo array-literal syntax for a `[field; 10]` argument, e.g. "[1field, 2field]". */
export function formatFieldArray(fields: string[]): string {
  return `[${fields.join(", ")}]`;
}

export function buildProveComplianceTransaction(
  counterparty: string,
  sanctions: string[]
): TransactionOptions {
  return {
    program: PROGRAM_ID,
    function: "prove_compliance",
    inputs: [counterparty, formatFieldArray(sanctions)],
    fee: FEES.proveCompliance,
    privateFee: false,
  };
}

/**
 * The same 10-entry demo sanctions list as `program/tests/test_veil.leo`,
 * literally — index 4 is BHP256::hash_to_field(MALLORY), computed once via
 * a throwaway local (non-broadcast, no fee) `leo execute` against a
 * standalone scratch program and confirmed reproducible across two runs:
 *
 *   leo execute hashcheck.aleo::get_hash <MALLORY address> --network testnet
 *   -> 562787451117413909241553807920987664327130590730001887489352292781905069503field
 *
 * Passing the real hash here (rather than an arbitrary placeholder, as the
 * earlier live testnet call in Day 4-5 used) means the on-chain demo below
 * can genuinely trap on the sanctioned example — not just simulate it.
 */
export const DEMO_SANCTIONS_LIST: string[] = [
  "1001field",
  "1002field",
  "1003field",
  "1004field",
  "562787451117413909241553807920987664327130590730001887489352292781905069503field",
  "1006field",
  "1007field",
  "1008field",
  "1009field",
  "1010field",
];

/**
 * Unlike the old @demox-labs adapter (whose docs explicitly said the polled
 * id was NOT the on-chain hash, with no documented way to get one),
 * @provablehq/aleo-types' TransactionStatusResponse.transactionId is
 * documented as "the onchain transaction ID (if already exists)" — poll
 * until the status is terminal and prefer that field for explorer links.
 */
export async function pollTransactionStatus(
  transactionStatus: (id: string) => Promise<TransactionStatusResponse>,
  transactionId: string,
  { intervalMs = 2000, maxAttempts = 30 } = {}
): Promise<TransactionStatusResponse> {
  let last: TransactionStatusResponse = { status: TransactionStatus.PENDING };
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await transactionStatus(transactionId);
    if (last.status !== TransactionStatus.PENDING) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { ...last, status: "timeout" };
}

export function isFailedStatus(status: string) {
  return status === TransactionStatus.FAILED || status === TransactionStatus.REJECTED;
}

const FRIENDLY_ERRORS: Array<[string, string]> = [
  ["WalletNotConnectedError", "Connect your wallet first."],
  ["WalletNotSelectedError", "Pick a wallet before connecting."],
  ["WalletNotReadyError", "That wallet isn't ready — check the extension is installed and unlocked."],
  ["WalletConnectionError", "The wallet declined the connection."],
  ["WalletDisconnectionError", "Couldn't disconnect cleanly from the wallet."],
  ["WalletFeatureNotAvailableError", "This wallet doesn't support that action."],
  ["WalletTransactionRejectedError", "The transaction was declined in the wallet."],
  ["WalletTransactionTimeoutError", "The wallet didn't respond in time. Try again."],
  ["WalletTransactionError", "The wallet rejected this transaction."],
  ["WalletDecryptionNotAllowedError", "This wallet connection doesn't allow decrypting records."],
  ["WalletDecryptionError", "Couldn't decrypt a record from your wallet."],
  ["WalletAddressWithheldError", "This action needs your address, which this connection withheld."],
  ["WalletSignMessageError", "The wallet couldn't sign that message."],
  ["WalletSwitchNetworkError", "The wallet couldn't switch networks."],
  ["MethodNotImplementedError", "This wallet doesn't implement that yet."],
];

export function describeWalletError(err: unknown): string {
  const name = err instanceof WalletError ? err.name : err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);

  for (const [match, friendly] of FRIENDLY_ERRORS) {
    if (name === match || message.includes(match)) return friendly;
  }
  if (/insufficient/i.test(message)) return "Insufficient balance for this transfer.";
  if (/user rejected|denied/i.test(message)) return "Request was declined in the wallet.";
  return "Something went wrong talking to your wallet. Check the browser console for details.";
}
