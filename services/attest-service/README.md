# Veil Attest Service

Oracle-signed attestation submission for `veil_attest_v2.aleo`. One endpoint,
running as a persistent Node process.

## Why this is a separate service

Attesting means generating a zero-knowledge proof. That needs a real
filesystem (two 66 MB proving keys), a lot of memory, and more wall-clock time
than a serverless function is allowed to run. Every deploy failure this project
hit was a variation of the same thing:

| Symptom | Actual cause |
| :--- | :--- |
| Attest 500s in production, fine locally | `program/build/` is gitignored, so the compiled bytecode was never in the deployed bundle — `fs.readFileSync` threw `ENOENT` |
| 128 MB key bundle | Vercel function size cap; keys wouldn't be traced into the bundle regardless |
| `LocalFileKeyStore` needed a `ts-expect-error` | Next.js resolved the SDK with browser types; in plain Node it imports cleanly |
| Timeouts | Proving takes far longer than a serverless function's limit |

A persistent host has a real filesystem, no per-invocation size cap, and no
cold-start timeout. Only this endpoint needed to move — the frontend and
`/api/audit` stay on Vercel, and were never the problem.

## What ships with it

```
program/veil_attest_v2.aleo   compiled bytecode, tracked in git on purpose
keys/.aleo/*.prover           pre-synthesized proving keys (~127 MB total)
keys/.aleo/*.verifier
src/index.ts                  the service
```

The bytecode and keys are force-tracked past `.gitignore` rules in the repo
root. That is deliberate: a missing bytecode file is precisely what broke the
serverless deploy, and it broke silently.

## Run locally

```bash
npm install && npm run build && npm start
```

With `.env` filled in from `.env.example`. Then point the frontend at it by
setting `NEXT_PUBLIC_ATTEST_SERVICE_URL=http://localhost:8080` in the root
`.env`, so local and deployed exercise the same code path.

## Deploy

Railway or Render, as a Node service. Root directory `services/attest-service`,
build `npm install && npm run build`, start `npm start`.

Set the env vars from `.env.example` in the host's dashboard. Confirm they are
scoped to the production deployment — a variable set in the wrong environment
is the same class of mistake that caused the original failure.

Two host-specific things worth checking:

- **Free tiers that sleep.** If the service spins down when idle, the first
  request after a nap pays a cold start on top of proving time. That would
  reintroduce a version of the original latency problem at the worst moment.
- **Request timeouts.** Proving takes real time. Confirm the host's default
  timeout is generous enough.

## Endpoints

### `GET /health`

Reports whether the bytecode loaded and the keys directory is present — the two
things that were missing in the serverless deploy.

```json
{ "ok": true, "program": "veil_attest_v2.aleo", "programLoaded": true, "keysPresent": true }
```

### `POST /attest`

Request and response shapes are unchanged from the old Next.js route, so this
is an endpoint swap rather than a payload redesign.

```jsonc
// request
{ "owner": "aleo1...", "inputHash": "123field", "verdict": true }

// response
{ "success": true, "transactionId": "at1...", "status": "accepted" }
```

Returns 400 on malformed input, 401 if `ATTEST_SHARED_SECRET` is set and the
`X-Attest-Secret` header doesn't match, 429 past 5 requests per minute per IP,
500 on execution failure.

## Boot-time preflight

The service refuses to start if the oracle key is unset, `ALLOWED_ORIGINS` is
empty or wildcarded, the bytecode is missing, or no `.prover` files are found.

This is the point of the whole exercise. The original bug was a missing file
that nothing noticed until a user tried to attest and got an opaque 500. A
service that won't boot is much easier to diagnose than one that boots and then
fails on the first real request.

## Security posture

`ATTEST_SHARED_SECRET` is not authentication. The frontend calls this endpoint
directly from the browser, so the value is delivered to every visitor and
anyone can read it from the network tab. It keeps casual callers off the
endpoint and nothing more.

The per-IP rate limiter is what actually protects the oracle's fee balance, and
it is in-memory — it resets on restart and does not coordinate across
instances. For a hackathon build that is fine. Anything longer-lived wants a
shared store and a real auth story.

CORS is restricted to named origins. Wildcards are rejected at boot.
