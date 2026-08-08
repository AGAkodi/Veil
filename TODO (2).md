# VEIL — Build TODO
Private Institutional Payment Rails on Aleo — 8 Day Build Plan

> Name resolved: the project is **Veil** (matches the folder and the `AGAkodi/Veil` remote).
> All former `VAULT` / `veil.aleo` references below now read `Veil` / `veil.aleo`.

---

## Day 0 — Environment & Scaffold

- [x] **Install Leo CLI.** It was not on this machine — the "reuse the install from the Aleo NFT marketplace project" assumption was wrong, both `leo` and `snarkos` were absent. Installed via `cargo install leo-lang`, 21m build. **Landed Leo 4.4.1, not the 4.0.2 this plan assumed** — see the API-change note below, it is not cosmetic.
- [ ] Confirm `snarkos`/testnet RPC access is working — `snarkos` still not installed; not needed yet since `leo` talks to the endpoint directly
- [x] Create fresh project dir: `leo new veil` → lives at `program/` (the repo root is the Next.js app)
- [ ] Init git repo, first commit — repo exists (`AGAkodi/Veil`) but **nothing is committed yet**
- [x] `.env` handling: `.env.example` written and force-tracked via `!.env.example`. The recurring desync on the risk list happens precisely because `.env*` hides the template too.
- [ ] Fund a testnet account with Aleo credits (faucet) — **not done, and this gates every deploy step below**
- [x] Token/unit model: custom `PaymentRecord` holding a `u64`, not native credits. Native credits would mean `credits.aleo` records, which do not carry a `sender`/`memo` and cannot express the payment semantics.
- [x] Write project README skeleton — `README.md`, with a status table that states what does *not* exist yet

### ⚠️ Leo 4.4.1 API changes this plan predates

Found by compiling, not by reading release notes. Anything written against 4.0.2 needs these:

| Was | Now |
| :--- | :--- |
| `transition foo()` | `fn foo()` — the `transition` keyword is gone entirely |
| `self.caller` | `std::ctx::caller()` / `std::ctx::signer()` |
| — | every program needs a `constructor()` with an upgradability annotation (`@noupgrade`) |
| `leo run <fn>` with input files | `leo test` running `@test`-annotated Leo files under `tests/` |

Parser constraints that shaped the test file: `const` may not sit inside a `program { }` block, identifiers cannot start with `_` and cap at 31 bytes, and `veil.aleo/PaymentRecord` does not parse as a `let` type annotation.

---

## Day 1 — Program Scaffold & Data Model

- [x] Define `PaymentRecord` (owner, amount, sender, memo). **`recipient` dropped deliberately** — the recipient *is* the owner of the record the transfer produces, so a separate field is redundant and only adds a correlation handle.
- [x] `memo: field`, defaulting to `0field`. Sized to hold an invoice hash without forcing one.
- [x] Write `veil.aleo` — `program/src/main.leo`, three entry points: `issue`, `private_transfer`, `prove_compliance`
- [x] Compiles clean: `leo build` → 1.55 KB / 2000 KB
- [x] Sanctions list: `[field; 10]` public array argument, hashed with `BHP256::hash_to_field`
- [x] Record flow settled: input record consumed → recipient record + change record, always two outputs

---

## Day 2-3 — `private_transfer` Transition

- [x] Implement `private_transfer(...) -> (PaymentRecord, PaymentRecord)`
- [x] Enforce `amount <= payment.amount`. Note: the `u64` subtraction traps on underflow anyway, so the assert is for a *named* failure, not for safety — do not claim it as the sole guard.
- [x] Output record 1: recipient's record
- [x] Output record 2: sender's change record
- [x] Exact-amount edge case resolved and tested — Leo emits the zero-value change record cleanly. Keeping it is deliberate: a suppressed change record would make the output count depend on the amount, leaking whether the sender drained the record.
- [x] Unit tests: 5 passing via `leo test` (`leo run` is not the 4.4.1 workflow). Covers partial transfer, exact-amount zero change, overspend rejection, clean counterparty, sanctioned counterparty.
  - [x] Mutation-checked the `@should_fail` tests rather than trusting a green run — screening a clean address in `test_sanctioned_blocked` correctly flips it to "test succeeded when failure was expected", so the block is caused by list membership and not by an incidental error. (This is the silent-flag-drop item on the risk list.)
  - Note: tests must issue records to `std::ctx::signer()`. Issuing to a literal address fails with "Input record must belong to the signer" — and that failure would have made the overspend `@should_fail` test pass for the wrong reason.
- [ ] Deploy `veil.aleo` (transfer-only version) to testnet
- [ ] Execute a real testnet transfer via CLI
- [ ] Pull up testnet explorer, confirm only tx hash + nullifier visible — screenshot as proof-of-privacy artifact for later demo
- [ ] Document deployed program ID + example tx hash in README

---

## Day 4-5 — `prove_compliance` Transition

