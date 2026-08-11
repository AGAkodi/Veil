# Veil — Verifiable AI Attestation on Aleo

Confidential, verifiable AI agent verdicts on Aleo — where record encryption is a property of the protocol rather than something the application has to construct.

## Status

Early build. What is and is not true today, kept honest deliberately:

| Piece | State |
| :--- | :--- |
| Landing page | Built, builds clean, verified in browser |
| `veil_attest_v2.aleo` program | Written, compiles clean (1.36 KB), 5/5 tests passing locally |
| Testnet deployment | **Live** — see below |
| Live AI Audit endpoint | **Operational** — calls Groq LLM with a 6s timeout and cached fixture fallback |
| Server-Signed Attestation | **Executed** — confirmed live on testnet (TX: `at1kz04tmrh76ukp4en69lmq4rqqlc8sp4pp4fkz5f02q04q8lf9c8s0l85rl`) |
| Mappings on testnet | **Verified** — readable and correct (Total Attestations = 2u64, Flagged = 0u64) |
| `verify_attestation` on testnet | Tested — blocked on Provable's statePaths API returning `502 Bad Gateway` for record-consuming calls (as expected under known risks list). Simulated fallback fully functional. |
| Mainnet | None |
| Wallet integration | Completed (Shield & Leo Wallet) with demo mode fallback (used for /verify) |

"Tests passing" means `leo test` locally.

## Testnet Deployment

