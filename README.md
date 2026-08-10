# Veil — Private Institutional Payment Rails on Aleo

Confidential, compliant payments for institutions, built on Aleo — where record
encryption is a property of the protocol rather than something the application
has to construct.

## Status

Early build. What is and is not true today, kept honest deliberately:

| Piece | State |
| :--- | :--- |
| Landing page | Built, builds clean, verified in browser |
| `veil_rails_v2.aleo` program | Written, compiles clean (1.55 KB), 5/5 tests passing locally |
| Testnet deployment | **Live** — see below |
| `private_transfer` on testnet | Blocked on an outage in Provable's hosted API (`statePaths` returns 502 for any record-consuming call, both `v1` and `v2`) — not a bug in this program. `issue` and `prove_compliance`, neither of which need a record input, both executed fine. Retry once the endpoint recovers. |
| Mainnet | None |
| Wallet integration | Not started |

"Tests passing" means `leo test` locally.

## Testnet Deployment

| | |
| :--- | :--- |
| Program ID | `veil_rails_v2.aleo` |
| Network | Aleo testnet |
| Deploy tx | [`at1rf78qzqlmgssrpnu0dyxm9t6myf2sdvezhkkychkwgefqcs63vzq9tc2m5`](https://explorer.provable.com/transaction/at1rf78qzqlmgssrpnu0dyxm9t6myf2sdvezhkkychkwgefqcs63vzq9tc2m5) |
| `issue` execution tx | [`at1u2jyam3st8ezp30l92qjl3z773fahqfgn6mxdwwemw49ja2lwyxq48dt7g`](https://explorer.provable.com/transaction/at1u2jyam3st8ezp30l92qjl3z773fahqfgn6mxdwwemw49ja2lwyxq48dt7g) |
| `prove_compliance` execution tx | [`at10680fn07k6rv4t8qxtfnwgxttazl8n0pd3emx9f9w94gjz6wfszsjd7spu`](https://explorer.provable.com/transaction/at10680fn07k6rv4t8qxtfnwgxttazl8n0pd3emx9f9w94gjz6wfszsjd7spu) — clean address, output `true` |

The program deploys under `veil_rails_v2.aleo` rather than `veil.aleo`. Two
corrections landed on the way here, both documented in full in
`TODO (2).md`:

1. Aleo's deployment fee includes a namespace charge that is zero at 10+
   character program names and rises steeply below that — `veil.aleo` (4
   characters) priced out at 1,000,000 credits. First fix: `veil_rails.aleo`
   (10 characters, 1 credit namespace fee).
2. `veil_rails.aleo`'s `prove_compliance` had an unmarked `sanctions`
   parameter, which Leo defaults to private — silently contradicting the
   design intent that the sanctions list be public and auditable. Since
   `@noupgrade` makes in-place fixes impossible, the fix required a second
   deploy under a new name: `veil_rails_v2.aleo`, with `public sanctions:
   [field; 10]` explicit in the signature.

`veil_rails.aleo` is still live on testnet but superseded and should not be
used — `veil_rails_v2.aleo` is the current program. Deployment carries
`@noupgrade`, so this name is permanent; display/branding elsewhere in the
app stays "Veil".

## Why This Exists

Veil is the successor to [ARCANUM](../ZBank), which proved the same thesis on
Stellar: an institution should be able to settle on a public chain without
publishing its counterparties or its amounts.

ARCANUM worked, but the privacy was application-level. It needed a shielded
pool we maintained and two Noir circuits we wrote, sitting on a ledger that
records every transfer in the clear. Every guarantee had our own code as its
weakest link.

On Aleo, records are encrypted by the network. There is no pool to maintain and
no ledger to hide from, because the base layer never held the plaintext.

## Program Surface

Three entry points in `program/src/main.leo`. Note Leo 4.4.1 dropped the
`transition` keyword — these are declared with `fn`.

- `private_transfer(payment, recipient, amount) -> (PaymentRecord, PaymentRecord)`
  consumes the sender's record and emits the recipient's record plus the
  sender's change. Amount, sender, and recipient are proof inputs, never
  public ledger rows. An exact-amount transfer still emits a zero-value change
  record on purpose: dropping it would make the output count reveal whether
  the sender drained the record.
- `prove_compliance(counterparty, public sanctions) -> bool` proves a
  counterparty is absent from a published sanctions list without revealing
  who was screened. `sanctions` is a public input deliberately — the list
  itself is meant to be auditable; only the counterparty stays private.
  Linear scan today; a Merkle-root version is a stretch goal. Called as a
  separate pre-check from the frontend, not composed into `private_transfer`.
- `issue(recipient, amount, memo) -> PaymentRecord` is demo scaffolding to
  create a spendable record. Not part of the real rail.

`PaymentRecord` holds `owner`, `amount`, `sender`, `memo`. There is no
`recipient` field — the recipient is the owner of the record the transfer
produces, so storing it separately would only add a correlation handle.

## Working on the Program

```bash
cd program
leo build
leo test
```

Requires Leo 4.4.1 (`cargo install leo-lang`).

## Stack

| Layer | Technology |
| :--- | :--- |
| Chain | Aleo (testnet) |
| Program language | Leo |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS v4 |
| Type | Newsreader (display), Inter (body) |

## Design

The visual language comes from `design.jpg`. The palette was sampled from that
image rather than approximated:

| Token | Value | Use |
| :--- | :--- | :--- |
| `--cream` | `#E7E5D9` | Page ground |
| `--paper` | `#F4F1E8` | Raised surfaces |
| `--ink` | `#101A1F` | Display type, dark fills |
| `--ink-soft` | `#4F5049` | Body copy |
| `--rule` | `#D3D0C2` | Hairlines, dividers |
| `--sage` | `#C3C9BF` | Illustration blocks |
| `--sage-deep` | `#6E7A70` | Small-caps eyebrows |
| `--accent` | `#EA6B3E` | Italic accents, markers |

It is a light editorial style — this deliberately replaces the dark theme used
by ARCANUM. Do not mix the two.

## Running the Frontend

```bash
npm install
npm run dev
```

Then open <http://localhost:3000> (`package.json`'s `dev` script has no
`-p` flag, so this is Next's default port).

## App Screens

Three screens under `/app`, sharing the landing page's editorial system —
same palette, same `.eyebrow` / `.display` / `.pull` type classes, same
`ArrowIcon` — extended with a small `.field` / `.pill` / `.dot` set for
forms and status states.

| Route | Screen | Notes |
| :--- | :--- | :--- |
| `/app` | Connect Wallet | Real connect for **both** Shield Wallet (marked Recommended) and Leo Wallet, each showing live install-state detection; otherwise an "Install" link per wallet, plus an explicit, clearly labeled "testnet demo mode" fallback (the funded address from the deployment table above) — never the silent default. |
| `/app/send` | Send Payment | Fetches the wallet's real unspent `PaymentRecord`s via `requestRecords(..., statusFilter: "unspent")` (with a manual-paste fallback), builds and submits a real `private_transfer` via `executeTransaction`, and polls `transactionStatus` through to a real on-chain transaction id. Demo-mode sessions still land on an honest "not broadcast, no real wallet connected" state rather than a fabricated hash. |
| `/app/compliance` | Compliance Status | Standalone sanctions checker with a real "Run on testnet" action for `prove_compliance` when a real wallet is connected, on top of the live, already-proven execution linked below. |

**Wallet connect supports Shield (recommended) and Leo Wallet.** Aleo's
own docs (`docs.aleo.org/participate/wallets/`) name Shield — not Leo —
as *"the recommended wallet for interacting with the Aleo ecosystem,"*
built by Provable with the Aleo Network Foundation; Leo stays available as
a widely-used alternative. Both run through Provable's official toolkit,
`@provablehq/aleo-wallet-adaptor-{core,react,shield,leo}` (confirmed
current via `npm view`, not assumed), which supersedes the
`@demox-labs/aleo-wallet-adapter-*` packages an earlier pass of this build
used (Leo-only, no Shield adapter existed for that toolkit). **Caveat
straight from the package itself**: `@provablehq/aleo-wallet-adaptor-shield`'s
own README calls itself *"(alpha)"* and *"a pre-release build"* — Shield
is the right long-term default per Aleo's own recommendation, but treat
the adapter wiring as newer and less battle-tested than Leo's.

**Installed with `--legacy-peer-deps`**: the adapter packages declare a
`react@^18.0.0` peer; this project is on React 19.2.8 — a stale peer
range, not a real incompatibility, but worth knowing it's there. `npm
audit` is clean (0 vulnerabilities) — switching off the old
`@demox-labs/aleo-wallet-adapter-leo` also happened to clear a
high-severity, no-fix-available `nanoid` advisory that package carried.

**Read `TODO (2).md`'s Day 7 section before demoing live.** This
environment still can't install a real Chrome extension or click through
a wallet-approval popup, so the integration was originally built blind
against the adapter packages' TypeScript types — but a user testing with a
**real, connected Shield Wallet** confirmed `requestRecords` genuinely
works end to end, and their logged response caught two real bugs the
guessed record shape had introduced: the balance display looked for
`data.amount` (real field: `recordView.fields.amount`) and, more
seriously, the Send button's enabled-check looked for a record's `id`
(real field: `uid`) — so Submit silently stayed disabled no matter what
was filled in, with no error explaining why. Both are fixed and confirmed
against that real response now, not guessed. What's still **not**
verified: submitting a real `private_transfer` through to confirmation
(the fix above unblocks trying it, but the actual broadcast hasn't been
watched succeed yet), and whether Leo Wallet's adapter normalizes records
the same way Shield's does — the old field-name guesses are kept as
fallbacks for that. `TransactionStatusResponse.transactionId` (the real
on-chain hash, once available) is still documented-not-observed the same
way it was before this fix. Confirm a full send-to-confirmation with a
real wallet before relying on it in the demo.

## Repository Layout

```text
app/
  page.tsx                Landing page
  layout.tsx               Fonts and metadata
  globals.css               Palette tokens, type utilities, field/pill/dot styles
  components/
    OriginFigure.tsx       Inline SVG origin illustration
    ArrowLink.tsx          Arrow link used to close a passage
    ArrowIcon.tsx           Shared arrow glyph (ArrowLink + app nav cards)
    Spinner.tsx             Loading spinner used across the app screens
  lib/
    wallet-context.tsx      Real wallet adapter context (connect, records, tx submit) + demo-mode fallback
    aleo.ts                 Program constants, fees, Transaction builders, record parsing, error mapping
    compliance.ts           Local prove_compliance approximation + demo fixtures
  app/
    layout.tsx              Shared nav shell + WalletProvider for the three screens
    page.tsx                 Connect Wallet screen
    send/page.tsx            Send Payment screen
    compliance/page.tsx      Compliance Status screen
program/
  program.json              veil_rails_v2.aleo manifest
  src/main.leo               The program
  tests/test_veil.leo        5 tests
design.jpg                  Visual reference the palette was sampled from
TODO (2).md                  8-day build plan
```
