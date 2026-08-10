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
    label: "The usual approach",
    lead: "Privacy as application code",
    body: "An access layer bolted on after the fact that someone has to maintain, sitting on a public ledger not built to hide anything. The privacy guarantee is only as strong as the code surrounding it.",
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
          <div className="mt-12 grid gap-6 md:grid-cols-2 max-w-4xl">
            <div className="border border-ink bg-paper p-6 relative group">
              <span className="font-sans text-[0.6875rem] font-semibold tracking-[0.16em] text-accent uppercase">
                Oracle Node Role
              </span>
              <h3 className="display mt-2 text-[1.5rem] font-semibold text-ink">
                Submit an attestation
              </h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-soft">
                Securely record AI agent verdicts on-chain. Generate input commitments and encrypt disclosure records under the holder's key.
              </p>
              <div className="mt-6">
                <Link
                  href="/app/attest"
                  className="inline-flex bg-ink px-4 py-2.5 text-[0.8125rem] font-semibold text-cream hover:bg-ink-soft"
                >
                  Open Oracle Console &rarr;
                </Link>
              </div>
            </div>

            <div className="border border-rule bg-cream p-6 relative group">
              <span className="font-sans text-[0.6875rem] font-semibold tracking-[0.16em] text-ink-soft uppercase">
                Auditor Role
              </span>
              <h3 className="display mt-2 text-[1.5rem] font-semibold text-ink">
                Audit a verdict
              </h3>
              <p className="mt-2 text-[0.875rem] leading-relaxed text-ink-soft">
                Audit on-chain commitments without exposing off-chain private inputs. Verify that the agent executed cleanly on the claimed data.
              </p>
              <div className="mt-6">
                <Link
                  href="/app/verify"
                  className="inline-flex border border-ink px-4 py-2.5 text-[0.8125rem] font-semibold text-ink hover:bg-paper"
                >
                  Open Auditor Console &rarr;
                </Link>
              </div>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
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
              <p className="eyebrow">The core premise</p>
              <h2 className="display mt-5 text-[2.125rem] sm:text-[2.875rem]">
                AI agents increasingly make{" "}
                <span className="display-accent">consequential calls.</span>
              </h2>
              <div className="prose-body mt-7 space-y-5 max-w-lg">
                <p>
                  Decisions like security verdicts, credit assessments, or moderation flags are executed on data nobody else can see. Once posted, there is no way to check that a verdict was genuinely computed from what is claimed, without exposing the sensitive input data itself.
                </p>
                <p>
                  Veil binds each verdict to a cryptographic commitment of its input, encrypted at the protocol layer rather than an application-level permission layer. Anyone can verify the verdict is genuine, while no one ever sees the input.
                </p>
              </div>
              <p className="pull mt-7">
                Privacy and auditability, unified.
              </p>
              <div className="mt-7">
                <ArrowLink href="#difference">
                  See how the protocol does this
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
                Privacy is not{" "}
                <span className="display-accent">an option.</span>
              </h2>
              <p className="mt-7 max-w-md text-[0.9375rem] leading-relaxed text-ink-soft">
                Most systems add privacy as a separate layer that can be misconfigured, bypassed, or skipped. Veil starts from a protocol where privacy was never separate to begin with.
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
