import { WalletError } from "@provablehq/aleo-wallet-adaptor-core";
import {
  TransactionStatus,
  type TransactionOptions,
  type TransactionStatusResponse,
} from "@provablehq/aleo-types";

export const PROGRAM_ID = "veil_attest_v2.aleo";
export const RECORD_NAME = "Attestation";

/**
 * Fees in microcredits. Based on the actual deployment costs and execution cost limits.
 */
export const FEES = {
  submitAttestation: 3_500,
  verifyAttestation: 2_500,
} as const;

export const EXPLORER_TX_URL = (tx: string) =>
  `https://explorer.provable.com/transaction/${tx}`;

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
  return value.replace(/\.(private|public)$/, "");
}

/** Best-effort extraction of the Attestation.verdict field for display. */
export function readRecordVerdict(record: WalletRecord): boolean | null {
  const raw =
    record.recordView?.fields?.verdict ?? record.data?.verdict ?? record.verdict;
  if (raw != null) {
    const cleaned = stripSuffix(raw);
    if (cleaned === "true") return true;
    if (cleaned === "false") return false;
  }
  const match = record.recordPlaintext?.match(/verdict:\s*(true|false)/);
  return match ? match[1] === "true" : null;
}

/** Best-effort extraction of the Attestation.input_hash field for display. */
export function readRecordInputHash(record: WalletRecord): string | null {
  const raw =
    record.recordView?.fields?.input_hash ?? record.data?.input_hash ?? record.input_hash;
  if (raw != null) {
    return stripSuffix(raw);
  }
  const match = record.recordPlaintext?.match(/input_hash:\s*([0-9a-zA-Z_]+field)/);
  return match ? match[1] : null;
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

export function buildSubmitAttestationTransaction(
  owner: string,
  inputHash: string,
  verdict: boolean
): TransactionOptions {
  const inputHashField = inputHash.endsWith("field") ? inputHash : `${inputHash}field`;
  return {
    program: PROGRAM_ID,
    function: "submit_attestation",
    inputs: [owner, inputHashField, `${verdict}`],
    fee: FEES.submitAttestation,
    privateFee: false,
  };
}

export function buildVerifyAttestationTransaction(
  recordUidOrLiteral: { uid: string } | { literal: string },
  claimedHash: string
): TransactionOptions {
  const attestationInput =
    "uid" in recordUidOrLiteral
      ? {
          type: "record" as const,
          program: PROGRAM_ID,
          recordname: RECORD_NAME,
          uid: recordUidOrLiteral.uid,
        }
      : recordUidOrLiteral.literal;

  const claimedHashField = claimedHash.endsWith("field") ? claimedHash : `${claimedHash}field`;

  return {
    program: PROGRAM_ID,
    function: "verify_attestation",
    inputs: [attestationInput, claimedHashField],
    fee: FEES.verifyAttestation,
    privateFee: false,
  };
}

export async function pollTransactionStatus(
  transactionStatus: (id: string) => Promise<TransactionStatusResponse>,
  transactionId: string,
  { intervalMs = 2000, maxAttempts = 30 } = {}
): Promise<TransactionStatusResponse> {
  let last: TransactionStatusResponse = { status: TransactionStatus.PENDING };
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    last = await transactionStatus(transactionId);
    const currentStatus = String(last.status || "").toLowerCase();
    if (currentStatus !== "pending") return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { ...last, status: "timeout" };
}

export function isFailedStatus(status: string) {
  const s = String(status || "").toLowerCase();
  return (
    s === "failed" ||
    s === "rejected" ||
    status === TransactionStatus.FAILED ||
    status === TransactionStatus.REJECTED
  );
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
  if (/insufficient/i.test(message)) return "Insufficient balance for this transaction.";
  if (/user rejected|denied/i.test(message)) return "Request was declined in the wallet.";
  return "Something went wrong talking to your wallet. Check the browser console for details.";
}

export async function fetchMappingValue(mappingName: string, key: string): Promise<number> {
  const endpoint = process.env.NEXT_PUBLIC_ALEO_ENDPOINT || "https://api.explorer.provable.com/v1";
  const programId = process.env.NEXT_PUBLIC_PROGRAM_ID || "veil_attest_v2.aleo";
  const url = `${endpoint}/testnet/program/${programId}/mapping/${mappingName}/${key}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const val = await res.json();
    if (val === null || val === undefined) return 0;
    // Aleo mapping values are returned as plain JSON strings with suffixes, e.g. "12u64" or "0u64"
    const cleaned = String(val).replace(/u64$/, "");
    const parsed = parseInt(cleaned, 10);
    return isNaN(parsed) ? 0 : parsed;
  } catch {
    return 0;
  }
}

/**
 * Fetches the raw Leo source code for a deployed program from the Aleo network.
 */
export async function fetchProgramSource(programId: string): Promise<string> {
  const normalized = programId.trim().toLowerCase();
  if (!normalized) {
    throw new Error("Program ID is empty");
  }
  const fullProgramId = normalized.endsWith(".aleo") ? normalized : `${normalized}.aleo`;
  
  // Use endpoint from environment or fallback
  const endpoint = process.env.NEXT_PUBLIC_ALEO_ENDPOINT || "https://api.explorer.provable.com/v1";
  const url = `${endpoint}/testnet/program/${fullProgramId}`;
  
  const res = await fetch(url);
  if (res.status === 404) {
    throw new Error("Program not found");
  }
  if (!res.ok) {
    throw new Error(`Explorer API error (HTTP ${res.status})`);
  }
  
  const json = await res.json();
  if (typeof json !== "string") {
    throw new Error("Invalid program source format received from API");
  }
  return json;
}

