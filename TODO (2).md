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
- [x] Deploy `veil_rails.aleo` (transfer-only version) to testnet — **program renamed from `veil.aleo` to `veil_rails.aleo`.** Aleo waives the deploy namespace fee only at 10+ character names; `veil.aleo` (4 chars) priced out at 1,000,000 credits, `veil_rails.aleo` (10 chars) at 1.0. Deployment is `@noupgrade`/final, so the name is permanent — display copy stays "Veil". Deploy tx: `at1nzwqty30r6f4hexftu902v4868dlp50g8n80x2qytdkg3m8zgvzsa5jneq`, fee 5.762362 credits. **Superseded on Day 4-5 by `veil_rails_v2.aleo`** — see that section for why; use v2 going forward, this entry is kept for the record.
- [ ] Execute a real testnet transfer via CLI — **blocked on Provable's infra, not our code.** `issue` (no record input) executes live fine — done twice now, most recently under `veil_rails_v2.aleo`: tx `at1u2jyam3st8ezp30l92qjl3z773fahqfgn6mxdwwemw49ja2lwyxq48dt7g`, funding a 10,000-credit `PaymentRecord`. `private_transfer` — which consumes that record — fails locally before broadcast: Leo's CLI hits `GET .../testnet/statePaths?commitments=...` to build the record's spend proof, and that route returns `502` consistently on both `api.explorer.provable.com/v1` and `api.provable.com/v2` (same backend), reconfirmed as of the Day 4-5 session. Isolated to record-consuming calls specifically — `issue`, `leo deploy`, and `prove_compliance` (no record input) all worked. Re-run once the endpoint recovers:

  ```sh
  cd program && set -a && source ../.env && set +a
  leo execute veil_rails_v2.aleo::private_transfer \
    '{owner: aleo15m50rvhx0glq0hjv807c2t0z40et9ljmvdjrqv8f4pr8evzs2qysfnv2un.private, amount: 10000u64.private, sender: aleo15m50rvhx0glq0hjv807c2t0z40et9ljmvdjrqv8f4pr8evzs2qysfnv2un.private, memo: 0field.private, _nonce: 3626063885973523516596134041468295414084581684861792684865414628498310917634group.public}' \
    <recipient-address> 4000u64 --broadcast --yes --endpoint "$ALEO_ENDPOINT" --network testnet
  ```

