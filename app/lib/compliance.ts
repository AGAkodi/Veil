/**
 * Client-side approximation of `prove_compliance`, for UI states before the
 * SDK is wired (Day 7). The real transition takes the sanctions list as a
 * public per-call input rather than a stored on-chain registry — there is no
 * single canonical list to fetch. The addresses below mirror the fixture
 * used by `program/tests/test_veil.leo`, so the pass/fail behavior here
 * matches what the deployed program actually enforces.
 */

export const ALEO_ADDRESS_PATTERN = /^aleo1[a-z0-9]{58}$/;

export function isLikelyAleoAddress(address: string): boolean {
  return ALEO_ADDRESS_PATTERN.test(address.trim());
}

export const COMPLIANCE_EXAMPLES = {
  clean: {
    address: "aleo1ljrj22m4v66e4s7ch89vnt5hfycy4rewkcgyjwl0xhsx37l73gfqxujvw7",
    label: "Clean address",
    note: "Checked live on testnet — see the transaction below.",
  },
  sanctioned: {
    address: "aleo1clffv46hyee4hk2nk06umudxdpmm4m8xrl0r0nlvks7fgtmp5sysgtrmr2",
    label: "Sanctioned address",
    note: "The MALLORY fixture from the program's test suite.",
  },
} as const;

const SANCTIONED = new Set<string>([COMPLIANCE_EXAMPLES.sanctioned.address]);

export type ComplianceResult = "clean" | "sanctioned";

export function checkCompliance(address: string): ComplianceResult {
  return SANCTIONED.has(address.trim()) ? "sanctioned" : "clean";
}

/** The real, on-chain execution of `prove_compliance` this build produced. */
export const LIVE_COMPLIANCE_TX =
  "at10680fn07k6rv4t8qxtfnwgxttazl8n0pd3emx9f9w94gjz6wfszsjd7spu";

export { EXPLORER_TX_URL } from "./aleo";