- [x] Hardcode sanctions list — `SANCTIONS: [field; 10]` in the test file, with the sanctioned entry computed as `BHP256::hash_to_field(MALLORY)` so the fixture cannot drift from the address it screens
- [ ] Implement `prove_compliance(sender: address, sanctions_list: [field; N]) -> bool`
  - [ ] **Design decision to make first.** Passing `sanctions_list` as a transition input puts the whole list in the public argument, and the loop cost grows linearly with N.
    - Note: ARCANUM is **not** a working reference for the fix. Its README advertises "private Merkle path, public Merkle root", but `circuits/compliance_circuit/src/main.nr` actually takes `sanctions_list: pub [Field; 10]` and linear-scans it. The Merkle design was never built — copying ARCANUM would carry the same flaw over, and the README claim should be corrected there too.
    - For Veil, either accept the public list (defensible — real sanctions lists are published, only the *counterparty* needs hiding) or build the Merkle root version properly. Public-list is the Day 4–5 default; Merkle is a stretch goal.
- [x] Loop/check membership, output pass/fail
- [x] Test against a clean address → passes (`test_clean_party_passes`)
- [x] Test against a sanctioned address → blocks (`test_sanctioned_blocked`, mutation-verified)
- [ ] Decide integration point: does `prove_compliance` gate `private_transfer` directly (composed transition) or run as a separate pre-check called by frontend? (default: separate call for Day 4-5, consider composing only if time allows)
- [ ] Deploy compliance transition update to testnet
- [ ] Re-verify `private_transfer` still works after redeploy (regression check)
- [ ] Document both transition signatures in README

---

## Day 6 — Frontend

- [x] ~~Fork ARCANUM frontend repo as starting point~~ — superseded: fresh Next.js 16 + Tailwind v4 scaffold, because the design direction changed (below)
- [x] Landing page built to `design.jpg` — palette sampled from the image (cream `#E7E5D9`, paper `#F4F1E8`, ink `#101A1F`, accent `#EA6B3E`, sage `#C3C9BF`), Newsreader + Inter, editorial two-column origin section
- [ ] Strip down to three app screens: Connect Wallet / Send Payment / Compliance Status
- [x] ~~Reuse dark aesthetic (Obscura-style / ARCANUM's theme)~~ — **overridden.** `design.jpg` is a light editorial style: cream ground, serif display with orange italic accents, small-caps sage eyebrows, generous whitespace. Do not mix in the dark theme.
- [ ] Wallet connect flow (Shield Wallet or Leo Wallet — confirm which supports current testnet)
- [ ] Send Payment form: recipient address, amount, memo (optional)
- [ ] Wire compliance check as a visible step before transfer submits (pass/fail indicator, red/green state)
- [ ] Transaction status view (pending / confirmed / failed) with testnet explorer link
- [ ] Remove all ARCANUM-specific UI (Soroban refs, Freighter wallet, Noir circuit language) — audit for leftover copy
- [ ] Responsive check (demo may be shown on laptop screen share, but don't ship broken mobile)

---

## Day 7 — SDK Wiring & Integration

- [ ] Integrate Aleo SDK (wallet adapter + program execution calls)
- [ ] Wire `private_transfer` call from frontend form
- [ ] Wire `prove_compliance` call from frontend, surface pass/fail to UI
- [ ] Handle record fetching (get payer's current `PaymentRecord` — decide: local wallet record scan vs manual paste for demo simplicity)
- [ ] Error handling: insufficient balance, failed compliance, network errors — user-facing messages, not raw Leo errors
- [ ] End-to-end test: connect wallet → send private payment → see confirmation → check explorer shows nothing readable
- [ ] End-to-end test: run compliance check against sanctioned test address → see block in UI
- [ ] Capture explorer screenshots/recordings for both flows (backup in case live demo has network hiccups)

---

## Day 8 — Demo Prep & Buffer

- [ ] Fix any bugs surfaced in Day 7 end-to-end tests (this is the buffer day — don't schedule new features here)
- [ ] Script the 90-second demo:
  - [ ] Beat 1: send transfer, show explorer — no amount/parties visible
  - [ ] Beat 2: compliance check passes for clean address
  - [ ] Beat 3: compliance check fails for sanctioned address, transfer blocked
  - [ ] Closing line: "ARCANUM proved this on Stellar with a custom shielded pool. Veil does it natively — privacy is Aleo's protocol, not our code."
- [ ] Record demo video (backup in case live demo fails)
- [ ] Write final README: problem, architecture, deployed program ID, transition signatures, how privacy is native vs ARCANUM's bolted-on approach
- [ ] Deploy frontend (Vercel, matching prior project pattern)
- [ ] Final check: confirm testnet program + frontend are both live and pointing at the same deployed `veil.aleo` instance
- [ ] Submission checklist (whichever hackathon/track this targets): confirm submission form, deadline, and any demo video requirements are met

---

## Explicitly Out of Scope (cut list if behind schedule)

- [ ] ~~`prove_solvency` transition~~ — only attempt if Days 1-6 finish early
- [ ] ~~Multi-asset/custom token support~~ — native credits only
- [ ] ~~Auction/marketplace features~~ — payments only, no crossover with NFT marketplace project
- [ ] ~~Supabase/Pinata/off-chain storage~~ — not needed, records are private on-chain by design
- [ ] ~~Composed single-transition flow (compliance + transfer in one call)~~ — nice-to-have, not core

---

## Known Risk Watch-list (carried over from prior Aleo/ARCANUM builds)

- `.env` desync across sessions (gitignored file, recurring issue) — re-verify at start of each day
- Non-checksummed addresses causing on-chain write failures — validate address format before submission
- Silent flag drops (seen in Vetra's `insufficient_data` bug) — log/assert explicitly rather than trusting silent defaults
- Don't claim "verified" or "working" without independently checkable proof — real explorer tx link or actual request/response trace, every time
