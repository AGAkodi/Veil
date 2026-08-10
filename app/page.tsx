import Link from "next/link";
import { ArrowLink } from "./components/ArrowLink";
import { OriginFigure } from "./components/OriginFigure";

const guarantees = [
  {
    n: "01",
    title: "AI verdicts settle as records, not entries",
    body: "An attestation record is encrypted to the owner's view key. The off-chain model input description, hash, and verdict are inputs to a proof, never public ledger rows.",
  },
  {
    n: "02",
    title: "Selective disclosure is native",
    body: "Verification consumes the attestation record and returns a recreated record alongside a match verdict in zero-knowledge. This proves commitment validity without exposing the input hash on-chain until verification.",
  },
  {
    n: "03",
    title: "The explorer shows a nullifier",
    body: "What an observer sees on-chain is a transaction hash and spent-record markers. The input commitments and verdicts remain private to the disclosure holder until verified.",
  },
];

const contrast = [
  {
    label: "ARCANUM — Stellar",
    lead: "Privacy as application code",
    body: "A shielded pool and two Noir circuits, maintained by us, sitting on a ledger that records every transfer in the clear. The guarantee was only ever as strong as the code around it.",
    tone: "muted" as const,
  },
  {
    label: "Veil — Aleo",
    lead: "Privacy as the protocol",
    body: "Records are encrypted by the network itself. There is no pool to maintain and no ledger to hide from, because the base layer never held the plaintext to begin with.",
    tone: "accent" as const,
  },
];