| | |
| :--- | :--- |
| Program ID | `veil_attest_v2.aleo` |
| Network | Aleo testnet |
| Deploy tx | [`at1smf5gp4r4hcn9szftdsx820ce9uqrntcg2zxenphmdh2f2u5kspq8auhzj`](https://explorer.provable.com/transaction/at1smf5gp4r4hcn9szftdsx820ce9uqrntcg2zxenphmdh2f2u5kspq8auhzj) |
| `submit_attestation` server execution tx | [`at1kz04tmrh76ukp4en69lmq4rqqlc8sp4pp4fkz5f02q04q8lf9c8s0l85rl`](https://explorer.provable.com/transaction/at1kz04tmrh76ukp4en69lmq4rqqlc8sp4pp4fkz5f02q04q8lf9c8s0l85rl) |

The program deploys under `veil_attest_v2.aleo` (14 characters) rather than `veil.aleo` (4 characters) to avoid Aleo's namespace fee constraints.

## Why This Exists

Running AI evaluations on public ledgers exposes private training data, medical scans, or proprietary code. Veil records AI agent verdicts on Aleo, where input commitments are encrypted at the protocol layer. Verification and binding proofs are generated in zero knowledge. The chain confirms the attestation happened and learns nothing else.

## Server-Signing Architecture

To deliver a native "AI agent actually attests" experience without requiring the visitor to hold or connect the oracle's private wallet, Veil implements a server-signing architecture:
1. **Off-Chain Audit**: The visitor initiates an audit. The frontend calls the backend `/api/audit` route which evaluates the input target.
2. **On-Chain Attestation**: When the visitor clicks "Commit On-Chain," the frontend calls `/api/attest` which uses the server-stored `ORACLE_PRIVATE_KEY` to execute the zero-knowledge transaction. The backend signs and broadcasts the proof natively to the Aleo network using the native `leo` CLI.
3. **Abuse Protection**: The `/api/attest` endpoint enforces an in-memory IP rate limiter (maximum 5 requests per minute) to safeguard the oracle's credit fee balance.

## Audit Architecture (Two-Critic Deterministic Cascade)

Veil implements a deterministic double-critic corroboration engine for off-chain audits:
1. **Three Input Modes**:
   - **Aleo Program ID (Flagship)**: Paste a deployed program ID (e.g. `credits.aleo` or `veil_attest_v2.aleo`). Veil fetches the compiled Leo source code directly from the Provable API, validates its size under a **50KB cap**, and feeds it to the critics.
   - **GitHub URL**: Paste a link to any public file on GitHub. Veil converts blob-viewer links to raw content URLs, fetches the plain text with a **5-second timeout**, validates that it is not HTML/JSON, and audits it.
   - **Raw Paste (Fallback)**: Users can paste raw code or plaintext reports to audit directly.
2. **Double-Critic Execution**: Executes two parallel API calls to Groq at a temperature of `0` (for verdict consistency):
   - **Critic A**: `llama-3.3-70b-versatile` (flagship dense model)
   - **Critic B**: `mixtral-8x7b-32768` (Mixtral MoE architecture, ensuring distinct model reasoning)
3. **Corroboration Rule**:
   - If both critics agree, the verdict is confirmed.
   - If they disagree, the engine defaults to the more cautious verdict (`false` / vulnerable) and marks the result as lower confidence (`[Disagreement - Low Confidence]`).
   - If one critic times out or fails on a custom input, the system proceeds with the active critic's verdict flagged as `[Single-critic fallback - Low Confidence]`. If both fail or a timeout occurs on a demo fixture, it falls back to the pre-computed two-critic cache.

### Security Limitation Note
Unlike Solidity-focused developer security tools, there is no underlying static-analysis backstop (like Slither or Aderyn) for the Leo language. Safety and compliance judgments in Veil are based entirely on LLM reasoning and pattern analysis. It is intended as a verifiable heuristic layer, not a formal verification guarantee.

## Two Roles

Veil is built with a two-sided framing consisting of two distinct personas, both executing real on-chain actions:
1. **The Oracle Node (Attester)**: Evaluates private inputs off-chain and executes the `submit_attestation` transition to securely commit the verdict on-chain. This registers a public count increment and generates a private `Attestation` record encrypted to the designated owner.
2. **The Auditor (Verifier)**: Screens and audits on-chain verdicts without viewing the underlying raw input data. Executes `verify_attestation` on the target record with a claimed commitment hash to cryptographically confirm that the verdict matches the committed input.

## Marketplace Fit

Who plugs into Veil's architecture?
- **Compliance Vendors**: Screen addresses or data against sanctions lists privately, attesting to cleanliness while allowing DAOs or DeFi protocols to verify the check happened without publishing screened addresses.
- **AI Infrastructure Providers**: Run expensive model evaluations off-chain (e.g. credit risk or security audits) and commit cryptographic evaluation certificates on-chain so clients can verify their validity.
- **DAOs and Moderation Pools**: Outsource content moderation to third-party agents, verifying moderation verdicts securely without exposing private messages or content logs on a public ledger.

The oracle-gated model acts as a trust primitive: rather than building a closed application, protocols build on top of Veil's verifiable, gated commitments to integrate private audit loops into their smart contracts.

## Public Aggregate Mappings & Privacy Boundary

Veil includes a public aggregate-attestation counter to track totals while preserving individual privacy:
- `total_attestations`: tracks the running count of all attestations issued (key `0u8`).
- `total_flagged`: tracks the count of attestations where the verdict was negative (`verdict == false`, key `0u8`).

### Privacy Boundary:
- **Public**: The summary counts (`total_attestations` and `total_flagged`) are public on-chain mapping values that anyone can query.
- **Private**: The individual attestation records, including their owner address, input commitment hash, and verdicts, are fully encrypted records. They remain private to the disclosure holder until selectively verified on-chain via ZK proof.

## Program Surface

Two entry points in `program/src/main.leo`. Declared as `fn` per Leo 4.4.1 conventions:

- `submit_attestation(public owner: address, private input_hash: field, public verdict: bool) -> (Attestation, Final)`
  Gated to a hardcoded oracle key (`ORACLE_ADDRESS`). Creates a private `Attestation` record owned by the target address, and returns a `Final` block that:
  - Increments `total_attestations` by 1.
  - Increments `total_flagged` by 1 if `verdict == false`.
- `verify_attestation(att: Attestation, public claimed_hash: field) -> (bool, Attestation)`
  Consumes the private `Attestation` record and verifies if it binds the `claimed_hash`. Re-creates the record on output to allow multiple verification checks without permanently burning the record.

## Working on the Program

```bash
cd program
leo build
leo test
```

Requires Leo 4.4.1.

## Stack

| Layer | Technology |
| :--- | :--- |
| Chain | Aleo (testnet) |
| Program language | Leo |
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Vanilla CSS |
| Type | Newsreader (display), Inter (body) |

## Environment Configurations

Copy `.env.example` to `.env` and configure the following:

- `NEXT_PUBLIC_ORACLE_ADDRESS`: The public address representing the oracle key (safe to expose, defaults to the contract's constant address).
- `ORACLE_PRIVATE_KEY`: **Server-only secret**. The private key of the oracle account that signs transactions. Must never be prefixed with `NEXT_PUBLIC_` or committed.
- `GROQ_API_KEY`: **Server-only secret**. The API token for Groq LLM model evaluations.

## Running the Frontend

```bash
npm install
npm run dev
```

Then open <http://localhost:3000>.

## App Screens

Three screens under `/app`, sharing the landing page's editorial system:

| Route | Screen | Notes |
| :--- | :--- | :--- |
| `/app` | Connect Wallet | Detects Shield Wallet (Recommended) and Leo Wallet, with a testnet demo mode fallback using our funded testnet address. |
| `/app/attest` | Submit Attestation | Two-step console. Runs an off-chain AI Audit via `/api/audit`, then commits the verdict on-chain via `/api/attest` using the server's oracle account. Displays the public stats strip. |
| `/app/verify` | Verify Attestation | Selects/pastes an `Attestation` record, inputs a claimed hash, and runs `verify_attestation` using the auditor's connected browser wallet to verify validity without revealing the input on-chain. |

## Future Work

The following items are deliberately cut from the current MVP scope:
- **Leo Static Analysis Tooling**: Integrating formal static analysis and syntax validation engines for the Leo language if/when such tooling becomes available.
- **Broader URL Support**: Supporting non-GitHub code hosting repositories (e.g. GitLab, Gitea) or generalized raw text URL fetches.
- **Program Source Caching**: Implementing database or key-value caching for resolved program source codes to avoid redundant API queries.
- **Attestation Revocation**: Invalidate a previously issued attestation via status mapping checks inside `verify_attestation`.
- **Multi-Oracle Support**: Replacing the hardcoded `ORACLE_ADDRESS` constant with an on-chain registry mapping of trusted agent addresses.
- **Per-Oracle Stats**: Providing detailed per-oracle or category-specific public breakdowns.
- **Secrets Management**: Transitioning the oracle keys from environment variables into a secure cloud HSM (Hardware Security Module) or secrets manager.

## Repository Layout

```text
app/
  page.tsx                Landing page
  layout.tsx              Fonts and metadata
  globals.css             Palette tokens, type utilities, field/pill/dot styles
  components/
    OriginFigure.tsx      Inline SVG origin illustration
    ArrowLink.tsx         Arrow link used to close a passage
    ArrowIcon.tsx         Shared arrow glyph (ArrowLink + app nav cards)
    Spinner.tsx           Loading spinner used across the app screens
  lib/
    wallet-context.tsx    Real wallet adapter context (connect, records, tx submit) + demo-mode fallback
    aleo.ts               Program constants, fees, Transaction builders, record parsing, error mapping
    attestation.ts        AI agent mock fixtures and address validators
  app/
    layout.tsx            Shared nav shell + WalletProvider for the three screens
    page.tsx              Connect Wallet screen
    attest/page.tsx       Submit Attestation screen (with public stats strip)
    verify/page.tsx       Verify Attestation screen
  api/
    audit/route.ts        Live LLM audit evaluator (Groq chat completion + cached fallback)
    attest/route.ts       Server-signed on-chain attest broadcaster (native child process execution)
program/
  program.json            veil_attest_v2.aleo manifest
  src/main.leo            The program (mappings + transitions + finalize)
  tests/test_veil.leo     5 tests (verifying mapping increments)
design.jpg                Visual reference the palette was sampled from
TODO.md                   4-day build plan
```
