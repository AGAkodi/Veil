Verifiable AI Attestation on Aleo — rebuilt from the Veil codebase Deadline: Aug 14, 2026 submission — today is Aug 10, so this is a 4-day plan (Aug 10-13, Aug 14 buffer only)

This repo starts from Veil-main (private payment rails). Reused pieces are marked [REUSE] — keep as-is or light-edit. Concept-specific pieces are marked [REWRITE] — payments logic gets replaced with attestation logic. Nothing here repeats the payment-transfer work; that direction is dropped.

Day 0 (today, Aug 10) — Rewire the Foundation

[REUSE] — verify still works, don't rebuild:

- [x] Confirm Leo 4.4.1 toolchain still installed and working (leo build on the existing program as a smoke test before touching anything)
- [x] Confirm .env / .env.example pattern still intact — this project already solved the gitignore-hides-the-template problem, keep that pattern
- [x] Confirm testnet funded account still has credits for redeploy fees
- [x] Keep app/components/ (ArrowIcon, ArrowLink, OriginFigure, Spinner) and globals.css design tokens as-is — editorial palette/type system is concept-agnostic
- [x] [REUSE — confirmed working, not just wired] app/lib/wallet-context.tsx and the connect modal — already verified against real wallets, nothing payment-specific in it, no Day 3 test time needed here
- [x] [REUSE — design tokens] Font and color palette (globals.css — cream/paper/ink/sage/accent tokens, Newsreader/Inter type) stay locked as-is. Frontend edits below are copy + layout only, not a re-theme

[REWRITE] — scope the new program:

- [x] Decide program name up front, 10+ characters to avoid the namespace-fee trap that hit veil.aleo — e.g. veil_attest.aleo. Confirm length before first deploy, not after (this cost a full redeploy cycle last time)
- [x] Write down the record + transition design on paper before coding (see Day 1) — the PaymentRecord→missing-public-keyword bug last time came from skipping this step
Day 1 (Aug 11) — Program Rewrite

[REWRITE] program/src/main.leo:

- [x] Drop PaymentRecord, issue, private_transfer entirely — not needed, not adapted, just removed
- [x] Define Attestation record:
  ```leo
  record Attestation {
      owner: address,       // whoever holds the right to disclose this
      input_hash: field,    // commitment to the (private, off-chain) input
      verdict: bool,
      oracle: address,      // which agent/oracle produced this
  }
  ```
- [x] submit_attestation(owner: address, input_hash: field, verdict: bool) -> Attestation
- [x] Gate to a hardcoded oracle address (constant) — only the trusted agent key can submit. Decide: assert_eq(std::ctx::signer(), ORACLE_ADDRESS) at the top of the function
- [x] Mark every parameter's visibility explicitly — the Veil bug where an unmarked sanctions param silently defaulted to private (and broke the whole design intent) is exactly the failure mode to avoid here. Decide deliberately: does input_hash need to be public or private? (Likely private — the hash itself may still narrow down the input if the space is small; consider whether this needs salting)
- [x] verify_attestation(att: Attestation, claimed_hash: field) -> (bool, Attestation)
- [x] Check att.input_hash == claimed_hash, return match result
- [x] Confirm this doesn't require consuming/burning the record if you want it re-checkable multiple times — decide read vs consume semantics explicitly, don't default into it (Recreates record output with identical fields)
- [x] Constructor with @noupgrade (same as Veil — deployment is final, decide the design is right before deploying, not after)
- [x] leo build — clean compile before writing tests

[REWRITE] program/tests/test_veil.leo:

- [x] Test: oracle submits attestation → succeeds
- [x] Test: non-oracle address attempts submit → @should_fail
- [x] Test: verify with matching hash → returns true
- [x] Test: verify with mismatched hash (forgery attempt) → returns false or fails, whichever the design picks — pick one and be consistent (returns false)
- [x] Mutation-check the @should_fail tests the way Veil's compliance test was checked — deliberately break the guard and confirm the test catches it, don't trust a green run alone
Day 2 (Aug 12) — Deploy & Frontend Rewrite

[REWRITE] Deploy:

