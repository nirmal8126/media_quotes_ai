import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider, generateCompletion } from "@/lib/openai";

type Payload = {
  text?: string;
  url?: string;
  platform?: string;
  tone?: string;
  count?: number;
  maxLengthSec?: number;
  provider?: "openai" | "gemini";
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const body = (await request.json().catch(() => ({}))) as Payload;
  const longText = (body.text ?? "").trim();
  const url = (body.url ?? "").trim();
  if (!longText && !url) {
    const response = NextResponse.json({ error: "Provide long text or URL to break down." }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const count = Math.max(2, Math.min(Number(body.count) || 5, 15));
  const tone = (body.tone || "informative").trim();
  const platform = (body.platform || "instagram_reels").trim();
  const maxLengthSec = Math.max(20, Math.min(Number(body.maxLengthSec) || 45, 120));
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });

  const prompt = [
    `Break the following content into ${count} short-form video scripts for ${platform}.`,
    `Tone: ${tone}. Target duration: <= ${maxLengthSec} seconds each.`,
    "Return JSON array; each item: { title, hook, script, hashtags }.",
    "Source content:",
    longText || `URL: ${url} (summarize and split key points)`,
  ].join("\n");

  const raw = await generateCompletion(prompt, { temperature: 0.65, maxTokens: 1200, provider });
  let scripts: Array<{ title: string; hook: string; script: string; hashtags: string[] }> = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      scripts = parsed
        .map((item) => ({
          title: String(item.title || "").trim(),
          hook: String(item.hook || "").trim(),
          script: String(item.script || "").trim(),
          hashtags: Array.isArray(item.hashtags)
            ? item.hashtags.map((h: string) => (h.startsWith("#") ? h : `#${h}`)).slice(0, 8)
            : [],
        }))
        .filter((item) => item.script);
    }
  } catch {
    // fallback: split raw by double newlines
    const parts = raw.split(/\n{2,}/).slice(0, count);
    scripts = parts.map((p, idx) => ({
      title: `Clip ${idx + 1}`,
      hook: p.split("\n")[0] || `Hook ${idx + 1}`,
      script: p.trim(),
      hashtags: [],
    }));
  }

  const response = NextResponse.json({
    message: "Long-form broken into short scripts",
    scripts,
  });
  applyCookies(response);
  return response;
}
