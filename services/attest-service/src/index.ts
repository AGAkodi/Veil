/**
 * Veil attest service.
 *
 * Why this exists as a separate process: submitting an attestation means
 * generating a zero-knowledge proof, which needs a real filesystem (66 MB
 * proving keys), a lot of memory, and more wall-clock time than a serverless
 * function is allowed to run. Every previous deploy failure traced back to
 * trying to do that inside a Vercel function.
 *
 * The Next.js frontend and /api/audit stay on Vercel. Only this endpoint moved.
 */

import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  Account,
  AleoNetworkClient,
  AleoKeyProvider,
  NetworkRecordProvider,
  ProgramManager,
  LocalFileKeyStore,
} from "@provablehq/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICE_ROOT = path.resolve(__dirname, "..");

const ALEO_ADDRESS_PATTERN = /^aleo1[a-z0-9]{58}$/;

// Proving is slow and each call costs real testnet credits, so the limiter is
// deliberately tight. This is the only thing standing between a public
// endpoint and a drained fee balance.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

// ---------------------------------------------------------------------------
// Config, resolved once at boot
// ---------------------------------------------------------------------------

const PORT = Number(process.env.PORT) || 8080;
const ENDPOINT = process.env.ALEO_ENDPOINT || "https://api.explorer.provable.com/v1";
const PROGRAM_ID = process.env.PROGRAM_ID || "veil_attest_v2.aleo";
const ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const SHARED_SECRET = process.env.ATTEST_SHARED_SECRET;
const PRIORITY_FEE = Number(process.env.PRIORITY_FEE ?? 0.0035);

const KEYS_DIR = path.resolve(SERVICE_ROOT, "keys");
const PROGRAM_PATH = path.resolve(SERVICE_ROOT, "program", `${PROGRAM_ID}`);

// Wildcard origins are refused: this endpoint spends real credits, so it does
// not get to be callable from any page on the internet.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

/**
 * Fail at boot, not on the first real request.
 *
 * The original bug was exactly this shape: the program bytecode lived under a
 * gitignored build/ directory, so the deployed service looked healthy right up
 * until someone tried to attest and got an ENOENT wrapped in a 500.
 */
function preflight(): string {
  const problems: string[] = [];

  if (!ORACLE_PRIVATE_KEY) {
    problems.push("ORACLE_PRIVATE_KEY is not set.");
  } else if (ORACLE_PRIVATE_KEY.startsWith("APrivateKey1zkp...")) {
    problems.push("ORACLE_PRIVATE_KEY is still the placeholder value.");
  }

  if (ALLOWED_ORIGINS.length === 0) {
    problems.push(
      "ALLOWED_ORIGINS is not set. Set it to the frontend origin, e.g. https://veil.vercel.app"
    );
  }
  if (ALLOWED_ORIGINS.includes("*")) {
    problems.push("ALLOWED_ORIGINS contains '*'. This endpoint spends credits; name the origin explicitly.");
  }

  if (!fs.existsSync(PROGRAM_PATH)) {
    problems.push(
      `Program bytecode missing at ${PROGRAM_PATH}. ` +
        `Regenerate with 'cd program && leo build' and copy build/${PROGRAM_ID.replace(".aleo", "")}/${PROGRAM_ID} here.`
    );
  }

  if (!fs.existsSync(KEYS_DIR)) {
    problems.push(`Proving keys directory missing at ${KEYS_DIR}.`);
  } else {
    const provers = fs
      .readdirSync(path.join(KEYS_DIR, ".aleo"), { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".prover"));
    if (provers.length === 0) {
      problems.push(`No .prover files found under ${KEYS_DIR}/.aleo.`);
    }
  }

  if (problems.length > 0) {
    throw new Error("Preflight failed:\n  - " + problems.join("\n  - "));
  }

  return fs.readFileSync(PROGRAM_PATH, "utf-8");
}

const programSource = preflight();

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  record.count += 1;
  return record.count > RATE_LIMIT_MAX;
}

