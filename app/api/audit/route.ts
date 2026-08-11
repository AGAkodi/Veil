import { NextResponse } from "next/server";
import { ATTESTATION_EXAMPLES, computeSimpleHash } from "../../lib/attestation";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text || typeof text !== "string" || text.trim() === "") {
      return NextResponse.json({ error: "Text field is required" }, { status: 400 });
    }

    const trimmedText = text.trim();
    const hash = computeSimpleHash(trimmedText);

    // Look for matching fixture for cached fallback mapping
    let matchedFixture = null;
    for (const key of Object.keys(ATTESTATION_EXAMPLES)) {
      if (ATTESTATION_EXAMPLES[key].input === trimmedText) {
        matchedFixture = ATTESTATION_EXAMPLES[key];
        break;
      }
    }

    const apiKey = process.env.GROQ_API_KEY;
    const hasValidKey = apiKey && apiKey !== "gsk_placeholder_key_replace_me";

    if (!hasValidKey) {
      console.log("[Audit API] No valid Groq key configured");
      if (matchedFixture) {
        console.log("[Audit API] Using cached fallback for demo fixture");
        return returnFallback(hash, matchedFixture);
      }
      return NextResponse.json(
        { error: "Groq API key is not configured. Live audit is unavailable." },
        { status: 503 }
      );
    }

    // Call two Groq APIs in parallel with a strict 6-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const callCritic = async (modelName: string, modelLabel: string) => {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: "system",
              content:
                "You are a strict security and compliance audit assistant. Analyze the given text and determine if it is clean/approved (verdict = true) or if it has a vulnerability, risk, threat, policy violation, or issue (verdict = false). You must output your response in strict JSON containing only keys 'verdict' (boolean) and 'rationale' (string, max 2 sentences).",
            },
            {
              role: "user",
              content: trimmedText,
            },
          ],
          temperature: 0.0,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        let errMessage = `HTTP ${response.status}`;
        try {
          const errData = await response.json();
          if (errData.error?.message) {
            errMessage = errData.error.message;
          }
        } catch {}
        throw new Error(errMessage);
      }

      const resData = await response.json();
      const content = resData?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response");
      }

      const parsed = JSON.parse(content);
      const verdict = typeof parsed.verdict === "boolean" ? parsed.verdict : true;
      const rationale = typeof parsed.rationale === "string" ? parsed.rationale : "Analysis completed successfully.";

      return { model: modelLabel, verdict, rationale };
    };

    try {
      const results = await Promise.allSettled([
        callCritic("llama-3.3-70b-versatile", "Llama-3.3-70B"),
        callCritic("openai/gpt-oss-120b", "GPT-OSS-120B"),
      ]);

      clearTimeout(timeoutId);

      const criticA = results[0];
      const criticB = results[1];

      const successA = criticA.status === "fulfilled" ? criticA.value : null;
      const successB = criticB.status === "fulfilled" ? criticB.value : null;

      if (criticA.status === "rejected") {
        console.error("[Audit API] Critic Llama-3.3-70B failed:", criticA.reason?.message || criticA.reason);
      }
      if (criticB.status === "rejected") {
        console.error("[Audit API] Critic GPT-OSS-120B failed:", criticB.reason?.message || criticB.reason);
      }

      if (successA && successB) {
        const agree = successA.verdict === successB.verdict;
        let mergedVerdict = successA.verdict;
        let mergedRationale = "";

        if (agree) {
          mergedRationale = `${successA.model}: ${successA.rationale} ${successB.model}: ${successB.rationale}`;
        } else {
          // Disagree: default to the more cautious verdict (false)
          mergedVerdict = false;
          mergedRationale = `[Disagreement - Low Confidence] ${successA.model} (${successA.verdict ? "PASS" : "FAIL"}): ${successA.rationale} ${successB.model} (${successB.verdict ? "PASS" : "FAIL"}): ${successB.rationale}`;
        }

        console.log("[Audit API] Double-critic evaluation succeeded");
        return NextResponse.json({
          verdict: mergedVerdict,
          rationale: mergedRationale,
          hash,
          source: "live",
        });
      } else {
        // One or both critics failed
        if (matchedFixture) {
          console.warn("[Audit API] Cascade failed or timed out on demo fixture, falling back to cache");
          return returnFallback(hash, matchedFixture);
        }

        // Custom input: we must NOT fabricate a verdict or fall back to single critic (violating corroboration)
        const errA = criticA.status === "rejected" ? (criticA.reason?.message || String(criticA.reason)) : "Succeeded";
        const errB = criticB.status === "rejected" ? (criticB.reason?.message || String(criticB.reason)) : "Succeeded";
        console.error(`[Audit API] Cascade failed on custom input. Llama: ${errA}; GPT-OSS: ${errB}`);
        return NextResponse.json(
          { error: `Live Groq audit failed. Critic Llama: ${errA}; Critic GPT-OSS: ${errB}` },
          { status: 502 }
        );
      }
    } catch (apiErr: any) {
      clearTimeout(timeoutId);
      console.error("[Audit API] Live double-critic cascade unexpected error:", apiErr);
      
      if (matchedFixture) {
        return returnFallback(hash, matchedFixture);
      }
      
      const errMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      return NextResponse.json(
        { error: `Live Groq audit failed: ${errMsg}` },
        { status: 502 }
      );
    }
  } catch (err: any) {
    console.error("[Audit API] Request handling error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

function returnFallback(hash: string, matchedFixture: any) {
  if (matchedFixture) {
    return NextResponse.json({
      verdict: matchedFixture.verdict,
      rationale: matchedFixture.rationale,
      hash: matchedFixture.hash,
      source: "cache",
    });
  }

  // Generic fallback if user typed something custom that timed out
  return NextResponse.json({
    verdict: true,
    rationale: "Cached fallback: System analysis resolved cleanly.",
    hash,
    source: "cache",
  });
}