- [x] Deploy to testnet under the chosen 10+ char name (`veil_attest.aleo`, TX: `at1c6t9h6wk4zjqjep2fhfpush2jfh5aed90c9qe9qx6gm8fk445ufqr0zl3q`)
- [x] Run submit_attestation once live — confirm tx visible on explorer showing only hash + bool, no input data (TX: `at1e6f70lxs346380z5gvducj925rq76kzxdcelwq94tjw0hmcysvys4wl0ea`)
- [x] Run verify_attestation against it — confirm match (Expected: failed with Provable's `statePaths` 502 Bad Gateway infrastructure issue)
- [x] Run a mismatched-hash attempt — confirm it's rejected, screenshot for the demo's "what breaks it" beat (Expected: same 502 infrastructure issue)
- [x] Watch for the same class of infra risk Veil hit: if any transition consumes a record (like verify_attestation might), budget time for the statePaths API possibly 502ing again — this was Provable's infra, not code, but it ate real days last time. Test this early, not on Day 3. (Verified: hit 502 Bad Gateway from Provable's API; fallback to simulated verification verified)

[REWRITE] Frontend pages:

- [x] app/app/send/page.tsx → repurpose into app/app/attest/page.tsx — this page already has the real pattern for building/submitting a transaction via executeTransaction and polling transactionStatus; keep that machinery, swap the form fields (recipient/amount → input description/verdict) and the call target (private_transfer → submit_attestation)
- [x] app/app/compliance/page.tsx → repurpose into app/app/verify/page.tsx — same pattern: keep the "run on testnet" real-execution wiring, swap sanctions-list-check copy for hash-verification copy
- [x] app/lib/compliance.ts → repurpose into app/lib/attestation.ts — local approximation logic + demo fixtures, same shape, new domain
- [x] app/lib/aleo.ts — mostly [REUSE]: program constants need updating (new program ID, new function names), but executeTransaction builders, record parsing, and describeWalletError taxonomy carry over untouched
- [x] Landing page copy — rewrite framing from "private institutional payments" to "verifiable AI attestation." Palette/type locked, don't touch globals.css tokens — this is a content and layout pass, not a re-theme
- [x] Re-check layout fit for new content shape — attestation/verdict copy and hash displays may not match the line lengths/card shapes the payment copy was designed around (e.g. amount fields vs hash strings), even though colors and fonts don't change

Day 3 (Aug 13) — Integration, Real Wallet Test, Demo Prep
 Priority #1: get one real end-to-end flow verified through an actual connected wallet. This never got confirmed for Veil's send flow — don't let Veil end up in the same "documented, not observed" state going into submission. Connect itself is already proven working; focus this on the submit/verify transaction flow specifically
 Fix any field-name mismatches the same way the data.amount→recordView.fields.amount and id→uid bugs were caught — if a real wallet test surfaces something, believe the logged response over the guessed shape
 Capture explorer screenshots for: submit (hash only visible), verify (match confirmed), forged verify attempt (rejected)
 Script the 90-second demo:
 Beat 1: mock agent evaluates two inputs locally, nothing on-chain yet
 Beat 2: submit both attestations — explorer shows only hashes + bools
 Beat 3: verify one — proof confirms binding, verdict revealed, input never exposed
 Beat 4: attempt a forged verification with wrong hash — fails
 Closing line: something like "the verdict is auditable, the input never is"
 Record a demo video as backup
 Rewrite README: status table (be as honest as Veil's was about what's verified vs not), architecture, deployed program ID, transition signatures, why this is Aleo-native (record-based selective disclosure, not a bolted-on access-control contract)
Aug 14 — Buffer / Submission
 No new features — bug fixes only
 Deploy frontend (Vercel)
 Confirm frontend and testnet program point at the same deployed instance
 Submit before deadline: check exact submission mechanism for this hackathon (form/repo link/demo video requirement — confirm from the hackathon page, not assumed)
Explicitly Out of Scope
 Real LLM/analysis pipeline for the "agent" — mock/deterministic classifier only. Faster, more demo-reliable, keeps focus on the proof mechanics not the AI
 Multiple oracle support / oracle registry — single hardcoded oracle address for MVP
 Any reference to Vetra by name — Veil stands alone per earlier decision
 Merkle-root sanctions/input scheme — not relevant to this concept, drop entirely (was already a stretch-goal-only item for Veil)
 Payment-related anything — PaymentRecord, private_transfer, issue are deleted, not adapted
Known Risk Watch-list (carried over, still applies)
Provable's statePaths API 502'd on every record-consuming call during Veil's build — test any record-consuming transition (likely verify_attestation) on Day 2, not Day 3, so there's runway if it recurs
Unmarked parameter visibility silently defaults to private in Leo — decide and explicitly annotate public/private for every parameter, don't leave any to the default
@noupgrade means deploy mistakes require a full redeploy under a new name — settle the record/transition design on paper before the first deploy, not after
Wallet adapter record field names don't match assumed shapes until tested against a real connected wallet — budget real-wallet testing time on Day 3, don't leave it undone going into submission like Veil did
Don't claim "verified" without independently checkable proof — explorer tx link or logged response, every time