// Without this the map grows unbounded for the life of the process.
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap) {
    if (now > record.resetTime) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const app = express();

app.set("trust proxy", 1); // Railway/Render sit behind a proxy; needed for real client IPs
app.use(express.json({ limit: "16kb" }));
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Attest-Secret"],
    maxAge: 86400,
  })
);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    program: PROGRAM_ID,
    endpoint: ENDPOINT,
    // Proves the two things that were missing in the serverless deploy.
    programLoaded: programSource.length > 0,
    keysPresent: fs.existsSync(KEYS_DIR),
  });
});

app.post("/attest", async (req, res) => {
  const ip = req.ip || "unknown-ip";

  if (isRateLimited(ip)) {
    return res.status(429).json({
      error: "Too many requests. Please wait a minute before attesting again.",
    });
  }

  // A browser-delivered secret is not a real secret — see README. This only
  // keeps casual callers off the endpoint; the rate limiter is the real guard.
  if (SHARED_SECRET && req.header("X-Attest-Secret") !== SHARED_SECRET) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const { owner, inputHash, verdict } = req.body ?? {};

  if (!owner || typeof owner !== "string" || !ALEO_ADDRESS_PATTERN.test(owner.trim())) {
    return res.status(400).json({ error: "Invalid target owner Aleo address." });
  }
  if (!inputHash || typeof inputHash !== "string" || !inputHash.trim().endsWith("field")) {
    return res.status(400).json({ error: "Invalid input commitment hash. Must end with 'field'." });
  }
  if (typeof verdict !== "boolean") {
    return res.status(400).json({ error: "Verdict must be a boolean." });
  }

  let account: Account | null = null;

  try {
    console.log(`[attest] executing submit_attestation for ${owner.trim()} on ${PROGRAM_ID}`);
    const startedAt = Date.now();

    account = new Account({ privateKey: ORACLE_PRIVATE_KEY! });
    const networkClient = new AleoNetworkClient(ENDPOINT);
    const keyProvider = new AleoKeyProvider();
    keyProvider.useCache(true);
    const keyStore = new LocalFileKeyStore(KEYS_DIR);
    const recordProvider = new NetworkRecordProvider(account, networkClient);
    const programManager = new ProgramManager(ENDPOINT, keyProvider, recordProvider);
    programManager.setAccount(account);
    programManager.setKeyStore(keyStore);

    const txId = await programManager.execute({
      programName: PROGRAM_ID,
      functionName: "submit_attestation",
      program: programSource,
      priorityFee: PRIORITY_FEE,
      privateFee: false,
      inputs: [owner.trim(), inputHash.trim(), String(verdict)],
      privateKey: account.privateKey(),
    });

    console.log(`[attest] broadcast ${txId} in ${Date.now() - startedAt}ms`);

    account.destroy();
    account = null;

    // Shape matches what the frontend already expects — this is an endpoint
    // swap, not a payload redesign.
    return res.json({ success: true, transactionId: txId, status: "accepted" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[attest] failed:", message);

    if (account) {
      try {
        account.destroy();
      } catch {
        // already destroyed or unusable; nothing further to do
      }
    }

    let errorMsg = "Zero-knowledge proof execution failed.";
    if (message.includes("InsufficientFee") || message.includes("insufficient credit balance")) {
      errorMsg = "Server oracle has insufficient credit balance to pay transaction fees.";
    } else if (message.includes("mempool") || message.includes("rejected")) {
      errorMsg = "Transaction was rejected by the network mempool.";
    } else if (message.includes("timeout")) {
      errorMsg = "Network timeout while broadcasting execution.";
    }

    return res.status(500).json({ error: errorMsg, details: message });
  }
});

app.listen(PORT, () => {
  console.log(`[attest] listening on :${PORT}`);
  console.log(`[attest] program ${PROGRAM_ID} via ${ENDPOINT}`);
  console.log(`[attest] allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`[attest] shared secret: ${SHARED_SECRET ? "enforced" : "not set"}`);
});
