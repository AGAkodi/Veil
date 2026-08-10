# Veil — Audit → Attest → Verify — Build TODO (Option B: Server-Signed Attestation)

The oracle key lives server-side. A visitor runs an audit, the backend signs and submits the attestation autonomously — no visitor ever needs to hold or connect the oracle's wallet. This is the stronger "AI agent actually attests" narrative, at the cost of real new backend work.

Scope: this file covers ONLY this addition. Core submit_attestation / verify_attestation contract logic, wallet connect (still used for /verify), deploy pipeline, and design tokens are already done — don't re-touch or re-verify them here unless a task explicitly says to.

Fallback plan, stated up front: if server-side signing isn't reliably working by the end of Day 2 below, fall back to Option A (connected wallet = oracle wallet, no backend) rather than entering the final day with an unstable attest path. A working simpler flow beats a broken impressive one.

## 0. Architecture — Confirmed: Server-Side Oracle Signing
- [x] Oracle private key lives in a server-only env var, read only inside a Next.js API route, never sent to the client, never logged
- [x] Flow: visitor runs audit (Step 1, local/off-chain) → frontend sends the verdict + input hash to a new API route → backend builds, signs, and broadcasts submit_attestation using the oracle's Account → backend returns tx status to frontend → frontend polls/displays confirmation
- [x] /verify is unaffected — it still uses the visitor's own connected wallet, since that's a third party checking an attestation they hold, not an oracle action

## 1. Env Additions
- [x] ORACLE_PRIVATE_KEY — server-only, not NEXT_PUBLIC_-prefixed. Only ever read inside the new API route (server context), never imported into any client-side file
- [x] GROQ_API_KEY — server-only, not NEXT_PUBLIC_-prefixed. Used by the new audit API route to call Groq for the live model verdict; never exposed to the client
- [x] NEXT_PUBLIC_ORACLE_ADDRESS — still useful client-side for display purposes (e.g. showing which address attestations come from), safe to expose since it's already the public hardcoded constant in main.leo
- [x] Confirm .env.example documents ORACLE_PRIVATE_KEY and GROQ_API_KEY as placeholders only, never real values committed
- [x] Confirm .gitignore already covers .env (per the existing pattern from earlier builds) — double check before either key exists anywhere near the repo
- [x] Fund the oracle address with enough testnet credits to cover repeated attestation fees through the demo period — this account now pays fees automatically on every attest, monitor balance, don't let it run dry mid-demo

## 2. Backend — New Audit API Route (Groq, Live with Cached Fallback)
- [x] Create /app/api/audit/route.ts — accepts the selected fixture/input, returns a verdict
- [x] Live path: call Groq's API with the fixture's content, structured-output prompt (return strict JSON — verdict as bool + short rationale string), temperature 0 so the same fixture produces a consistent verdict across demo runs
- [x] Set an explicit timeout on the live call (e.g. 5–8s) — if Groq doesn't respond in time, or errors, fall through to the cached path automatically, don't surface a raw error to the UI (6s timeout abort controller implemented)
- [x] Cached fallback path: precompute and store one real Groq response per fixture (run it once during build/dev, save verdict + rationale into the fixtures file itself, e.g. app/lib/attestation.ts), used automatically if the live call fails or times out
- [x] Response shape to the frontend should be identical whether it came from the live call or the cache — the UI shouldn't need to know which happened, though it's fine to show a subtle "cached" indicator for your own debugging if useful
- [x] Compute the input hash from the fixture's actual content (not from the model's output) — this must stay stable regardless of whether the verdict came live or cached, since it's what gets bound on-chain in the attest step
- [x] Test this route standalone first: confirm a live Groq call returns a usable verdict, confirm killing the network/API key still returns a correct cached verdict without crashing the route

## 3. Backend — New Attest API Route
- [x] Create /app/api/attest/route.ts (or equivalent) — accepts verdict + input hash from the frontend's Step 1 result
- [x] Load the oracle Account from ORACLE_PRIVATE_KEY using the Aleo SDK — this is new machinery, not a repurpose of the existing wallet-adapter code, since there's no browser extension involved here
- [x] Build the submit_attestation transaction, sign it with the oracle account, broadcast it to testnet (signs and broadcasts securely via spawned native CLI process in 1m20s)
- [x] Return transaction ID / status to the frontend so it can poll or display confirmation
- [x] Error handling specific to this path — don't assume the existing describeWalletError taxonomy applies, since these are raw SDK/RPC failures (insufficient fee balance, network timeout, malformed input), not wallet-extension failures. Write a small equivalent for backend errors
- [x] Basic abuse protection: rate-limit the route (even a simple in-memory per-IP limiter is enough for a hackathon build) — without this, anyone can spam the endpoint and drain the oracle's fee balance (sliding window 1m limiter implemented)
- [x] Test this route standalone (e.g. via curl/Postman) before wiring the frontend to it — confirm a real attestation lands on testnet from a backend-only call, independent of any UI (TX verified: `at1kz04tmrh76ukp4en69lmq4rqqlc8sp4pp4fkz5f02q04q8lf9c8s0l85rl`)

## 4. Frontend — /attest Two-Step Flow, Updated for Backend Signing
- [x] Step 1 — Run Audit (now calls the live/cached Groq route, not a local mock):
    - [x] Frontend calls /api/audit with the selected fixture, displays whatever verdict comes back (live or cached — indistinguishable to the UI)
    - [x] Show a brief loading state while the live call attempts, in case it takes the full timeout window before falling back
    - [x] Verdict + input hash from this response, nothing on-chain yet, explicitly labeled "not yet on-chain"
