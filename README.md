# Veil — Private Institutional Payment Rails on Aleo

Confidential, compliant payments for institutions, built on Aleo — where record
encryption is a property of the protocol rather than something the application
has to construct.

## Status

Early build. What is and is not true today, kept honest deliberately:

| Piece | State |
| :--- | :--- |
| Landing page | Built, builds clean, verified in browser |
| `veil.aleo` program | Written, compiles clean (1.55 KB), 5/5 tests passing locally |
| Testnet deployment | **None** — no funded account yet |
| Mainnet | None |
| Wallet integration | Not started |

"Tests passing" means `leo test` locally. Nothing has touched a network.

No program ID or transaction hash appears in this README until there is a real
one on an explorer to link.

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
- `prove_compliance(counterparty, sanctions) -> bool` proves a counterparty is
  absent from a published sanctions list without revealing who was screened.
  Linear scan today; a Merkle-root version is a stretch goal.
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

Then open http://localhost:3007.

## Repository Layout

```
app/
  page.tsx              Landing page
  layout.tsx            Fonts and metadata
  globals.css           Palette tokens and type utilities
  components/
    OriginFigure.tsx    Inline SVG origin illustration
    ArrowLink.tsx       Arrow link used to close a passage
program/
  program.json          veil.aleo manifest
  src/main.leo          The program
  tests/test_veil.leo   5 tests
design.jpg              Visual reference the palette was sampled from
TODO (2).md             8-day build plan
```
