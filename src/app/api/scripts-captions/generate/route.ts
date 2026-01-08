import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
import {
  generateStructuredScript,
  type Goal,
  type HookStyle,
  type Pace,
  type ScriptGenInput,
} from "@/lib/ai/generateStructuredScript";
import { generateHashtagList } from "@/lib/reel-service";
import { pickProvider } from "@/lib/llm-provider";
import { getTextProviders } from "@/lib/ai/providers";
import { normalizeScriptCaptionRequest } from "@/lib/generation-normalize";
import type { ScriptCaptionRequest } from "@/types/generation";
import { supabaseAdmin } from "@/lib/supabase";
export type ScriptSectionType = "hook" | "setup" | "value" | "steps" | "cta";

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
  mode?: "generate" | "improve" | "rewrite" | "shorten" | "expand" | "repair";
  regenerate?: boolean;
  channelId?: string;
  channel_id?: string;
};

function computeSha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function stripLabels(text: string) {
  return text
    .replace(/\b(hook|intro|conclusion|outro)\s*[:\-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

type ScriptSection = { tStart: number; tEnd: number; type: ScriptSectionType; text: string };

function buildFallbackSections(topic: string, cta: string, durationSec: number): ScriptSection[] {
  const topicClean = topic.trim();
  const hook = `Struggling with ${topicClean.toLowerCase()}? Here's a simple way to start today.`;

  const step1 = `Step 1: Make it tiny. Pick one 5-minute action you can do right now.`;
  const step2 = `Step 2: Remove one distraction. Put your phone away or close extra tabs.`;
  const step3 = `Step 3: Track a win. Write down what you finished and repeat tomorrow.`;

  const closing = cta && cta !== "none"
    ? (cta === "follow" ? "Follow for more tips like this." : `Do it now — and ${cta}.`)
    : "Save this and try it today.";

  // Spread time across sections
  const hookEnd = Math.max(2, Math.floor(durationSec * 0.2));
  const valueEnd = Math.max(hookEnd + 6, Math.floor(durationSec * 0.85));

  const valueText =
    durationSec <= 30
      ? `${step1} ${step2}`
      : `${step1} ${step2} ${step3}`;

  return [
    { tStart: 0, tEnd: hookEnd, type: "hook", text: hook },
    { tStart: hookEnd, tEnd: valueEnd, type: "value", text: valueText },
    { tStart: valueEnd, tEnd: durationSec, type: "cta", text: closing },
  ];
}


function isLowQualityScript(text: string, topic: string) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return true;
  const words = cleaned.split(" ").filter(Boolean);
  if (words.length < 35) return true;
  const unique = new Set(words.map((w) => w.toLowerCase()));
  const uniqueRatio = unique.size / Math.max(words.length, 1);
  if (uniqueRatio < 0.32) return true;
  const lowered = cleaned.toLowerCase();
  const topicLower = topic.toLowerCase();
  const repeats = lowered.split(topicLower).length - 1;
  return repeats >= 6;
}

async function fetchPreviousTexts(params: {
  userId: string;
  platform: string;
  language: string;
  topicHash: string;
}) {
  const { userId, platform, language, topicHash } = params;
  const selectCols = "text, script, output_json";

  let { data, error } = await supabaseAdmin
    .from("scripts")
    .select(selectCols)
    .eq("user_id", userId)
    .eq("platform", platform)
    .eq("language", language)
    .eq("topic_hash", topicHash)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (msg.includes("language")) {
      // Fallback if language column is missing
      ({ data, error } = await supabaseAdmin
        .from("scripts")
        .select(selectCols)
        .eq("user_id", userId)
        .eq("platform", platform)
        .eq("topic_hash", topicHash)
        .order("created_at", { ascending: false })
        .limit(10));
    }
  }

  if (error) return [];

  return (
    data
      ?.map((row: any) => row?.text || row?.script || row?.output_json?.script?.text || "")
      .filter((t: string) => typeof t === "string" && t.trim().length > 0) || []
  );
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

  const durationSec = Math.max(10, Math.min(Number(body.durationSec) || 30, 120));
  const pace: Pace = (body.pace as Pace) || "normal";
  const audience = body.audience || "general";
  const goal = (["educate", "motivate", "entertain", "sell", "story"].includes(body.goal || "")
    ? body.goal
    : "educate") as Goal;
  const cta = (body.cta || "follow").trim() || "follow";
  const hookStyle = (body.hookStyle as HookStyle) || "best";
  const mustInclude = body.mustInclude || "";
  const mustAvoid = body.mustAvoid || "";
  const mode = (body.mode as Payload["mode"]) || "generate";
  const regenerate = body.regenerate === true;
  const providerPref = pickProvider({ bodyProvider: body.provider, user, fallback: "gemini" as any });
  const { primary, fallback } = getTextProviders({
    primary: providerPref === "openai" ? "openai" : "gemini",
  });

  const allowSeed = regenerate || mode === "repair";
  const userScript = allowSeed && typeof body.script === "string" ? body.script.trim() : "";
  const userCaption = allowSeed && typeof body.caption === "string" ? body.caption.trim() : "";
  const sanitizedHook = allowSeed && typeof body.hook === "string" ? body.hook.trim() : "";
  const durationBucket = durationSec <= 30 ? "30" : durationSec <= 45 ? "45" : "60";
  const topicScope = [
    normalized.description.trim().toLowerCase(),
    normalized.platform,
    normalized.language || DEFAULT_LANGUAGE,
    durationBucket,
    normalized.contentType,
    goal,
  ].join("|");
  const topic_hash = computeSha256(topicScope);
  const language = normalized.language || DEFAULT_LANGUAGE;

  console.log("[scripts-captions] generate", {
    mode,
    regenerate,
    durationSec,
    contentType: normalized.contentType,
    topic: normalized.description,
    hasIncomingScript: !!body.script,
  });

  const previousTexts = await fetchPreviousTexts({
    userId: user.id,
    platform: normalized.platform,
    language,
    topicHash: topic_hash,
  });

  const structuredInput: ScriptGenInput = {
    topic: normalized.description,
    description: normalized.description,
    contentType: (normalized.contentType || "script_and_caption") as ScriptGenInput["contentType"],
    platform: (normalized.platform as ScriptGenInput["platform"]) || "instagram_reels",
    tone: normalized.tone || "informative",
    language,
    durationSec,
    pace,
    audience,
    goal,
    cta,
    hookStyle,
    persona: body.persona || null,
    mustInclude: mustInclude || null,
    mustAvoid: mustAvoid || null,
    mode,
    seedScript: userScript || null,
    seedCaption: userCaption || null,
    previousTexts,
  };

  try {
    const structured = await generateStructuredScript(structuredInput, { primary, fallback });

    let sections = structured.script?.sections ?? [];
    let source: "ai" | "fallback" = "ai";

    // helper to build text consistently
    const joinSections = (secs: typeof sections) =>
      secs.map((s) => stripLabels(s.text || "")).join(" ").replace(/\s+/g, " ").trim();

    // 1) Candidate from AI
    let scriptTextCandidate = joinSections(sections);

    const issuesCount = structured.qc?.issues?.length ?? 0;
    const useFallback =
      !sections.length ||
      !scriptTextCandidate ||
      issuesCount >= 3;

    if (useFallback) {
      console.warn("[scripts-captions] using fallback (initial)", {
        issues: structured.qc?.issues,
        issuesCount,
        sectionsLen: sections.length,
        hasText: !!scriptTextCandidate,
      });
      sections = buildFallbackSections(normalized.description, cta, durationSec);
      source = "fallback";
      scriptTextCandidate = joinSections(sections);
    }

    // 2) Normalize section texts AFTER final sections chosen
    sections = sections.map((s) => ({
      ...s,
      text: stripLabels(s.text || normalized.description),
    }));

    let scriptText = joinSections(sections);

    // 3) Low-quality fallback ONLY if AI was used (avoid overriding fallback with fallback again)
    if (source === "ai" && isLowQualityScript(scriptText, normalized.description)) {
      console.warn("[scripts-captions] ai_script_low_quality -> fallback", {
        issues: structured.qc?.issues,
      });
      sections = buildFallbackSections(normalized.description, cta, durationSec).map((s) => ({
        ...s,
        text: stripLabels(s.text || normalized.description),
      }));
      scriptText = joinSections(sections);
      source = "fallback";
    }

    // Caption logic stays same
    let captionText = stripLabels(structured.caption?.text || userCaption || normalized.description);
    let hashtags = structured.caption?.hashtags ?? [];

    if (!hashtags.length) {
      hashtags = await generateHashtagList(structuredInput.tone, structuredInput.platform, providerPref);
    }
    if (!captionText) {
      captionText = normalized.description;
    }


    const responsePayload = {
      script: {
        title: normalized.description,
        sections,
      },
      caption: {
        text: captionText,
        hashtags,
      },
      qc: structured.qc,
    };

    const basePayload: Record<string, unknown> = {
      user_id: user.id,
      platform: normalized.platform,
      tone: normalized.tone,
      language,
      input_prompt: normalized.description,
      hook: sanitizedHook || null,
      audience: audience || null,
      topic_hash,
      module: "scripts",
      caption: captionText,
      qc: structured.qc,
      duration_sec: durationSec,
      output_json: {
        ...responsePayload,
        metadata: {
          userEdited: false,
          language,
          module: "scripts",
          topic_hash,
        },
      },
      created_at: new Date().toISOString(),
    };

    async function insertWith(field: "text" | "script") {
      return supabaseAdmin
        .from("scripts")
        .insert({ ...basePayload, [field]: scriptText })
        .select("id, hook, audience, input_prompt, text, script, tone, platform, created_at")
        .maybeSingle();
    }

    let recordId: string | null = null;
    let firstError: Error | null = null;

    const firstTry = await insertWith("text");
    if (!firstTry.error) {
      recordId = firstTry.data?.id ?? null;
    } else {
      firstError = new Error(firstTry.error.message);
      const msg = firstTry.error.message.toLowerCase();
      const retryPayload = { ...basePayload };

      if (msg.includes("hook")) {
        delete (retryPayload as any).hook;
      }
      if (msg.includes("audience")) {
        delete (retryPayload as any).audience;
      }
      if (msg.includes("module")) {
        delete (retryPayload as any).module;
      }
      if (msg.includes("topic_hash")) {
        delete (retryPayload as any).topic_hash;
      }
      if (msg.includes("language")) {
        delete (retryPayload as any).language;
      }
      if (msg.includes("duration_sec")) {
        delete (retryPayload as any).duration_sec;
      }
      if (msg.includes("output_json")) {
        delete (retryPayload as any).output_json;
      }
      if (msg.includes("qc")) {
        delete (retryPayload as any).qc;
      }
      if (msg.includes("caption")) {
        delete (retryPayload as any).caption;
      }

      if (msg.includes("text") && msg.includes("schema cache")) {
        const fallbackInsert = await supabaseAdmin
          .from("scripts")
          .insert({ ...retryPayload, script: scriptText })
          .select("id, hook, audience, input_prompt, text, script, tone, platform, created_at")
          .maybeSingle();
        if (!fallbackInsert.error) {
          recordId = fallbackInsert.data?.id ?? null;
        } else {
          console.error("Script insert fallback failed", fallbackInsert.error);
        }
      } else {
        const retry = await supabaseAdmin
          .from("scripts")
          .insert({ ...retryPayload, text: scriptText })
          .select("id, hook, audience, input_prompt, text, script, tone, platform, created_at")
          .maybeSingle();
        if (!retry.error) {
          recordId = retry.data?.id ?? null;
        } else {
          console.error("Script insert retry failed", retry.error);
        }
      }
    }

    if (!recordId) {
      const response = NextResponse.json(
        {
          error:
            firstError?.message ||
            "Unable to save script. Ensure the scripts table has a text column (refresh Supabase schema cache) or apply docs/sql/full_schema.sql.",
        },
        { status: 500 },
      );
      applyCookies(response);
      return response;
    }

    const response = NextResponse.json({
      message: "Generated",
      normalized,
      script: responsePayload.script,
      caption: responsePayload.caption,
      qc: responsePayload.qc,
      id: recordId ?? `local-${Date.now()}`,
      variations: [
        {
          id: recordId ?? `local-${Date.now()}`,
          topic: normalized.description,
          tone: normalized.tone,
          platform: normalized.platform,
          hook: sections.find((s) => s.type === "hook")?.text ?? null,
          script: scriptText,
          caption: captionText,
          hashtags,
          language,
          created_at: new Date().toISOString(),
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