export default function Home() {
  return (
    <>
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-7 sm:px-10">
        <span className="display text-[1.375rem] tracking-tight">Veil</span>
        <nav className="hidden items-center gap-9 text-[0.8125rem] text-ink-soft sm:flex">
          <a className="hover:text-ink" href="#origin">
            Origin
          </a>
          <a className="hover:text-ink" href="#guarantees">
            Guarantees
          </a>
          <a className="hover:text-ink" href="#difference">
            Difference
          </a>
        </nav>
        <Link
          href="/app"
          className="inline-flex bg-ink px-4 py-2 text-[0.75rem] font-semibold text-cream sm:text-[0.8125rem]"
        >
          Open the app
        </Link>
      </header>

      <main className="flex-1">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="mx-auto w-full max-w-6xl px-6 pt-14 pb-24 sm:px-10 sm:pt-24 sm:pb-32">
          <p className="eyebrow">Verifiable AI Attestation</p>
          <h1 className="display mt-6 max-w-4xl text-[2.5rem] sm:text-[4rem] lg:text-[4.75rem]">
            AI agents cannot attest on a ledger that{" "}
            <span className="display-accent">publishes every input.</span>
          </h1>
          <div className="prose-body mt-9 grid max-w-4xl gap-x-14 gap-y-5 md:grid-cols-2">
            <p>
              Running AI evaluations on public ledgers exposes private training data,
              medical scans, or proprietary code. For enterprises, that is not a tradeoff
              to manage — it is a leakage vector to competitors and counterparties.
            </p>
            <p>
              Veil records AI agent verdicts on Aleo, where input commitments are encrypted
              at the protocol layer. Verification and binding proofs are generated in zero
              knowledge. The chain confirms the attestation happened and learns nothing else.
            </p>
          </div>
          <div className="mt-11 flex flex-wrap items-center gap-x-8 gap-y-4">
            <ArrowLink href="#origin">Read the origin</ArrowLink>
            <span className="text-[0.8125rem] text-ink-soft">
              Testnet build in progress — no mainnet deployment yet.
            </span>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <hr className="border-rule" />
        </div>

        {/* ── Origin — the layout from design.jpg ──────────────── */}
        <section
          id="origin"
          className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10 sm:py-28"
        >
          <div className="grid items-center gap-14 lg:grid-cols-2 lg:gap-20">
            <OriginFigure className="w-full max-w-[440px] justify-self-center" />

            <div>
              <p className="eyebrow">A project with an origin</p>
              <h2 className="display mt-5 text-[2.125rem] sm:text-[2.875rem]">
                It started as a shielded pool called{" "}
                <span className="display-accent">ARCANUM.</span>
              </h2>
              <div className="prose-body mt-7 space-y-5 max-w-lg">
                <p>
                  Its first job was simple: let an institution check compliance and make a
                  payment on Stellar without publishing the details. Two Noir circuits, a
                  Soroban verifier, a pool to hold value. It worked.
                </p>
                <p>
                  Repeated use exposed a larger problem. The privacy was ours,
                  not the chain&apos;s — it lived in circuits we wrote and a
                  pool we maintained, on a ledger built to reveal. Every
                  guarantee had our code as its weakest link, and the
                  plaintext was always one integration mistake away.
                </p>
              </div>
              <p className="pull mt-7">
                The rest, as they say, is history.
              </p>
              <div className="mt-7">
                <ArrowLink href="#difference">
                  See what changed on Aleo
                </ArrowLink>
              </div>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <hr className="border-rule" />
        </div>

        {/* ── Guarantees ──────────────────────────────────────── */}
        <section
          id="guarantees"
          className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10 sm:py-28"
        >
          <p className="eyebrow">What the protocol guarantees</p>
          <h2 className="display mt-5 max-w-2xl text-[2.125rem] sm:text-[2.875rem]">
            Three properties, and{" "}
            <span className="display-accent">none of them optional.</span>
          </h2>

          <div className="mt-14 grid gap-px bg-rule sm:grid-cols-3">
            {guarantees.map((g) => (
              <article key={g.n} className="bg-cream px-0 sm:px-7 sm:first:pl-0">
                <div className="flex items-center gap-3">
                  <span className="font-sans text-[0.6875rem] font-semibold tracking-[0.16em] text-accent">
                    {g.n}
                  </span>
                  <span className="h-px flex-1 bg-rule" />
                </div>
                <h3 className="display mt-4 text-[1.375rem] leading-snug">
                  {g.title}
                </h3>
                <p className="mt-3 pb-9 text-[0.9375rem] leading-relaxed text-ink-soft sm:pb-0">
                  {g.body}
                </p>
              </article>
            ))}
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6 sm:px-10">
          <hr className="border-rule" />
        </div>

        {/* ── Difference ──────────────────────────────────────── */}
        <section
          id="difference"
          className="mx-auto w-full max-w-6xl px-6 py-20 sm:px-10 sm:py-28"
        >
          <div className="grid gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)] lg:gap-20">
            <div>
              <p className="eyebrow">The difference</p>
              <h2 className="display mt-5 text-[2.125rem] sm:text-[2.875rem]">
                Privacy stopped being{" "}
                <span className="display-accent">our responsibility.</span>
              </h2>
              <p className="mt-7 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
                The same thesis, moved one layer down. What ARCANUM had to
                construct, Veil inherits — and what it inherits cannot be
                misconfigured away.
              </p>
            </div>

            <div className="space-y-px bg-rule">
              {contrast.map((c) => (
                <div key={c.label} className="bg-cream py-7 first:pt-0">
                  <p
                    className={`eyebrow ${
                      c.tone === "accent" ? "!text-accent" : ""
                    }`}
                  >
                    {c.label}
                  </p>
                  <h3 className="display mt-3 text-[1.5rem]">{c.lead}</h3>
                  <p className="mt-2.5 max-w-xl text-[0.9375rem] leading-relaxed text-ink-soft">
                    {c.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-9 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <span className="display text-[1.125rem]">Veil</span>
          <p className="text-[0.8125rem] text-ink-soft">
            Verifiable AI Attestation on Aleo.
          </p>
          <span className="eyebrow">Aleo Testnet</span>
        </div>
      </footer>
    </>
  );
}
