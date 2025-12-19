// src/lib/ai/generateStructuredScript.ts
import crypto from "crypto";

export type Platform = "instagram_reels" | "youtube_shorts" | "tiktok" | "facebook" | "generic";
export type Pace = "slow" | "normal" | "fast";
export type Goal = "educate" | "motivate" | "entertain" | "sell" | "story";
export type HookStyle = "question" | "stat" | "story" | "problem" | "controversial" | "best";

export type ScriptGenInput = {
  topic: string;
  description?: string;
  contentType: "script_only" | "caption_only" | "script_and_caption";
  platform: Platform;
  tone: string;
  language: string;
  durationSec: number; // 10/15/20/30/45/60
  pace: Pace;
  audience?: string | null;
  goal: Goal;
  cta?: string | "none" | null; // follow/subscribe/comment/save/share/none
  hookStyle?: HookStyle | null;
  persona?: string | null;
  mustInclude?: string | null;
  mustAvoid?: string | null;
  mode?: "generate" | "improve" | "rewrite" | "shorten" | "expand";
  seedScript?: string | null;
  seedCaption?: string | null;
  variations?: number; // not used here, but you can loop outside for 3 variants
  previousTexts?: string[]; // keep scoped by user/platform/lang/topic_hash in your route
};

export type ScriptSectionType = "hook" | "setup" | "value" | "steps" | "cta";

export type StructuredOutput = {
  script?: {
    title: string;
    sections: Array<{ tStart: number; tEnd: number; type: ScriptSectionType; text: string }>;
  };
  caption?: {
    text: string;
    hashtags: string[];
  };
  qc: {
    targetWords: number;
    wordCount: number;
    dedupeScore: number;
    issues: string[];
    fixesApplied: string[];
  };
};

type LlmClient = {
  generateText: (args: { system: string; prompt: string }) => Promise<string>;
};

