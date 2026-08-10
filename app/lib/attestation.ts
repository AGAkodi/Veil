/**
 * Client-side fixtures and local verification helpers for Verifiable AI Attestation.
 */

export const ALEO_ADDRESS_PATTERN = /^aleo1[a-z0-9]{58}$/;

export function isLikelyAleoAddress(address: string): boolean {
  return ALEO_ADDRESS_PATTERN.test(address.trim());
}

export type AttestationFixture = {
  input: string;
  hash: string;
  verdict: boolean;
  label: string;
  note: string;
  rationale: string; // Precomputed/cached Groq rationale
  txId?: string;
};

export const ATTESTATION_EXAMPLES: Record<string, AttestationFixture> = {
  medical: {
    input: "Patient scan analysis: benign tissue, no action required.",
    hash: "123456789field",
    verdict: true,
    label: "Medical Scan (Clean)",
    note: "Attestation submitted live on testnet — see the transaction below.",
    rationale: "No suspicious masses or malignancy indicators detected; the scanned tissue is benign.",
    txId: "at1hvnzhlp6jusps3f2k4aynmqem8umdgndg0ng98n5g6qg0s7fmugq39y85g",
  },
  security: {
    input: "Smart contract audit: SQL injection vulnerability detected at line 45.",
    hash: "987654321field",
    verdict: false,
    label: "Code Security (Vulnerable)",
    note: "Vulnerability detected. Submission rejected or marked false to alert verifiers.",
    rationale: "SQL injection vulnerability detected in database interaction at line 45, exposing the contract to database corruption.",
  },
  credit: {
    input: "Corporate credit risk evaluation: low debt ratio, stable cash flow, rating AA.",
    hash: "456789123field",
    verdict: true,
    label: "Credit Risk (Stable)",
    note: "Credit evaluation completed successfully. High reliability indicators verified.",
    rationale: "Low leverage combined with strong, predictable cash flow yields an AA creditworthiness rating.",
  },
  moderation: {
    input: "Social media content review: hate speech detected in user post #882.",
    hash: "789123456field",
    verdict: false,
    label: "Content Moderation (Flagged)",
    note: "Hate speech policy violation flagged. Review queued for moderation action.",
    rationale: "System flags hate speech violation in post content, requiring immediate moderation review.",
  },
} as const;

// Quick utility to hash a string deterministically into an Aleo field representation
export function computeSimpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  const positiveHash = Math.abs(hash);
  return `${positiveHash}field`;
}

export function checkLocalAttestation(hash: string): AttestationFixture | null {
  const trimmed = hash.trim();
  for (const key of Object.keys(ATTESTATION_EXAMPLES)) {
    const ex = ATTESTATION_EXAMPLES[key];
    if (ex.hash === trimmed || ex.hash.replace(/field$/, "") === trimmed) {
      return ex;
    }
  }
  return null;
}

export { EXPLORER_TX_URL } from "./aleo";
