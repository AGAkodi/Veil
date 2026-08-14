Veil

Privacy-preserving attestation for AI-audited decisions, built on Aleo.

An AI agent audits a sensitive input — a smart contract, a credit file, a moderation case — and commits its verdict on-chain as a cryptographic hash. Anyone can verify the verdict is genuine. No one, ever, has to see what was audited.

The problem

AI agents increasingly make consequential calls on private data: a security verdict on a contract, a risk score on an applicant, a flag on a piece of content. Once the verdict is posted, there's usually no way to check it was genuinely computed from what's claimed — trusting it means trusting the agent's word, or exposing the input to prove it.

Why Aleo

Most systems bolt privacy on after the fact — an access-control layer, a permissioned view, a promise to redact logs. That layer is exactly as strong as the code maintaining it, and it lives on a ledger that was never built to hide anything in the first place.

Aleo is private by default at the protocol level. Records are private UTXOs natively. Veil doesn't build a shielded pool or a custom cryptographic scheme — it writes a Leo program that handles private attestation records, and the privacy comes from the protocol underneath it, not from application code.

How it works: Audit → Attest → Verify

Veil is a three-stage flow, and only one of those stages happens on-chain for the party being audited — the rest is either off-chain analysis or a third party's independent check.

1. Audit (off-chain)

A visitor submits something to be evaluated — pasted code, a link, or an Aleo program ID (resolved to real deployed source, see below). An AI agent analyzes it and produces a verdict and a plain-English rationale. Nothing is on-chain at this stage. This is local computation you can run as many times as you want, on anything, for free.

2. Attest (on-chain)

Once an audit produces a verdict, it can be committed on-chain. The verdict and a commitment (hash) of the input are bound together in a private Attestation record and submitted via submit_attestation. The raw input never touches the chain — only the hash and the boolean verdict do.

This step is oracle-gated: only one known, trusted address can submit attestations, so a verifier can trust "this verdict came from the actual agent," not just "some address said so."

3. Verify (on-chain, third party)

Anyone holding or checking an attestation can call verify_attestation to confirm a claimed input hash matches what was actually attested, without ever seeing the original input. A mismatched or forged hash fails the check visibly.

Architecture
The Leo program

Deployed as veil_attest_v2.aleo.

record Attestation {
    owner: address,
    input_hash: field,
    verdict: bool,
    oracle: address,
}

submit_attestation(input_hash: field, verdict: bool) -> Attestation Oracle-gated (only the hardcoded oracle address can call this). Creates a private Attestation record binding a verdict to an input commitment. Also increments two public mappings:

mapping total_attestations: u8 => u64;  // running count, key 0u8
mapping total_flagged: u8 => u64;       // count of flagged verdicts, key 0u8

These are the only public state Veil writes. Aggregate volume is verifiable by anyone in real time — "how many attestations, how many flagged" — while every individual verdict and input stays private until its holder chooses to disclose it via verification.

verify_attestation(att: Attestation, claimed_hash: field) -> bool Checks that a held attestation's committed hash matches a claimed hash. Anyone can call this against an attestation they hold. This is a real on-chain transition, not a local/off-chain read — the check itself is verifiable, not just the record.

The oracle signing model

submit_attestation requires the caller to be one specific, hardcoded oracle address. Veil signs attestations server-side: the oracle's private key lives in a server-only environment variable, read only inside a backend API route, and is never exposed to the client. A visitor never needs to hold or connect the oracle's wallet — the agent audits and attests autonomously. The only step that requires a visitor's own connected wallet is verification, since that's a third party's independent check, not an oracle action.

