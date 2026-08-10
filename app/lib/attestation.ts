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
  txId?: string;
};

export const ATTESTATION_EXAMPLES: Record<string, AttestationFixture> = {
  medical: {
    input: "Patient scan analysis: benign tissue, no action required.",
    hash: "123456789field",
    verdict: true,
    label: "Medical Scan (Clean)",
    note: "Attestation submitted live on testnet — see the transaction below.",
    txId: "at1e6f70lxs346380z5gvducj925rq76kzxdcelwq94tjw0hmcysvys4wl0ea",
  },
  security: {
    input: "Smart contract audit: SQL injection vulnerability detected at line 45.",
    hash: "987654321field",
    verdict: false,
    label: "Code Security (Vulnerable)",
    note: "Vulnerability detected. Submission rejected or marked false to alert verifiers.",
  },
} as const;

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
