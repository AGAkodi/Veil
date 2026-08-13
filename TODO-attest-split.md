# Veil — Split Attest Service — Status

Working copy of the split-service plan, annotated with what is actually done.
Everything unchecked below needs your accounts or your keys — I can't do it for
you.

## Root cause, confirmed

The plan's diagnosis was right, and there was a more basic bug underneath it:

**`program/build/` is gitignored, so the compiled `veil_attest_v2.aleo`
bytecode was never in the deployed bundle.** The old route did
`fs.readFileSync(process.cwd() + "program/build/veil_attest_v2/...")`, which
worked locally (the file is there from `leo build`) and threw `ENOENT` on
Vercel every time. Verified: `git ls-files program/build` returns 0 files.

The size/timeout/runtime problems in the plan are all real too — they just
weren't the first thing to fire.

---

## 0. Platform Choice

- [ ] Pick Railway or Render, create the service — **yours to do**
- [ ] Connect it to this repo, root directory `services/attest-service`

## 1. Extract the Attest Service

- [x] Separate minimal app (the plan's recommendation) — Express + TypeScript at `services/attest-service/`
- [x] Signing logic moved out of `app/api/attest/route.ts` into `POST /attest`
- [x] `keys/` moved to `services/attest-service/keys/` via `git mv` (stayed tracked)
- [x] Compiled bytecode copied to `services/attest-service/program/veil_attest_v2.aleo` and **force-tracked in `.gitignore`** — this is the actual fix for the root cause
- [x] Runs a plain Node process, no serverless abstraction. `LocalFileKeyStore` now imports with no `ts-expect-error`, confirming that ambiguity was Next-specific
- [x] Request validation before the SDK call (address shape, `field` suffix, boolean verdict)
- [x] Old `app/api/attest/route.ts` deleted — leaving it would preserve a path that only ever works locally, which is how this hid

## 2. Env Vars — New Service

- [ ] Set `ORACLE_PRIVATE_KEY` on the host — **yours**
- [ ] Confirm host env vars are scoped to the production deployment
- [x] `PORT` read from `process.env.PORT`, defaults to 8080
- [x] `.env.example` written

## 3. Env Vars — Vercel

- [ ] Add `NEXT_PUBLIC_ATTEST_SERVICE_URL` on Vercel once the service has a URL — **yours**
- [x] `GROQ_API_KEY` stays on Vercel, `/api/audit` untouched
- [ ] Remove `ORACLE_PRIVATE_KEY` from Vercel after cutover — **yours**

## 4. Frontend Change

- [x] Attest handler now posts to `${NEXT_PUBLIC_ATTEST_SERVICE_URL}/attest`
- [x] Fails with an explicit config error if the URL is unset, rather than posting to `undefined/attest`
- [x] Request/response shape unchanged — endpoint swap, not a payload redesign

## 5. CORS

- [x] Named origins only via `ALLOWED_ORIGINS`; wildcard rejected at boot
- [x] Verified: allowed origin gets `Access-Control-Allow-Origin`, disallowed origin gets no header
- [ ] Test from the real deployed frontend — **needs the deploy**

## 6. Security

- [x] Per-IP rate limiting, 5/min. Verified on a fresh process: requests 1–5 pass, 6th returns 429
- [x] Limiter map is swept periodically so it can't grow unbounded
- [x] Optional `X-Attest-Secret` shared header
- [x] **Documented honestly:** the frontend calls this from the browser, so that secret ships to every visitor and is not authentication. The rate limiter is the real guard.

## 7. Testing

- [x] Standalone: `/health` reports `programLoaded` and `keysPresent`; validation returns 400/401 correctly
- [x] Reached execution with a valid payload — fails on the fake key with "Invalid private key", proving CORS, validation, bytecode load, and key lookup all succeed
- [x] No `leo` CLI dependency anywhere in the service
- [ ] **Real attestation landing on-chain** — needs the real `ORACLE_PRIVATE_KEY`. Nothing here has been proven against the live network.
- [ ] Full flow through the deployed frontend
- [ ] Watch latency and host timeout

---

## Boot-time preflight (added, not in the original plan)

The service refuses to start if the oracle key is unset, `ALLOWED_ORIGINS` is
empty or wildcarded, the bytecode is missing, or no `.prover` files exist.

Verified by deleting the bytecode and starting it — it refuses with the exact
path and the command to regenerate. The original bug was invisible until a user
tried to attest; now it's impossible to deploy past.

---

## Separately: `.env` desync found

The local `.env` had drifted from `.env.example` — the exact failure on the
risk watch-list:

- `PROGRAM_ID` and `NEXT_PUBLIC_PROGRAM_ID` were **`veil_rails_v2.aleo`**, the
  old payment-rails program, which has no `submit_attestation` function. Fixed
  to `veil_attest_v2.aleo`.
- `ORACLE_PRIVATE_KEY` was missing entirely, so `/api/attest` would have
  returned "Oracle private key is not configured on the server" locally too.
- `GROQ_API_KEY` and `NEXT_PUBLIC_ORACLE_ADDRESS` are still missing — **add
  them yourself**, I won't put keys in.

## Also spotted, not actioned

- `rustup-init.exe` (12 MB Windows installer) is committed at the repo root.
  Almost certainly accidental.
- `program/src/main.leo` header comment says `veil_attest.aleo`; the program is
  `veil_attest_v2.aleo`.