(An earlier, simpler design had the connected wallet double as the oracle's wallet — see Future Work for when that might still be useful.)

The audit engine

The audit step uses two independent language models on Groq — Llama 3.3-70B and GPT-OSS-120B — run in parallel at temperature 0. Findings are only reported with confidence when both models corroborate each other; disagreement is a signal, not something silently resolved by picking one answer.

If a live call fails or times out, a small set of demo fixtures fall back to a precomputed, real (not fabricated) cached response. For any other input, a failed live call returns an explicit error — it never fabricates a "clean" verdict. An audit tool that fails safe by defaulting to "pass" is worse than one that just fails visibly, and Veil is built to do the latter.

Input modes
Paste code directly — the default, most reliable path, works offline against any cascade failure.
Aleo program ID — resolves to the program's actual deployed Leo source via Provable's explorer API before auditing, so you can audit any live program on the network by name, not just pasted text.
GitHub URL — scoped to github.com and raw.githubusercontent.com links only, with automatic blob→raw normalization, a size cap, a fetch timeout, and content-type validation to reject anything that isn't plain source.
Methodology: correcting for VM-specific false positives

Both models initially misjudged Aleo/snarkVM bytecode by applying Solidity/EVM intuitions that don't hold here. Two distinct false-positive patterns were found, root-caused, and fixed through targeted system prompt corrections — not broad rewrites — each validated against regression tests before being accepted:

Checked-arithmetic false positives. Both critics flagged missing balance checks and "reentrancy risk" on credits.aleo, Aleo's own native program. Neither applies: plain sub/add on unsigned integers is checked by default and halts the transaction on overflow/underflow (only explicit .w-suffixed instructions wrap silently), and there's no reentrancy risk since finalize blocks run atomically after the transition with no mid-execution external calls. Fixed by adding this VM semantics explicitly to the system prompt.
Positional-argument tracing failures. Both critics then flagged credits.aleo's transfer_public as allowing "unauthorized subtraction from any account." In fact, the transition calls async transfer_public self.caller r0 r1, meaning finalize's r0 is always the caller's own address, not attacker-controlled, despite being declared address.public. The models weren't tracing finalize inputs back through the transition's async call to see which ones were sender-pinned. Fixed by instructing both critics to trace positional bindings before flagging an authorization issue.

Each fix was validated against three programs to confirm it generalized rather than just fit the case that motivated it:

Program	Before fix	After fix
credits.aleo (real, deployed)	False positive (balance checks, reentrancy, then unauthorized transfer)	Correctly clean
vulnerable_vault.leo (planted bug — missing self.caller == target check in withdraw)	Correctly flagged	Still correctly flagged (regression check)
veil_attest_v2.aleo (this project's own contract)	—	Correctly clean, verdict reasoning correctly cites the oracle gate as the security mechanism

Known limitation: unlike Solidity-focused tools, there is no static analysis backstop for Leo — no Slither or Aderyn equivalent exists yet. Every verdict here is LLM reasoning, validated against a small set of real test cases, not formally verified. This is stated plainly rather than implied away.

Two roles
The oracle audits and attests. This is a single trusted agent identity — one hardcoded address, signing server-side.
Anyone can verify. Verification requires no special permission, no oracle access — just a connected wallet and a claimed hash to check against a held attestation.
Environment setup
Variable	Where used	Notes
ORACLE_PRIVATE_KEY	Server-only, inside the attest API route	Never NEXT_PUBLIC_-prefixed, never sent to the client, never logged
GROQ_API_KEY	Server-only, inside the audit API route	Used for both live critic calls
NEXT_PUBLIC_ORACLE_ADDRESS	Client-side, display only	Safe to expose — it's the same address already hardcoded as a public constant in main.leo
NEXT_PUBLIC_ALEO_ENDPOINT	Client + server	Aleo/Provable API base URL; defaults to https://api.explorer.provable.com/v1 if unset

.env is gitignored; .env.example documents each variable as a placeholder only.

Status

Honest state as of the latest build pass — not everything below has been independently re-verified after every subsequent change, and this table should be updated before submission, not assumed accurate from memory:

Piece	Status
submit_attestation on testnet	Verified — real confirmed transactions, explorer-checked
Server-side oracle signing	Verified working — confirmed transaction IDs observed
Audit engine (paste)	Verified — live two-critic cascade, false positives found and fixed, validated against 3 programs
Program ID resolution	Verified — tested against credits.aleo, real 13KB+ source resolved live
GitHub URL resolution	Built and hardened (timeout, size cap, content-type check), not yet demo-tested against a real external link
verify_attestation	Built, unaffected by later changes in design — needs one more end-to-end regression check after all recent audit/attest changes
Public stats strip (total_attestations/total_flagged)	Built — confirm trigger point still fires correctly after the two-step flow changes
"Not yet on-chain" label bug	Was identified as showing a stale state after confirmed attestations — confirm this was fixed, not assumed
Testing verification yourself

The "Disclosure Rights Holder (Owner Address)" field on /attest defaults to the oracle's own address. If you attest with that default left in place, only the oracle's wallet will ever be able to see or verify that record — this isn't a bug, it's the same privacy mechanism working correctly. An attestation record is only visible to whichever address is set as its owner; nobody else can see or verify it unless that owner discloses it.

To test verification as a wallet other than the oracle's:

On /attest, before submitting, clear the owner field and enter your own wallet address instead of the oracle's default.
Run the audit and attest as normal — the resulting record will be owned by your address, not the oracle's.
On /verify, connect that same wallet — the attestation should now appear as one you hold.
To demonstrate real third-party disclosure (the intended use case): copy that record's raw plaintext and hand it to a different wallet. That second wallet can verify it via "Paste record plaintext manually," with no oracle involvement at all — proving the verdict is genuine without ever needing to be, or trust, the oracle directly.
Who this is for

Compliance vendors, AI infrastructure providers, and DAOs needing auditable moderation are the natural early users of a primitive like this — anywhere a verdict needs to be trusted by a third party without that party (or the public chain) ever seeing the underlying data. The oracle-gated attestation model is meant to be a primitive other builders plug into, not a closed application.

Future work
Attestation revocation — would need a status mapping and a check inside verify_attestation.
Multi-oracle support — a registry of trusted addresses instead of one hardcoded constant, so more than one agent identity can attest.
Per-oracle aggregate stats — breaking down total_attestations / total_flagged by oracle once multi-oracle support exists.
Broader URL support — beyond GitHub-only, with the same hardening (timeout, size cap, content-type validation) extended to other hosts.
A real secrets manager for the oracle key, instead of a plain server-side environment variable — acceptable for a hackathon submission, not for production.
Wallet-based oracle signing (Option A) as a fallback path, in case server-side signing ever needs a simpler, dependency-free alternative.
Static analysis tooling for Leo, if/when an equivalent to Slither/Aderyn exists for this VM — to give audits a backstop beyond LLM reasoning alone.
Wider audit engine validation — more real deployed programs, including ones exercising record-consuming transitions, to further confirm the VM-semantics prompt fixes generalize.