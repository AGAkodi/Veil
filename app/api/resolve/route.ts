import { NextResponse } from "next/server";
import { fetchProgramSource } from "../../lib/aleo";

// Set a size cap of 50KB for fetched sources
const SIZE_CAP = 50 * 1024; // 50,000 characters (approx 50KB)

function normalizeGithubUrl(urlString: string): string {
  let url = urlString.trim();
  if (!/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "github.com") {
      const pathname = parsed.pathname;
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length >= 4 && (parts[2] === "blob" || parts[2] === "raw")) {
        const owner = parts[0];
        const repo = parts[1];
        const branch = parts[3];
        const rest = parts.slice(4).join("/");
        return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${rest}`;
      }
    }
    return url;
  } catch {
    return url;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, target } = body;

    if (!type || typeof type !== "string") {
      return NextResponse.json({ error: "Type field is required" }, { status: 400 });
    }

    if (!target || typeof target !== "string" || target.trim() === "") {
      return NextResponse.json({ error: "Target field is required" }, { status: 400 });
    }

    const trimmedTarget = target.trim();

    if (type === "program") {
      try {
        const sourceCode = await fetchProgramSource(trimmedTarget);
        
        if (sourceCode.length > SIZE_CAP) {
          return NextResponse.json(
            { error: `Program source code length (${sourceCode.length} chars) exceeds size limit of 50KB` },
            { status: 400 }
          );
        }
        
        return NextResponse.json({ sourceCode });
      } catch (err: any) {
        if (err.message === "Program not found") {
          return NextResponse.json({ error: "Program not found" }, { status: 404 });
        }
        return NextResponse.json({ error: err.message || "Failed to resolve program" }, { status: 500 });
      }
    } else if (type === "url") {
      try {
        const normalizedUrl = normalizeGithubUrl(trimmedTarget);
        
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(normalizedUrl);
        } catch {
          return NextResponse.json({ error: "Invalid URL structure" }, { status: 400 });
        }

        if (parsedUrl.hostname !== "raw.githubusercontent.com" && parsedUrl.hostname !== "github.com") {
          return NextResponse.json(
            { error: "Only GitHub links (github.com or raw.githubusercontent.com) are supported." },
            { status: 400 }
          );
        }

        // Hardened fetch with 5 second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let res: Response;
        try {
          res = await fetch(normalizedUrl, { signal: controller.signal });
        } catch (fetchErr: any) {
          if (fetchErr.name === "AbortError") {
            return NextResponse.json({ error: "Fetch request timed out after 5s." }, { status: 504 });
          }
          return NextResponse.json({ error: `Network error: ${fetchErr.message}` }, { status: 502 });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!res.ok) {
          return NextResponse.json(
            { error: `GitHub returned HTTP ${res.status}. Please check the URL and file existence.` },
            { status: res.status >= 500 ? 502 : 400 }
          );
        }

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("html") || contentType.includes("json")) {
          return NextResponse.json(
            { error: "Target URL does not point to plain text source code (HTML/JSON returned)." },
            { status: 400 }
          );
        }

        const sourceCode = await res.text();

        if (sourceCode.length > SIZE_CAP) {
          return NextResponse.json(
            { error: `Resolved content length (${sourceCode.length} chars) exceeds size limit of 50KB` },
            { status: 400 }
          );
        }

        if (sourceCode.trim().startsWith("<!DOCTYPE html") || sourceCode.trim().startsWith("<html")) {
          return NextResponse.json(
            { error: "Resolved content appears to be HTML page rather than plain text source code." },
            { status: 400 }
          );
        }

        return NextResponse.json({ sourceCode });
      } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to resolve URL source code" }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: `Unsupported resolution type: ${type}` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[Resolve API] Request handling error:", err);
    return NextResponse.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
}