- [x] Step 2 — Attest On-Chain (calls the backend, not a wallet):
    - [x] No wallet-connection requirement for this step anymore — remove the "connect the oracle wallet" messaging from the earlier plan, it no longer applies
    - [x] Button sends Step 1's verdict + input hash to /api/attest
    - [x] Show a pending state while the backend signs and broadcasts
    - [x] On response, display the transaction result (hash, nullifier) the same way as before
    - [x] Update the public stats strip trigger to fire off the backend's confirmed response, not a wallet-adapter transactionStatus poll (the polling now happens server-side or via a lighter client poll against the returned tx ID — decide which and keep it consistent)
    - [x] Update all copy that referenced "connect as the oracle" — the new story is "an autonomous agent audits and attests," so the UI should reflect that no visitor-side wallet action is needed for either step

## 5. /verify — Confirm No Changes Needed
- [x] Confirm this still works exactly as before — visitor's own connected wallet checks a held attestation via verify_attestation. Nothing about this addition touches this path
- [x] Re-run this flow once after all changes land, purely as a regression check (shared program deploy, shared frontend build — worth a quick re-verify, not a rebuild)

## 6. Public Stats Strip
- [x] No change to the mappings or the component itself
- [x] Confirm the trigger point: fires after the backend confirms the attest transaction landed, not on button click, not on Step 1 completion

## 7. Demo Fixtures
- [x] Each of the 2-3 fixture categories needs a precomputed cached Groq response saved alongside it (run once for real, store the result) — this is what the audit route falls back to
- [x] Confirm the fixtures still work end-to-end through the new path — audit produces a verdict (live or cached), that verdict is what actually gets sent to /api/attest, no mismatch between what's displayed in Step 1 and what's submitted in Step 2

## 8. Demo Script Update
- [x] Beat 1: visitor runs audit on a fixture — live Groq call attempts, verdict appears (flag if it visibly took the fallback path during rehearsal, and decide whether that's acceptable to show or worth avoiding by pre-testing that fixture's live-call reliability), labeled "not yet on-chain"
- [x] Beat 2: click Attest — backend signs and submits automatically, no wallet popup, transaction confirms, explorer shows only hash + bool, public counters tick up
- [x] Beat 3: repeat briefly with a second fixture from a different category
- [x] Beat 4: switch to /verify, connect a (any) wallet as a third party, verify one attestation — proof confirms binding, input never exposed
- [x] Beat 5: attempt a forged verification with wrong hash from the auditor console — fails, visibly, on-screen
- [x] Closing line: something like "the agent audits and attests on its own — verification is the only step that needs a human in the loop"
- [x] Record video backup of the full sequence — this demo now depends on two live network calls (Groq + Aleo broadcast), a backup recording matters more here than in any earlier version of this build

## 9. README Updates
- [x] Document the server-signing architecture explicitly: oracle key lives server-side, audits and attestations happen without a visitor ever holding the oracle's key
- [x] Document the audit architecture: live Groq call with a cached, precomputed fallback per fixture, temperature 0 for consistency
- [x] Document ORACLE_PRIVATE_KEY, GROQ_API_KEY, and NEXT_PUBLIC_ORACLE_ADDRESS in the env setup section, with a clear warning that the first two must never be committed or exposed client-side
- [x] Note the rate-limiting approach on /api/attest and why it exists (fee-balance protection)
- [x] Keep the marketplace-fit paragraph; update Future Work to include: multi-oracle registry, attestation revocation, per-oracle stats, live-model support for arbitrary (non-fixture) inputs, and (if you want a stronger security story later) moving the oracle key into a proper secrets manager or HSM instead of a plain env var

## Explicitly Out of Scope
- Wallet-based oracle signing (Option A) — superseded by this plan; kept only as the stated fallback if server-side signing isn't stable by end of Day 2
- Live model support for arbitrary user-submitted input — audit stays scoped to the fixed set of demo fixtures, not open-ended input, to keep the Groq prompt and caching bounded
- Attestation revocation — future work
- Multi-oracle registry — future work
- Proper secrets manager for either key — plain server-only env vars are acceptable for a hackathon submission, note as future hardening in README, don't build it now
- Re-theming — flow/backend work only, locked design tokens unchanged

## Risk Watch-list
- Two separate high-risk backend paths now exist: the attest signing route and the Groq audit route. Test each standalone before wiring them together, and before wiring either to the frontend
- Groq latency or downtime during the actual demo is a real live-network risk — the cached fallback exists specifically for this, make sure it's actually wired in and tested (kill the API key temporarily during a dev test to confirm the fallback fires correctly), don't assume it works because the code looks right
- Oracle fee balance can run out silently if the rate limiter isn't in place or the demo runs long — check balance before the live demo, not just once during development
- Backend errors will look different from wallet errors (RPC timeouts, malformed broadcast responses, Groq API errors) — don't reuse describeWalletError assumptions, they won't match either new path
- If Day 2 ends and /api/attest hasn't landed a real confirmed transaction independent of the frontend, invoke the fallback to Option A immediately rather than continuing to debug into the final day
- Don't claim either backend path "works" without an independently checkable result — explorer link/tx ID for attest, logged actual Groq response (not assumed shape) for audit, every time
