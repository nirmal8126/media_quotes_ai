import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  generateCaptionContent,
  generateHashtagList,
  generateScriptAssets,
  storeGeneratedReel,
} from "@/lib/reel-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";
import { normalizeScriptCaptionRequest } from "@/lib/generation-normalize";
import type { ScriptCaptionRequest } from "@/types/generation";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCompletion } from "@/lib/openai";

type Payload = {
  topic?: string;
  description?: string;
  tone?: string;
  platform?: string;
  contentType?: string;
  length?: string;
  persona?: string;
  language?: string;
  hook?: string;
  variations?: number;
  provider?: "openai" | "gemini";
  script?: string;
  caption?: string;
  durationSec?: number;
  pace?: "slow" | "normal" | "fast";
  audience?: string;
  goal?: string;
  cta?: string;
  hookStyle?: string;
  mustInclude?: string;
  mustAvoid?: string;
  mode?: "generate" | "improve" | "rewrite" | "shorten" | "expand";
};

type StructuredOutput = {
  language: string;
  durationSec: number;
  targetWords: number;
  voiceoverScript: Array<{ t: string; line: string }>;
  onScreenCaptions: Array<{ t: string; text: string }>;
  postCaption: string;
  hashtags: string[];
  titleOptions?: string[];
  safety?: { copyrightRisk: string; notes?: string[] };
};