export function normalizeTopic(topic: string) {
  return topic
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function topicHash(topic: string) {
  return crypto.createHash("sha1").update(normalizeTopic(topic)).digest("hex");
}

function wpmFor(language: string, pace: Pace) {
  // simple baseline; adjust later per voice/locale
  const base = language.toLowerCase().startsWith("hi") ? 135 : 150;
  if (pace === "slow") return base - 15;
  if (pace === "fast") return base + 15;
  return base;
}

function targetWords(durationSec: number, language: string, pace: Pace) {
  const wpm = wpmFor(language, pace);
  return Math.max(20, Math.round((durationSec / 60) * wpm));
}

function templateForDuration(durationSec: number): Array<{ tStart: number; tEnd: number; type: ScriptSectionType }> {
  // Deterministic templates (key to reliability)
  if (durationSec <= 10) {
    return [
      { tStart: 0, tEnd: 2, type: "hook" },
      { tStart: 2, tEnd: 8, type: "value" },
      { tStart: 8, tEnd: 10, type: "cta" },
    ];
  }
  if (durationSec <= 15) {
    return [
      { tStart: 0, tEnd: 3, type: "hook" },
      { tStart: 3, tEnd: 11, type: "value" },
      { tStart: 11, tEnd: 15, type: "cta" },
    ];
  }
  if (durationSec <= 20) {
    return [
      { tStart: 0, tEnd: 3, type: "hook" },
      { tStart: 3, tEnd: 7, type: "setup" },
      { tStart: 7, tEnd: 17, type: "value" },
      { tStart: 17, tEnd: 20, type: "cta" },
    ];
  }
  if (durationSec <= 30) {
    return [
      { tStart: 0, tEnd: 3, type: "hook" },
      { tStart: 3, tEnd: 8, type: "setup" },
      { tStart: 8, tEnd: 24, type: "value" },
      { tStart: 24, tEnd: 30, type: "cta" },
    ];
  }
  if (durationSec <= 45) {
    return [
      { tStart: 0, tEnd: 3, type: "hook" },
      { tStart: 3, tEnd: 10, type: "setup" },
      { tStart: 10, tEnd: 33, type: "value" },
      { tStart: 33, tEnd: 41, type: "steps" },
      { tStart: 41, tEnd: 45, type: "cta" },
    ];
  }
  // 60s default
  return [
    { tStart: 0, tEnd: 3, type: "hook" },
    { tStart: 3, tEnd: 10, type: "setup" },
    { tStart: 10, tEnd: 35, type: "value" },
    { tStart: 35, tEnd: 52, type: "steps" },
    { tStart: 52, tEnd: 60, type: "cta" },
  ];
}

function safeJsonParse(text: string) {
  // Try to extract JSON if model wrapped it in text
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const chunk = text.slice(first, last + 1);
  try {
    return JSON.parse(chunk);
  } catch {
    return null;
  }
}

function stripBadPrefixes(s: string) {
  return s
    .replace(/^\s*(hook|intro|setup|cta)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(text: string) {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function sentenceDedupeScore(text: string) {
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
  const sentences = text
    .split(/[.!?]\s+/)
    .map((s) => norm(s))
    .filter(Boolean);
  const set = new Set(sentences);
  if (sentences.length === 0) return 0;
  return 1 - set.size / sentences.length; // 0 = no dupes, 1 = all duplicates
}

function buildPrompt(input: ScriptGenInput, plan: ReturnType<typeof templateForDuration>, target: number) {
  const mustInclude = (input.mustInclude || "").trim();
  const mustAvoid = (input.mustAvoid || "").trim();
  const prev = (input.previousTexts || []).slice(0, 8).join("\n---\n"); // keep short

  return `
You are an expert short-form scriptwriter for ${input.platform}. Write ORIGINAL content.

Return STRICT JSON only. No markdown. No extra text.

INPUT:
- Topic: ${input.topic}
- Description: ${input.description || input.topic}
- Platform: ${input.platform}
- Language: ${input.language}
- Tone: ${input.tone}
- Goal: ${input.goal}
- Audience: ${input.audience || "general"}
- Hook style: ${input.hookStyle || "best"}
- Duration: ${input.durationSec}s
- Pace: ${input.pace}
- CTA: ${input.cta || "none"}
- Persona (optional): ${input.persona || "none"}

CONSTRAINTS:
- Do NOT include labels like "Hook:" or "Intro:" inside the text.
- Avoid famous quotes / copyrighted phrases.
- Must include keywords if provided: ${mustInclude || "(none)"}
- Must avoid: ${mustAvoid || "(none)"}
- Avoid repeating the same sentence.

SECTION PLAN (do not change timings/types):
${JSON.stringify(plan)}

TARGET WORDS (voiceover total): ${target} (acceptable range +/- 20%)

PREVIOUS (avoid reusing phrasing):
${prev || "(none)"}

OUTPUT JSON SCHEMA:
{
  "script": {
    "title": string,
    "sections": [
      {"tStart": number, "tEnd": number, "type": "hook|setup|value|steps|cta", "text": string}
    ]
  },
  "caption": {
    "text": string,
    "hashtags": string[]
  }
}

RULES:
- If contentType is "${input.contentType}", generate:
  - script ONLY when includes "script"
  - caption ONLY when includes "caption"
- Caption must be platform-ready: 2-6 short lines, clear CTA if CTA != none.
- Hashtags: 3-8 relevant, no spam.
`.trim();
}

function validateAndNormalize(out: any, input: ScriptGenInput, target: number): { ok: boolean; output: StructuredOutput } {
  const issues: string[] = [];
  const fixesApplied: string[] = [];

  const wantScript = input.contentType.includes("script");
  const wantCaption = input.contentType.includes("caption");

  const output: StructuredOutput = {
    script: wantScript ? { title: input.topic, sections: [] } : undefined,
    caption: wantCaption ? { text: "", hashtags: [] } : undefined,
    qc: { targetWords: target, wordCount: 0, dedupeScore: 0, issues: [], fixesApplied: [] },
  };

  if (wantScript) {
    if (!out?.script?.sections || !Array.isArray(out.script.sections)) issues.push("script_sections_missing");
    else {
      output.script!.title = String(out.script.title || input.topic).slice(0, 120);
      output.script!.sections = out.script.sections.map((s: any) => ({
        tStart: Number(s.tStart),
        tEnd: Number(s.tEnd),
        type: (String(s.type || "value") as ScriptSectionType),
        text: stripBadPrefixes(String(s.text || "")),
      }));

      // Basic section checks
      if (output.script!.sections.length < Math.min(3, Math.ceil(input.durationSec / 15))) issues.push("script_too_few_sections");
      const hasHook = output.script!.sections.some((s) => s.type === "hook" && s.text.length > 10);
      const hasCta = input.cta && input.cta !== "none"
        ? output.script!.sections.some((s) => s.type === "cta" && s.text.toLowerCase().includes(String(input.cta).toLowerCase()))
        : output.script!.sections.some((s) => s.type === "cta" && s.text.length > 8);

      if (!hasHook) issues.push("hook_missing");
      if ((input.cta || "none") !== "none" && !hasCta) issues.push("cta_missing");

      const allText = output.script!.sections.map((s) => s.text).join(" ");
      const wc = countWords(allText);
      output.qc.wordCount = wc;

      const min = Math.round(target * 0.8);
      const max = Math.round(target * 1.2);
      if (wc < min) issues.push("too_short");
      if (wc > max) issues.push("too_long");

      const dd = sentenceDedupeScore(allText);
      output.qc.dedupeScore = dd;
      if (dd >= 0.25) issues.push("duplicate_lines");
    }
  }

  if (wantCaption) {
    if (!out?.caption?.text || typeof out.caption.text !== "string") issues.push("caption_missing");
    else {
      output.caption!.text = String(out.caption.text).trim();
      output.caption!.hashtags = Array.isArray(out.caption.hashtags) ? out.caption.hashtags.map(String) : [];
      if (output.caption!.text.length < Math.max(60, input.topic.length + 20)) issues.push("caption_too_short");
      if (output.caption!.hashtags.length < 3) issues.push("hashtags_too_few");
      if (output.caption!.hashtags.length > 12) {
        output.caption!.hashtags = output.caption!.hashtags.slice(0, 8);
        fixesApplied.push("trim_hashtags");
      }
    }
  }

  output.qc.issues = issues;
  output.qc.fixesApplied = fixesApplied;

  return { ok: issues.length === 0, output };
}

function buildRepairPrompt(badJson: any, issues: string[], input: ScriptGenInput, plan: any, target: number) {
  return `
You must FIX the JSON to satisfy these issues: ${issues.join(", ")}.

Return STRICT JSON only matching schema:
{
  "script": {"title": string, "sections":[{"tStart":number,"tEnd":number,"type":"hook|setup|value|steps|cta","text":string}]},
  "caption": {"text": string, "hashtags": string[]}
}

Keep timings/types exactly as this plan:
${JSON.stringify(plan)}

Target words: ${target} +/- 20%.

BAD JSON:
${JSON.stringify(badJson)}
`.trim();
}

export async function generateStructuredScript(
  input: ScriptGenInput,
  llmPrimary: LlmClient,
  llmFallback?: LlmClient,
): Promise<StructuredOutput> {
  const plan = templateForDuration(input.durationSec);
  const target = targetWords(input.durationSec, input.language, input.pace);

  const system =
    "You are a reliable generator. You ALWAYS output valid JSON only, matching the requested schema. No markdown.";

  const prompt = buildPrompt(input, plan, target);

  const tryOne = async (client: LlmClient) => {
    const raw = await client.generateText({ system, prompt });
    const parsed = safeJsonParse(raw);
    if (!parsed) return { raw, parsed: null, normalized: null as any };
    const v1 = validateAndNormalize(parsed, input, target);

    if (v1.ok) return { raw, parsed, normalized: v1.output };

    // Auto-repair once
    const repairPrompt = buildRepairPrompt(parsed, v1.output.qc.issues, input, plan, target);
    const repairedRaw = await client.generateText({ system, prompt: repairPrompt });
    const repairedParsed = safeJsonParse(repairedRaw);
    if (!repairedParsed) return { raw: repairedRaw, parsed: null, normalized: v1.output };

    const v2 = validateAndNormalize(repairedParsed, input, target);
    if (v2.ok) {
      v2.output.qc.fixesApplied.push("auto_repair");
      return { raw: repairedRaw, parsed: repairedParsed, normalized: v2.output };
    }

    return { raw: repairedRaw, parsed: repairedParsed, normalized: v2.output };
  };

  // Primary
  const r1 = await tryOne(llmPrimary);
  if (r1.normalized && r1.normalized.qc.issues.length === 0) return r1.normalized;

  // Fallback
  if (llmFallback) {
    const r2 = await tryOne(llmFallback);
    if (r2.normalized) return r2.normalized;
  }

  // Worst-case: return best effort (with qc issues) but NEVER raw/unstructured
  return r1.normalized ?? {
    script: input.contentType.includes("script")
      ? { title: input.topic, sections: plan.map((p) => ({ ...p, text: "" })) }
      : undefined,
    caption: input.contentType.includes("caption") ? { text: "", hashtags: [] } : undefined,
    qc: { targetWords: target, wordCount: 0, dedupeScore: 0, issues: ["generation_failed"], fixesApplied: [] },
  };
}
