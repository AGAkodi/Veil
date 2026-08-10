import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { ALEO_ADDRESS_PATTERN } from "../../lib/attestation";

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

    // 3. Child process setup
    const leoPath = "C:\\Users\\User\\.cargo\\bin\\leo.exe";
    const programDir = path.resolve(process.cwd(), "program");
    const cmd = `"${leoPath}" execute --network testnet --endpoint https://api.explorer.provable.com/v1 --broadcast --yes submit_attestation ${owner.trim()} ${inputHash.trim()} ${verdict}`;

    console.log(`[Attest API] Launching execution for ${owner.trim()} on testnet...`);

    const env = {
      ...process.env,
      PRIVATE_KEY: privateKey,
    };

    return new Promise<NextResponse>((resolve) => {
      // 5-minute timeout for proof generation and network broadcast confirmation
      exec(cmd, { cwd: programDir, env, timeout: 300000 }, (error, stdout, stderr) => {
        if (error) {
          console.error("[Attest API] Child process execution error:", error);
          console.error("[Attest API] Stderr:", stderr);

          // Parse known error reasons to return clean messages
          let errorMsg = "Zero-knowledge proof execution failed.";
          if (stderr.includes("InsufficientFee")) {
            errorMsg = "Server oracle has insufficient credit balance to pay transaction fees.";
          } else if (stderr.includes("mempool") || stderr.includes("rejected")) {
            errorMsg = "Transaction was rejected by the network mempool.";
          } else if (stderr.includes("timeout") || error.message.includes("timeout")) {
            errorMsg = "Network timeout while broadcasting execution.";
          }

          resolve(
            NextResponse.json(
              { error: errorMsg, details: stderr.trim() || error.message },
              { status: 500 }
            )
          );
          return;
        }

        // 4. Parse transaction ID
        const txMatch = stdout.match(/transaction ID:\s+'(at1[a-z0-9]+)'/i);
        const txId = txMatch ? txMatch[1] : null;

        if (!txId) {
          console.error("[Attest API] Transaction broadcasted but ID was not parsed from stdout:", stdout);
          resolve(
            NextResponse.json(
              { error: "Attestation broadcasted but transaction ID could not be resolved from output." },
              { status: 500 }
            )
          );
          return;
        }

        console.log(`[Attest API] Transaction broadcast confirmed: ${txId}`);
        resolve(
          NextResponse.json({
            success: true,
            transactionId: txId,
            status: "accepted",
          })
        );
      });
    });
  } catch (err: any) {
    console.error("[Attest API] Request error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}