function cleanJsonLike(input: string) {
  return input.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function countWords(text: string) {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
}

function computeTargetWords(language: string, durationSec: number, pace: "slow" | "normal" | "fast") {
  const lang = (language || "en").toLowerCase();
  const base = lang === "hi" ? 2.0 : 2.2;
  const paceFactor = pace === "slow" ? 0.85 : pace === "fast" ? 1.15 : 1;
  return Math.max(20, Math.round(durationSec * base * paceFactor));
}

function buildPrompt(params: {
  topic: string;
  platform: string;
  tone: string;
  audience: string;
  goal: string;
  cta: string;
  durationSec: number;
  targetWords: number;
  hook?: string;
  hookStyle?: string;
  language?: string;
  mustInclude?: string;
  mustAvoid?: string;
  mode?: string;
  scriptSeed?: string;
  captionSeed?: string;
}) {
  const lines = [
    `You are writing a short-form ${params.platform} script and caption.`,
    `Language: ${params.language || "en"}. Audience: ${params.audience}. Goal: ${params.goal}. Tone: ${params.tone}.`,
    `Duration: ${params.durationSec}s. Target words: ${params.targetWords}. Pace must fit duration.`,
    params.hook ? `Hook: ${params.hook}.` : "",
    params.hookStyle ? `Hook style: ${params.hookStyle}.` : "",
    params.mustInclude ? `Must include: ${params.mustInclude}.` : "",
    params.mustAvoid ? `Must avoid: ${params.mustAvoid}.` : "",
    params.scriptSeed ? `Script seed (${params.mode || "generate"}): ${params.scriptSeed}` : "",
    params.captionSeed ? `Caption seed (${params.mode || "generate"}): ${params.captionSeed}` : "",
    `Return STRICT JSON ONLY with keys: language, durationSec, targetWords, voiceoverScript:[{t:"0-2s",line:"..."}], onScreenCaptions:[{t,text}], postCaption, hashtags (array), titleOptions (array), safety:{copyrightRisk:"low|medium|high",notes:[]}.`,
    params.cta && params.cta !== "none"
      ? `Include a CTA in the last 3-5 seconds: "${params.cta}" (soft tone for IG).`
      : "CTA: none requested.",
  ].filter(Boolean);
  return lines.join(" ");
}

function applyFixes(
  parsed: StructuredOutput,
  params: { targetWords: number; hook?: string; cta?: string; mustAvoid?: string },
): StructuredOutput {
  const clone: StructuredOutput = { ...parsed };
  clone.voiceoverScript = Array.isArray(parsed.voiceoverScript) ? [...parsed.voiceoverScript] : [];
  if (!clone.voiceoverScript.length) {
    clone.voiceoverScript = [{ t: "0-2s", line: params.hook || "Hook: listen up" }];
  }

  // Ensure hook at start
  if (params.hook && clone.voiceoverScript[0]) {
    if (!clone.voiceoverScript[0].line.toLowerCase().includes(params.hook.toLowerCase())) {
      clone.voiceoverScript.unshift({ t: "0-2s", line: params.hook });
    }
  }

  // Ensure CTA
  if (params.cta && params.cta !== "none") {
    const lastIdx = clone.voiceoverScript.length - 1;
    const ctaLine = `CTA: ${params.cta}`;
    if (lastIdx >= 0) {
      if (!clone.voiceoverScript[lastIdx].line.toLowerCase().includes(params.cta.toLowerCase())) {
        clone.voiceoverScript.push({ t: "last-cta", line: ctaLine });
      }
    } else {
      clone.voiceoverScript.push({ t: "cta", line: ctaLine });
    }
  }

  // Trim or pad to target words
  const flatScript = clone.voiceoverScript.map((v) => v.line).join(" ");
  const totalWords = countWords(flatScript);
  const lower = Math.floor(params.targetWords * 0.85);
  const upper = Math.ceil(params.targetWords * 1.15);
  if (totalWords > upper) {
    const trimmed = flatScript.split(" ").slice(0, params.targetWords).join(" ");
    clone.voiceoverScript = [{ t: `0-${parsed.durationSec || 0}s`, line: trimmed }];
  } else if (totalWords < lower) {
    const filler = `Quick tip: ${params.hook || "stay tuned"} for more.`;
    clone.voiceoverScript.push({ t: "pad", line: filler });
  }

  // Captions fallback
  if (!Array.isArray(parsed.onScreenCaptions) || !parsed.onScreenCaptions.length) {
    clone.onScreenCaptions = clone.voiceoverScript.map((v) => ({ t: v.t, text: v.line.slice(0, 60) }));
  }

  // Post caption
  clone.postCaption = parsed.postCaption || params.hook || "Watch till the end!";
  clone.hashtags = Array.isArray(parsed.hashtags) && parsed.hashtags.length ? parsed.hashtags : ["#learnonreels"];
  clone.safety = parsed.safety || { copyrightRisk: "low", notes: ["Original phrasing"] };

  // Must avoid
  if (params.mustAvoid) {
    clone.voiceoverScript = clone.voiceoverScript.map((v) => ({
      ...v,
      line: v.line.replace(new RegExp(params.mustAvoid, "gi"), ""),
    }));
    clone.postCaption = clone.postCaption.replace(new RegExp(params.mustAvoid, "gi"), "");
  }

  return clone;
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as Payload;
  const normalized: ScriptCaptionRequest = normalizeScriptCaptionRequest({
    contentType: body.contentType as ScriptCaptionRequest["contentType"],
    platform: body.platform as ScriptCaptionRequest["platform"],
    description: body.description ?? body.topic ?? "",
    tone: body.tone as ScriptCaptionRequest["tone"],
    length: body.length as ScriptCaptionRequest["length"],
    persona: body.persona ?? undefined,
    language: body.language ?? undefined,
    variations: body.variations,
  });
  if (!normalized.description) {
    const response = NextResponse.json({ error: "Topic/description is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const hook = (body.hook ?? "").trim() || undefined;
  const durationSec = Math.max(10, Math.min(Number(body.durationSec) || 30, 120));
  const pace = (body.pace as "slow" | "normal" | "fast") || "normal";
  const audience = body.audience || "general";
  const goal = body.goal || "educate";
  const cta = body.cta || "follow";
  const hookStyle = body.hookStyle || "question";
  const mustInclude = body.mustInclude || "";
  const mustAvoid = body.mustAvoid || "";
  const mode = (body.mode as Payload["mode"]) || "generate";
  const channelId = (body.channelId ?? body.channel_id ?? "").trim() || null;
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });
  const userScript = typeof body.script === "string" ? body.script.trim() : "";
  const userCaption = typeof body.caption === "string" ? body.caption.trim() : "";
  const targetWords = computeTargetWords(normalized.language || "en", durationSec, pace);

  async function generateStructured() {
    const prompt = buildPrompt({
      topic: normalized.description,
      platform: normalized.platform,
      tone: normalized.tone,
      audience,
      goal,
      cta,
      durationSec,
      targetWords,
      hook,
      hookStyle,
      language: normalized.language,
      mustInclude,
      mustAvoid,
      mode,
      scriptSeed: userScript,
      captionSeed: userCaption,
    });
    const raw = await generateCompletion(prompt, { temperature: 0.6, maxTokens: 700, provider });
    const cleaned = cleanJsonLike(raw);
    let parsed: StructuredOutput | null = null;
    try {
      parsed = JSON.parse(cleaned) as StructuredOutput;
    } catch {
      parsed = null;
    }
    if (!parsed) {
      // Fallback structured
      parsed = {
        language: normalized.language || "en",
        durationSec,
        targetWords,
        voiceoverScript: [{ t: "0-2s", line: hook || normalized.description }],
        onScreenCaptions: [],
        postCaption: userCaption || normalized.description,
        hashtags: ["#learnonreels"],
        safety: { copyrightRisk: "low", notes: ["Fallback"] },
        titleOptions: [normalized.description],
      };
    }
    const fixed = applyFixes(parsed, { targetWords, hook, cta, mustAvoid });
    return fixed;
  }

  try {
    const structured = await generateStructured();

    const scriptText = structured.voiceoverScript.map((v) => v.line).join(" ");
    const captionText = structured.postCaption || userCaption;
    const hashtags =
      structured.hashtags && structured.hashtags.length
        ? structured.hashtags
        : await generateHashtagList(normalized.tone, normalized.platform, provider);

    let recordId: string | null = null;
    try {
      const saved = await storeGeneratedReel({
        userId: user.id,
        channelId,
        status: "generated",
        tone: normalized.tone,
        platform: normalized.platform,
        hook: hook ?? (structured.voiceoverScript[0]?.line || ""),
        script: scriptText,
        caption: captionText,
        hashtags,
        thumbnailPrompt: normalized.description,
      });
      recordId = saved?.id ?? null;
    } catch (storeErr) {
      console.warn("Failed to persist generated reel; will continue without db id", storeErr);
    }

    // Fallback: persist directly to scripts table if reel persistence failed
    if (!recordId) {
      const { data, error } = await supabaseAdmin
        .from("scripts")
        .insert({
          user_id: user.id,
          platform: normalized.platform,
          tone: normalized.tone,
          input_prompt: normalized.description,
          text: scriptText,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (!error) {
        recordId = data?.id ?? null;
      }
    }

    const response = NextResponse.json({
      message: "Generated",
      normalized,
      variations: [
        {
          id: recordId ?? `local-${Date.now()}`,
          topic: normalized.description,
          tone: normalized.tone,
          platform: normalized.platform,
          hook: hook ?? (structured.voiceoverScript[0]?.line || ""),
          script: scriptText,
          caption: captionText,
          hashtags,
          created_at: new Date().toISOString(),
          structured,
        },
      ],
    });
    applyCookies(response);
    return response;
  } catch (err) {
    console.error("Failed to generate script/caption", err);
    const response = NextResponse.json({ error: "Unable to generate script/caption" }, { status: 500 });
    applyCookies(response);
    return response;
  }
}