- [ ] Pull up testnet explorer, confirm only tx hash + nullifier visible — blocked on the above; deploy/issue/prove_compliance are visible now, e.g. [explorer.provable.com](https://explorer.provable.com/transaction/at1rf78qzqlmgssrpnu0dyxm9t6myf2sdvezhkkychkwgefqcs63vzq9tc2m5) for the `veil_rails_v2.aleo` deploy
- [x] Document deployed program ID + example tx hash in README

---

## Day 4-5 — `prove_compliance` Transition

- [x] Hardcode sanctions list — `SANCTIONS: [field; 10]` in the test file, with the sanctioned entry computed as `BHP256::hash_to_field(MALLORY)` so the fixture cannot drift from the address it screens
- [x] Implement `prove_compliance(counterparty: address, sanctions: [field; 10]) -> bool`
  - [x] **Design decision made: public list.** Matches the Day 4-5 default — real sanctions lists are published, so only the counterparty being screened needs hiding. Merkle-root version remains a stretch goal, not attempted.
    - Note: ARCANUM is **not** a working reference for the fix. Its README advertises "private Merkle path, public Merkle root", but `circuits/compliance_circuit/src/main.nr` actually takes `sanctions_list: pub [Field; 10]` and linear-scans it. The Merkle design was never built — copying ARCANUM would carry the same flaw over, and the README claim should be corrected there too.
  - **Bug caught after the first deploy:** the public-list decision was made but never written into the signature — `fn prove_compliance(counterparty: address, sanctions: [field; 10])` has no `public` keyword, and Leo defaults unmarked parameters to private. Confirmed in the deployed ABI: both inputs showed `"mode": "Private"`. That silently defeats the stated design — nobody could verify which list a call actually checked against, since a caller could pass an empty list and always get a clean result. Because `veil_rails.aleo` deployed with `@noupgrade`, this couldn't be patched in place.
  - Fixed: `fn prove_compliance(counterparty: address, public sanctions: [field; 10])`. ABI now confirms `sanctions` is `"mode": "Public"`, `counterparty` stays `"mode": "Private"`.
- [x] Loop/check membership, output pass/fail
- [x] Test against a clean address → passes (`test_clean_party_passes`)
- [x] Test against a sanctioned address → blocks (`test_sanctioned_blocked`, mutation-verified)
- [x] Decide integration point: separate pre-check, not composed. `prove_compliance` and `private_transfer` remain independent functions — the frontend (Day 7) calls compliance first and gates the transfer submission on its result, rather than one combined transition. Revisit composing only if time allows after Day 7.
- [x] Deploy compliance transition update to testnet — **shipped as a full redeploy under a new program ID, `veil_rails_v2.aleo`,** not an in-place update (`@noupgrade` makes in-place updates impossible by design). `veil_rails.aleo` (the Day 2-3 deploy) is now superseded — it is still live on-chain but has the private-sanctions-list bug above and should not be used. `veil_rails_v2.aleo` is the current program going forward; update `.env` / frontend config accordingly (already done in this repo's `.env` and `.env.example`). Deploy tx: `at1rf78qzqlmgssrpnu0dyxm9t6myf2sdvezhkkychkwgefqcs63vzq9tc2m5`, fee 5.747489 credits.
- [x] Re-verify `private_transfer` still works after redeploy (regression check) — all 5 `leo test` cases pass against `veil_rails_v2.aleo` (partial transfer, exact-amount zero change, overspend rejection, clean/sanctioned compliance). Live on-chain re-verification of `private_transfer` specifically is still blocked by the same `statePaths` 502 outage noted in Day 2-3 — unaffected by this redeploy, still Provable's infra, not ours.
- [x] Document both transition signatures in README — `prove_compliance` executed live on testnet against the corrected program: tx `at10680fn07k6rv4t8qxtfnwgxttazl8n0pd3emx9f9w94gjz6wfszsjd7spu`, clean address, output `true`. The sanctioned-blocks path is exercised locally only (deliberately — broadcasting a call built to revert spends fee for no additional proof, and it's already mutation-verified by `leo test`).

---

## Day 6 — Frontend

- [x] ~~Fork ARCANUM frontend repo as starting point~~ — superseded: fresh Next.js 16 + Tailwind v4 scaffold, because the design direction changed (below)
- [x] Landing page built to `design.jpg` — palette sampled from the image (cream `#E7E5D9`, paper `#F4F1E8`, ink `#101A1F`, accent `#EA6B3E`, sage `#C3C9BF`), Newsreader + Inter, editorial two-column origin section
- [x] Strip down to three app screens: Connect Wallet / Send Payment / Compliance Status — live at `/app`, `/app/send`, `/app/compliance`. Same editorial system as the landing page (same palette, `.eyebrow`/`.display`/`.pull` type classes, `ArrowIcon`), extended with a `.field`/`.pill`/`.dot` set for forms and status states — no new visual language introduced.
- [x] ~~Reuse dark aesthetic (Obscura-style / ARCANUM's theme)~~ — **overridden.** `design.jpg` is a light editorial style: cream ground, serif display with orange italic accents, small-caps sage eyebrows, generous whitespace. Do not mix in the dark theme.
- [x] Wallet connect flow (Shield Wallet or Leo Wallet — confirm which supports current testnet) — **resolved: Leo Wallet.** It has an actively maintained official wallet adapter and testnet 3 support; no evidence "Shield Wallet" is a current, real option. `/app` mock-connects (`app/lib/wallet-context.tsx`) using the real funded testnet address from the Day 2-3/4-5 deploys, with a `window.leoWallet` presence check that only changes UI copy — no real adapter call yet. Real wiring is Day 7.
- [x] Send Payment form: recipient address, amount, memo (optional) — `/app/send`. Mock available balance (10,000 credits) mirrors the actual `issue` execution on testnet, not an arbitrary number.
- [x] Wire compliance check as a visible step before transfer submits (pass/fail indicator, red/green state) — auto-runs client-side as a valid address is entered; blocks the Submit button on a match. Uses the same clean/sanctioned addresses as `program/tests/test_veil.leo` (the throwaway address this build actually ran `prove_compliance` against on-chain, and the MALLORY fixture), so the demo behavior matches the deployed program's real behavior, not invented data.
- [x] Transaction status view (pending / confirmed / failed) with testnet explorer link — component supports all three states, but the "confirmed" path deliberately stops one step short of it: after simulating proof-building it lands on an explicit "not broadcast — wallet + SDK wiring lands in Day 7" state rather than fabricating a transaction hash. The "failed" state is real, not simulated theater — it's the actual compliance-block path. Decided against inventing a fake `at1…`-shaped hash to avoid it being mistaken for a genuine broadcast (see the risk list's "don't claim verified without independently checkable proof").
- [x] Remove all ARCANUM-specific UI (Soroban refs, Freighter wallet, Noir circuit language) — audit for leftover copy — audited: this frontend was a fresh scaffold, not a fork, so no leftover ARCANUM UI exists. The only ARCANUM/Noir/Soroban mentions in `app/page.tsx` are the deliberate "Origin"/"Difference" narrative sections explaining what ARCANUM was; nothing accidental.
- [x] Responsive check (demo may be shown on laptop screen share, but don't ship broken mobile) — checked all four pages (landing + 3 app screens) at a 390px viewport via a headless-browser pass: no horizontal overflow on any of them, mobile nav row renders under the header on the app screens.

**Also fixed while in here, not originally scoped to Day 6:**

- Landing page's guarantee #02 claimed sanctions screening runs "against a published Merkle root" — inaccurate since Day 4-5 confirmed the program does a linear scan over a public list, and Merkle is still just a stretch goal. Corrected the copy.
- README told readers to open `http://localhost:3007`; `package.json`'s `dev` script has no `-p` flag, so `next dev` actually serves on Next's default, `3000`. Fixed the doc rather than the port, since changing the port is the more consequential move and nothing in the plan explains why 3007 was chosen.
- Verification note: no `chromium-cli` or Playwright available in this environment; installed Playwright + a headless Chromium build into an isolated scratch directory (not added to `package.json`/`node_modules`) to drive the actual dev server and screenshot every state described above, rather than trusting compile success alone.

---

## Day 7 — SDK Wiring & Integration

**Superseded mid-day: switched wallet toolkits entirely.** The first pass
used `@demox-labs/aleo-wallet-adapter-*` with only Leo Wallet. Told to add
Shield Wallet (recommended) alongside Leo, research found that
`docs.aleo.org/participate/wallets/` names **Shield — not Leo — as the
officially recommended wallet** ("Built by Provable in partnership with
the Aleo Network Foundation, Shield is the recommended wallet"), and that
Provable ships a newer, official toolkit
(`@provablehq/aleo-wallet-adaptor-{core,react,shield,leo}`, confirmed
current via `npm view`, published ~2 weeks before this session) with
first-party adapters for **both** Shield and Leo behind one consistent
interface. Migrated everything to it rather than bolting a hand-rolled
Shield wrapper onto the old Leo-only integration. `@demox-labs/*` is fully
removed; incidentally this also cleared the one open `npm audit`
high-severity advisory from Day 7's first pass (a transitive `nanoid` in
the old leo adapter) — `npm audit` is clean now.

**Caveat carried over from the package itself, not discovered later:**
`@provablehq/aleo-wallet-adaptor-shield`'s own README says *"Shield wallet
connector (**alpha**) built on top of the Aleo wallet adaptor core"* and
*"Integrate the Shield wallet (**pre-release build**)"* — Shield is the
right long-term choice per Aleo's own docs, but the adapter wiring it up
is explicitly alpha-quality by its author's own admission, not battle
tested. `@provablehq/aleo-wallet-standard` (a shared dependency) similarly
describes its `StandardWallet` interface as experimental/WIP in its own
README — this build only imports the pieces of it needed for types
(`WalletReadyState`, `WalletAdapter`, `WalletName`), not that experimental
interface itself.

**Read this before the demo.** There is still no way to install a real
Chrome extension and click through an actual wallet-approval popup in this
environment, so "extension present, user approves, real broadcast" has
**not been driven end-to-end by anything other than reading the adapter
packages' TypeScript types and bundled READMEs.** What *has* been
independently verified (headless Chromium + Playwright, screenshots, clean
`console --errors`): the no-extension path is genuinely real for **both**
wallets simultaneously (Shield row + Leo row, Shield marked Recommended,
both correctly show "Install" since headless Chromium has neither), the
demo-mode fallback still works end to end, the Compliance screen's
on-chain button correctly stays absent with no real wallet behind the
session, and `npm run build` / `npm run lint` are clean.

- [x] Integrate Aleo SDK (wallet adapter + program execution calls) — `@provablehq/aleo-wallet-adaptor-{core,react,shield,leo}` + `@provablehq/aleo-types` (added as an explicit dependency since application code imports `Network`/`TransactionOptions`/`TransactionStatusResponse`/`TransactionStatus` from it directly, rather than leaving it a transitive phantom dependency). Still installed with `--legacy-peer-deps`: `-react` declares `react@^18.0.0`, this project is on 19.2.8 — same stale-peer-range situation as the packages it replaced, not a real incompatibility.
- [x] Wire `private_transfer` call from frontend form — `/app/send` builds `TransactionOptions` and calls the new `executeTransaction`, then polls `transactionStatus`. The record being spent is now passed as a `type: "record"` `InputRequest` pinned by the record's `uid` (the `id` field `requestRecords` returns) — the SDK's documented mechanism, and more correct than the previous session's approach of passing a manually-reconstructed record object through by hand.
- [x] Wire `prove_compliance` call from frontend, surface pass/fail to UI — unchanged in spirit from the first pass: `/app/compliance`'s "Run on testnet" button uses the real `BHP256::hash_to_field(MALLORY)` value (`562787451117413909241553807920987664327130590730001887489352292781905069503field`, computed via a throwaway local zero-cost `leo execute`, reproducible across two runs), so it can genuinely trap on the sanctioned example on-chain, not just simulate it. Rebuilt against `executeTransaction`.
- [x] Handle record fetching (get payer's current `PaymentRecord` — decide: local wallet record scan vs manual paste for demo simplicity) — **decided: both, and record scanning got materially better in the rewrite.** `requestRecords(PROGRAM_ID, includePlaintext=true, statusFilter="unspent")` now does status filtering wallet-side via a documented parameter, instead of this build re-implementing "is it spent / does it belong to this program" filtering by hand. Manual-paste fallback stays available.
- [x] Error handling: insufficient balance, failed compliance, network errors — user-facing messages, not raw Leo errors — `describeWalletError` rebuilt against the new toolkit's considerably richer, more precisely named error taxonomy (`WalletNotConnectedError`, `WalletConnectionError`, `WalletTransactionRejectedError`, `WalletTransactionTimeoutError`, `WalletDecryptionNotAllowedError`, `WalletAddressWithheldError`, `MethodNotImplementedError`, and others) — a real improvement over the previous session's shorter, less specific list. Insufficient-balance is still caught client-side before submit (amount vs. selected record's real balance).
- [ ] End-to-end test: connect wallet → send private payment → see confirmation → check explorer shows nothing readable — **still not run**, for the same reason as before: no real wallet extension in this environment. This remains the actual blocker for calling Day 7 fully done.
- [ ] End-to-end test: run compliance check against sanctioned test address → see block in UI — local simulated version passes (verified headless); on-chain version needs the real wallet this environment doesn't have.
- [ ] Capture explorer screenshots/recordings for both flows (backup in case live demo has network hiccups) — blocked on the two items above.

**One of the two big open questions from the first pass is now resolved,
not just carried forward:**

1. ~~Does the id `requestTransaction` returns ever resolve to the real
   on-chain `at1…` hash?~~ **Resolved by switching packages.**
   `@provablehq/aleo-types`' `TransactionStatusResponse` is documented
   with a `transactionId?: string` field described as *"The onchain
   transaction ID (if already exists)"* — a real, documented path from
   the temporary id `executeTransaction` returns to a genuine
   explorer-linkable hash, unlike the old Leo Wallet docs which explicitly
   said the returned id was *not* the on-chain one and didn't explain how
   to get one. `pollTransactionStatus` in `app/lib/aleo.ts` now polls
   until `TransactionStatus` leaves `PENDING`, and both `/app/send` and
   `/app/compliance` render `polled.transactionId` (falling back to the
   temporary id with a "still waiting to finalize" note) instead of
   guessing. **Still unverified against a real wallet** — the field is
   documented, not observed — but this is a materially stronger position
   than "not documented at all."
2. ~~Exact field names inside a custom-program record's `data` object~~
   **Resolved for real this time — the guess was wrong.** A user connected
   a real Shield Wallet, hit exactly the failure this uncertainty
   predicted (amount showing as "unknown," Send silently staying
   disabled), and shared the actual logged response. The real shape has
   **no `data` object at all**: amount lives at `recordView.fields.amount`
   (plain string with a type suffix, e.g. `"10000u64"`, no
   `.private`/`.public`), the record-pin id is `uid` (Shield's own values
   are prefixed `"shield_..."`) not `id`, and the program name is
   `programName` not `program_id`. There's also a `recordPlaintext` string
   holding the raw Leo record literal, now used as a last-resort regex
   fallback for the amount. `WalletRecord`, `readRecordAmount`, and the
   new `readRecordUid` in `app/lib/aleo.ts` are fixed to the confirmed
   shape, with the old guesses kept as fallbacks in case Leo Wallet's
   adapter normalizes differently than Shield's — still unverified for
   Leo specifically.
   - **This was two bugs, not one.** The wrong `data.amount` path only
     broke the balance *display*. The wrong `.id` (should've been `.uid`)
     broke the actual **Send button** — `hasSpendableInput` checked a
     field that never existed on a real record, so it silently stayed
     `false` and Submit stayed disabled no matter what the user filled
     in, with no error message explaining why. That's a materially worse
     failure mode than a wrong balance number, and it shipped because
     nothing here had been exercised against a real wallet response until
     someone actually tried it.

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
