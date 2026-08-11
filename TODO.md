# Multi-Input Audit + Two-Critic Cascade — Build TODO

Adds three ways to submit something for audit (raw paste, URL, Aleo program ID) and upgrades the audit engine from a single Groq call to a two-critic deterministic cascade, inspired by TryAnneal's audit pattern but scoped down to what's actually portable to Leo/Aleo.

Scope: this file covers ONLY this addition. Everything from the prior Audit → Attest → Verify TODO (server-signed oracle, /api/attest, /verify, public stats strip, on-chain gating) is already built and untouched here — this TODO only changes what feeds into the audit step, and how the audit itself is computed.

Priority order, stated up front:

Raw paste — already works, no change needed, this is the fallback that must never break
Aleo program ID → fetch deployed source — the flagship path, most Aleo-native, most reliable of the two new inputs
Arbitrary URL — the riskiest addition; scope down to GitHub links only, and cut entirely first if time runs short

## 1. Input Mode: Aleo Program ID (build this first of the two new modes)
- [x] Confirm the exact Provable explorer API endpoint (not the mapping-read endpoint already used elsewhere in aleo.ts) — check Provable's API docs directly, don't assume a path
- [x] Add a fetch function (e.g. fetchProgramSource(programId: string)) that calls this endpoint and returns raw Leo source
- [x] Handle the "program not found" case explicitly — a mistyped or non-existent program ID should return a clear error, not a blank audit
- [x] Handle large programs — decide a size cap consistent with whatever limit the audit/Groq call can reasonably handle, truncate or reject beyond that with a clear message rather than silently failing
- [x] Detect input type automatically: if the pasted text matches the Aleo program ID pattern (e.g. name.aleo) rather than looking like source code, route it through this fetch path instead of auditing the literal string "veil_attest_v2.aleo" as if it were code
- [x] Test against at least 2 real deployed programs, including veil_attest_v2.aleo itself if allowed, to confirm the fetch actually returns real source and not an error page or truncated response

## 2. Input Mode: URL (GitHub-only scope, cut first if tight on time)
- [x] Scope explicitly to GitHub links only for this build — detect github.com/.../blob/... URLs and auto-normalize them to raw.githubusercontent.com form before fetching (a raw "blob" URL returns an HTML page, not source, if fetched as-is)
- [x] Reject or clearly flag non-GitHub URLs rather than attempting a best-effort fetch of anything — unpredictable content-types are a demo-day risk
- [x] Add a size cap and a fetch timeout, same category of hardening as the Groq/attest calls already have
- [x] Add content-type checking — if the response isn't plain text, fail clearly instead of feeding HTML/JSON into the audit cascade
- [x] Decision checkpoint: if this isn't working reliably by the time program-ID input (#1) and the cascade upgrade (#3) are done, cut this mode entirely rather than shipping something flaky. Raw paste + program ID alone is a complete, demo-safe story without it


## 3. Audit Engine — Two-Critic Deterministic Cascade

Upgrade /api/audit from a single Groq call to two independent critics, following the corroboration pattern (not a full port of TryAnneal — no Slither, no static analysis, no corpus matching, none of that applies to Leo or generic pasted text):

- [x] Two Groq calls in parallel: one using Llama-3.3-70B, one using GPT-OSS-120B (or whichever two models are actually available on your Groq account) — architecturally distinct enough that they don't just repeat the same reasoning
- [x] Both at temperature 0 — same reasoning as before, needed for consistent verdicts on repeated audits of the same input
- [x] Corroboration rule: only report a finding as confirmed if both critics agree; if they disagree, decide how to surface that (e.g. lower-confidence flag, or default to the more cautious verdict) rather than silently picking one
- [x] Merge outputs into a single verdict + explanation, same response shape as before so nothing downstream (hashing, attest, UI) needs to change
- [x] Update the cached-fallback mechanism: now needs a cached response representing the merged two-critic output, not a single model's cached response, for each demo fixture
- [x] Keep the existing timeout-and-fallback behavior, just applied to two calls instead of one — if either critic times out, decide: fall back entirely to cache, or proceed with the one critic that responded and flag lower confidence
- [x] Re-test all existing demo fixtures through the upgraded cascade — confirm verdicts are stable and consistent, not just "different from before"

## 4. Frontend — Step 1 Input UI
- [x] Add a mode selector or auto-detection on the Step 1 textarea: paste code / paste a program ID / paste a URL — decide whether this is an explicit toggle or automatic detection based on input shape (recommend explicit toggle, it's more demo-legible than silent detection)
- [x] Show a distinct loading state for the resolution step (fetching program source, or fetching a URL) separate from the audit-cascade loading state — these are now two sequential async steps, not one
- [x] Surface resolution errors clearly (program not found, URL fetch failed, unsupported content type) before ever attempting to audit — don't let a failed fetch silently turn into "auditing an empty string"
- [x] Confirm the existing demo fixture buttons ("Load vulnerable contract" etc.) still work unchanged — they should bypass resolution entirely and go straight to audit, same as today

## 5. README Updates
- [x] Document the three input modes and which is the flagship (program ID), which is the fallback (raw paste), which is scoped/cut (URL, GitHub-only if shipped)
- [x] Document the two-critic cascade: which two models, why two instead of one, the corroboration rule
- [x] Add an explicit limitation note: unlike Solidity-focused tools, there's no static-analysis backstop for Leo — safety judgments here are LLM reasoning only. State this plainly, don't imply more rigor than exists
- [x] Update Future Work: static analysis tooling for Leo (if/when such tooling exists), broader URL support beyond GitHub, program-source caching to avoid re-fetching the same program repeatedly


## Explicitly Out of Scope
- Slither/Aderyn or any Solidity static analysis — doesn't apply to Leo, not portable
- Exploit corpus / pattern-similarity matching — EVM-specific dataset, not relevant here
- A third critic (e.g. Gemini) — two is enough for the corroboration rule, adding a third is new scope for marginal benefit this close to deadline
- Non-GitHub URL support — cut or scoped to GitHub-only, per #2
- Any Mantle/ERC-8004/on-chain attestation reuse from TryAnneal — Veil has its own Aleo attestation contract already, no need for a second system
- Program source caching — future work, not needed for a demo with a handful of repeated lookups

## Risk Watch-list
- Program-ID resolution depends on Provable's API being up and the endpoint path being correct — confirm this early (task 1, item 1), don't discover it's wrong on demo day
- Two parallel Groq calls instead of one roughly doubles both latency and the chance of a timeout — re-check the timeout window from the earlier cached-fallback work is still appropriate, it may need to increase slightly
- If GitHub-link support ships, it's the least tested of the three modes by nature — don't feature it prominently in the demo unless it's been run successfully multiple times in a row beforehand
- Don't claim any input mode "works" without watching a real, previously-untested program ID or URL go through the full flow — cached happy-path testing on the same one or two examples repeatedly can hide real failures
