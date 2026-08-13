import { NextResponse } from "next/server";
import { Account, AleoNetworkClient, AleoKeyProvider, NetworkRecordProvider, ProgramManager, LocalFileKeyStore } from "@provablehq/sdk";
import { ALEO_ADDRESS_PATTERN } from "../../lib/attestation";
import fs from "fs";
import path from "path";

// In-memory rate limiting map (IP -> { count, resetTime })
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const maxRequests = 5;

  const record = rateLimitMap.get(ip);
  if (!record) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  if (now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return false;
  }

  record.count += 1;
  return record.count > maxRequests;
}

export async function POST(request: Request) {
  // 1. Rate limiting
  const ip = request.headers.get("x-forwarded-for") || "unknown-ip";
  if (checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute before attesting again." },
      { status: 429 }
    );
  }

  let account: Account | null = null;

  try {
    const body = await request.json();
    const { owner, inputHash, verdict } = body;

    // 2. Input validation
    if (!owner || typeof owner !== "string" || !ALEO_ADDRESS_PATTERN.test(owner.trim())) {
      return NextResponse.json({ error: "Invalid target owner Aleo address." }, { status: 400 });
    }
    if (!inputHash || typeof inputHash !== "string" || !inputHash.endsWith("field")) {
      return NextResponse.json({ error: "Invalid input commitment hash. Must end with 'field'." }, { status: 400 });
    }
    if (typeof verdict !== "boolean") {
      return NextResponse.json({ error: "Verdict must be a boolean." }, { status: 400 });
    }

    const privateKey = process.env.ORACLE_PRIVATE_KEY;
    if (!privateKey || privateKey.startsWith("APrivateKey1zkp...")) {
      return NextResponse.json({ error: "Oracle private key is not configured on the server." }, { status: 500 });
    }

    console.log(`[Attest API] Initializing Aleo SDK ProgramManager for ${owner.trim()} on testnet...`);

    const endpoint = process.env.ALEO_ENDPOINT || "https://api.explorer.provable.com/v1";
    const programId = process.env.PROGRAM_ID || "veil_attest_v2.aleo";

    // Read local compiled program bytecode
    const programPath = path.resolve(process.cwd(), "program/build/veil_attest_v2/veil_attest_v2.aleo");
    const programSource = fs.readFileSync(programPath, "utf-8");

    // 3. Initialize Aleo SDK components
    account = new Account({ privateKey });
    const networkClient = new AleoNetworkClient(endpoint);
    const keyProvider = new AleoKeyProvider();
    keyProvider.useCache(true);
    const keyStore = new LocalFileKeyStore(path.resolve(process.cwd(), "keys"));
    const recordProvider = new NetworkRecordProvider(account, networkClient);
    const programManager = new ProgramManager(endpoint, keyProvider, recordProvider);
    programManager.setAccount(account);
    programManager.setKeyStore(keyStore);

    console.log(`[Attest API] Launching execution for ${owner.trim()} on testnet via SDK...`);

    const txId = await programManager.execute({
      programName: programId,
      functionName: "submit_attestation",
      program: programSource,
      priorityFee: 0.0035, // 3,500 microcredits public execution fee
      privateFee: false, // public fee
      inputs: [owner.trim(), inputHash.trim(), String(verdict)],
      privateKey: account.privateKey(),
    });

    console.log(`[Attest API] Transaction broadcast confirmed: ${txId}`);

    // Securely destroy sensitive key material
    account.destroy();
    account = null;

    return NextResponse.json({
      success: true,
      transactionId: txId,
      status: "accepted",
    });
  } catch (err: any) {
    console.error("[Attest API] Request error:", err);

    if (account) {
      try {
        account.destroy();
      } catch (destroyErr) {
        console.error("[Attest API] Error destroying account in catch block:", destroyErr);
      }
    }

    const message = err?.message || String(err);
    let errorMsg = "Zero-knowledge proof execution failed.";
    if (message.includes("InsufficientFee") || message.includes("insufficient credit balance")) {
      errorMsg = "Server oracle has insufficient credit balance to pay transaction fees.";
    } else if (message.includes("mempool") || message.includes("rejected")) {
      errorMsg = "Transaction was rejected by the network mempool.";
    } else if (message.includes("timeout")) {
      errorMsg = "Network timeout while broadcasting execution.";
    }

    return NextResponse.json(
      { error: errorMsg, details: message },
      { status: 500 }
    );
  }
}
