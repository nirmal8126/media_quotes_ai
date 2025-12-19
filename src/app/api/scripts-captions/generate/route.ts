import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  generateCaptionContent,
  generateHashtagList,
  generateScriptAssets,
} from "@/lib/reel-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider, generateCompletion } from "@/lib/openai";
import { normalizeScriptCaptionRequest } from "@/lib/generation-normalize";
import type { ScriptCaptionRequest } from "@/types/generation";
import { supabaseAdmin } from "@/lib/supabase";
import { buildRepairPrompt, normalizeTopic, runQualityChecks, toSections, topicHash } from "@/lib/script-qc";
import { pickTemplate } from "@/lib/scriptTemplates";

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
  script?: { title?: string; sections?: Array<{ tStart: number; tEnd: number; type?: string; text: string }> };
  caption?: { text?: string; hashtags?: string[] };
  qc?: { issues?: string[]; fixesApplied?: string[] };
};

function cleanJsonLike(input: string) {
  return input.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function stripLabels(text: string) {
  return text
    .replace(/\b(hook|intro|conclusion|outro)\s*[:\-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
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
  template: Array<{ tStart: number; tEnd: number; type: string }>;
}) {
  const lines = [
    "You are a professional short-form content writer for social media.",
    `Platform: ${params.platform}. Tone: ${params.tone}. Audience: ${params.audience || "general"}. Language: ${params.language || "en"}.`,
    `Topic: ${params.topic}. Duration: ${params.durationSec} seconds. Target words (guidance): ${params.targetWords}. Goal: ${params.goal}.`,
    params.hook ? `Use this hook/angle: ${params.hook}.` : "",
    params.hookStyle ? `Hook style: ${params.hookStyle}.` : "Choose the best suited hook style for this platform.",
    params.mustInclude ? `Must include: ${params.mustInclude}.` : "",
    params.mustAvoid ? `Must avoid: ${params.mustAvoid}.` : "",
    params.scriptSeed ? `Reference script (for improve/rehash): ${params.scriptSeed}` : "",
    "",
    `Use this section template (keep timings/types, fill text): ${JSON.stringify(params.template)}`,
    "",
    "STRICT RULES:",
    "Return JSON ONLY with keys: script:{title,sections:[{tStart,tEnd,type,text}]}, caption:{text,hashtags[]}, qc:{issues,fixesApplied}.",
    'Do NOT include labels like "Hook:", "Intro:", or "Conclusion" inside text.',
    "Script must be clean, spoken-language friendly, and naturally fit the duration. Caption must be platform-ready with CTA if provided. No truncation or placeholders.",
    "Avoid copyrighted phrases or famous quotes; ensure originality.",
    params.cta && params.cta !== "none" ? `CTA to weave in: ${params.cta}.` : "CTA: none.",
    "",
    "Return the JSON. No extra text.",
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
  const targetWords = Math.round((durationSec / 60) * 150);
  let finalHook = hook;
  const normalizedTopic = normalizeTopic(normalized.description);
  const topic_hash = topicHash(normalized.description);

  // Load previous texts for dedupe, scoped by user + module + platform + topic + language
  const { data: prevRows } = await supabaseAdmin
    .from("scripts")
    .select("text, script, output_json")
    .eq("user_id", user.id)
    .eq("module", "scripts")
    .eq("platform", normalized.platform)
    .eq("topic_hash", topic_hash)
    .limit(20);
  const previousTexts =
    prevRows
      ?.map((row: any) => row?.text || row?.script || row?.output_json?.script?.text || "")
      .filter((t: string) => typeof t === "string" && t.trim().length > 0) || [];

  async function generateStructured() {
    const template = pickTemplate(durationSec);
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
      template,
    });
    const raw = await generateCompletion(prompt, { temperature: 0.4, maxTokens: 900, provider });
    const cleaned = cleanJsonLike(raw);
    let parsed: StructuredOutput | null = null;
    try {
      parsed = JSON.parse(cleaned) as StructuredOutput;
    } catch {
      parsed = null;
    }
    if (!parsed?.script?.sections?.length || !parsed.caption?.text) {
      // Fallback structured
      parsed = {
        script: {
          title: normalized.description,
          sections: template.map((slot) => ({
            ...slot,
            text: slot.type === "hook" && hook ? hook : normalized.description,
          })),
        },
        caption: { text: userCaption || normalized.description, hashtags: ["#learnonreels"] },
        qc: { issues: ["fallback"], fixesApplied: [] },
      };
    }
    return parsed;
  }

  try {
    const structured = await generateStructured();
    const template = pickTemplate(durationSec);

    let sections = (structured.script?.sections || []).map((s) => ({
      tStart: Math.max(0, Math.round(Number(s.tStart) || 0)),
      tEnd: Math.max(Math.round(Number(s.tEnd) || 0), Math.round(Number(s.tStart) || 0) + 1),
      type: s.type || "",
      text: stripLabels(s.text || ""),
    }));

    if (!sections.length) {
      sections = template.map((slot) => ({
        ...slot,
        text: slot.type === "hook" && hook ? hook : normalized.description,
      }));
    }

    let scriptText = sections.map((s) => s.text).join(" ").trim();
    let captionText = stripLabels((structured.caption?.text || userCaption || "").trim());
    let hashtags =
      structured.caption?.hashtags && structured.caption.hashtags.length
        ? structured.caption.hashtags
        : await generateHashtagList(normalized.tone, normalized.platform, provider);

    // If the structured output is too thin, regenerate with the simpler script/caption helpers
    if (countWords(scriptText) < 30) {
      const scriptResult = await generateScriptAssets(
        normalized.tone || "informative",
        normalized.platform || "instagram",
        normalized.description,
        hook,
        provider,
      );
      scriptText = stripLabels(scriptResult.script || scriptText).replace(/\.\s*/g, ".\n").trim();
      finalHook = finalHook || scriptResult.hook || hook;
      sections = toSections(scriptText, durationSec);
    }

    if (!captionText || captionText.length < 10) {
      const captionResult = await generateCaptionContent(
        normalized.tone || "informative",
        normalized.platform || "instagram",
        normalized.description,
        finalHook || hook,
        provider,
      );
      captionText = stripLabels(`${captionResult.caption} ${captionResult.callToAction}`.trim());
    }

    if (!hashtags || hashtags.length < 3) {
      hashtags = await generateHashtagList(normalized.tone, normalized.platform, provider);
    }

    // QC and repair
    const qc = runQualityChecks({
      scriptText,
      captionText,
      durationSec,
      cta,
      previousTexts,
      contentType: normalized.contentType,
      requiredTypes: ["hook", "cta"],
      minSections: template.length,
      targetWords,
      topic: normalized.description,
      sections,
    });

    let repaired = false;
    if (qc.issues.length > 0) {
      const repairPrompt = buildRepairPrompt({
        topic: normalized.description,
        platform: normalized.platform,
        tone: normalized.tone,
        language: normalized.language || "en",
        durationSec,
        cta,
        captionText,
        scriptText,
        issues: qc.issues,
      });
      try {
        const repairedRaw = await generateCompletion(repairPrompt, { temperature: 0.4, maxTokens: 900, provider });
        const fixed = JSON.parse(cleanJsonLike(repairedRaw)) as {
          script?: { title?: string; sections?: Array<{ tStart: number; tEnd: number; text: string; type?: string }> };
          caption?: { text?: string; hashtags?: string[] };
          qc?: { issues?: string[]; fixesApplied?: string[] };
        };
        if (fixed?.script?.sections?.length) {
          sections = fixed.script.sections.map((s) => ({
            tStart: Math.max(0, Math.round(Number(s.tStart) || 0)),
            tEnd: Math.max(Math.round(Number(s.tEnd) || 0), Math.round(Number(s.tStart) || 0) + 1),
            type: s.type || "",
            text: stripLabels(s.text || ""),
          }));
          scriptText = sections.map((s) => s.text).join(" ").trim();
        }
        if (fixed?.caption?.text) {
          captionText = stripLabels(fixed.caption.text);
          hashtags = fixed.caption.hashtags ?? hashtags;
        }
        if (fixed?.qc?.issues) {
          qc.issues = fixed.qc.issues;
        }
        qc.fixesApplied = [...(qc.fixesApplied || []), "repair_prompt"];
        repaired = true;
      } catch (err) {
        console.warn("Repair prompt failed, using original content", err);
      }
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
      qc: {
        ...qc,
        fixesApplied: qc.fixesApplied || (repaired ? ["repair_prompt"] : []),
      },
    };

    // Persist to scripts table for history (avoid reels insert to skip script_id constraint issues)
    const basePayload: Record<string, unknown> = {
      user_id: user.id,
      platform: normalized.platform,
      tone: normalized.tone,
      input_prompt: normalized.description,
      hook: finalHook ?? hook ?? null,
      audience: audience || null,
      topic_hash,
      module: "scripts",
      caption: captionText,
      qc: responsePayload.qc,
      output_json: {
        ...responsePayload,
        metadata: {
          userEdited: false,
          language: normalized.language || "en",
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

      // If hook/audience columns are missing, drop them and retry
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

      if (msg.includes("text") && msg.includes("schema cache")) {
        // Supabase schema cache missing text column; try fallback field name
        const fallback = await supabaseAdmin
          .from("scripts")
          .insert({ ...retryPayload, script: scriptText })
          .select("id, hook, audience, input_prompt, text, script, tone, platform, created_at")
          .maybeSingle();
        if (!fallback.error) {
          recordId = fallback.data?.id ?? null;
        } else {
          console.error("Script insert fallback failed", fallback.error);
        }
      } else {
        // Retry with cleaned payload and text column if we removed fields
        if (
          (retryPayload as any).hook === undefined ||
          (retryPayload as any).audience === undefined ||
          (retryPayload as any).module === undefined ||
          (retryPayload as any).topic_hash === undefined
        ) {
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
        } else {
          console.error("Script insert failed", firstTry.error);
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
