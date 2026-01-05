import crypto from "crypto";
import { getTextProviders, type TextProvider } from "./providers";

export type Platform = "instagram_reels" | "youtube_shorts" | "tiktok" | "facebook" | "generic";
export type Pace = "slow" | "normal" | "fast";
export type Goal = "educate" | "motivate" | "entertain" | "sell" | "story";
export type HookStyle = "question" | "stat" | "story" | "problem" | "controversial" | "best";

export type ScriptGenInput = {
  topic: string;
  description?: string;
  contentType: "short_script" | "long_script" | "caption" | "script_and_caption";
  platform: Platform;
  tone: string;
  language: string;
  durationSec: number;
  pace: Pace;
  audience?: string | null;
  goal: Goal;
  cta?: string | "none" | null;
  hookStyle?: HookStyle | null;
  persona?: string | null;
  mustInclude?: string | null;
  mustAvoid?: string | null;
  mode?: "generate" | "improve" | "rewrite" | "shorten" | "expand";
  seedScript?: string | null;
  seedCaption?: string | null;
  variations?: number;
  previousTexts?: string[];
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
    similarityPrev?: number;
  };
};

type GenerationProviders = {
  primary?: TextProvider | null;
  fallback?: TextProvider | null;
};

type PlanSlot = { tStart: number; tEnd: number; type: ScriptSectionType };
type TemplateSpec = {
  beats: number;
  minWords: number;
  maxWords: number;
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

function cleanModelJsonText(text: string) {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function safeJsonParse(text: string) {
  const cleaned = cleanModelJsonText(text);
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const chunk = cleaned.slice(first, last + 1);
  try {
    return JSON.parse(chunk);
  } catch {
    return null;
  }
}

function wpmFor(language: string, pace: Pace) {
  const base = language.toLowerCase().startsWith("hi") ? 135 : 150;
  if (pace === "slow") return base - 15;
  if (pace === "fast") return base + 15;
  return base;
}

function targetWords(durationSec: number, language: string, pace: Pace) {
  const wpm = wpmFor(language, pace);
  return Math.max(20, Math.round((durationSec / 60) * wpm));
}

function templateForDuration(durationSec: number): PlanSlot[] {
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
  return [
    { tStart: 0, tEnd: 3, type: "hook" },
    { tStart: 3, tEnd: 10, type: "setup" },
    { tStart: 10, tEnd: 35, type: "value" },
    { tStart: 35, tEnd: 52, type: "steps" },
    { tStart: 52, tEnd: 60, type: "cta" },
  ];
}

function templateSpec(durationSec: number, contentType: ScriptGenInput["contentType"], target: number): TemplateSpec {
  // base window around target
  const baseMin = Math.max(20, Math.round(target * 0.85));
  const baseMax = Math.round(target * 1.25);

  if (contentType === "short_script") {
    return {
      beats: durationSec <= 30 ? 3 : 4,
      minWords: Math.max(20, Math.round(baseMin * 0.75)),
      maxWords: Math.round(baseMax * 0.85),
    };
  }

  if (contentType === "long_script") {
    return {
      beats: durationSec <= 30 ? 4 : 5,
      minWords: Math.round(baseMin * 1.0),
      maxWords: Math.round(baseMax * 1.15),
    };
  }

  // script_and_caption default
  return {
    beats: durationSec <= 30 ? 4 : durationSec <= 45 ? 5 : 6,
    minWords: baseMin,
    maxWords: baseMax,
  };
}


function stripBadPrefixes(s: string) {
  return s
    .replace(/^\s*(hook|intro|setup|cta|conclusion|outro)\s*[:\-]\s*/i, "")
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
  return 1 - set.size / sentences.length;
}

function similarityToPrevious(text: string, previous: string[]) {
  const norm = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  const base = norm(text);
  if (!base) return 0;
  const baseWords = new Set(base.split(" "));
  let best = 0;
  for (const prev of previous) {
    const p = norm(prev);
    if (!p) continue;
    const prevWords = new Set(p.split(" "));
    const intersection = [...baseWords].filter((w) => prevWords.has(w));
    const union = new Set([...baseWords, ...prevWords]);
    const score = union.size === 0 ? 0 : intersection.length / union.size;
    best = Math.max(best, score);
  }
  return best;
}

function buildPrompt(input: ScriptGenInput, plan: PlanSlot[], target: number, spec: TemplateSpec) {
  const mustInclude = (input.mustInclude || "").trim() || "(none)";
  const mustAvoid = (input.mustAvoid || "").trim() || "(none)";
  const prev = (input.previousTexts || []).slice(0, 8).join("\n---\n") || "(none)";

  return `
You are an expert short-form scriptwriter for ${input.platform}. Write ORIGINAL content.

Return STRICT JSON only. No markdown. No extra commentary. Do not wrap in code fences.

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
- Mode: ${input.mode || "generate"}

CONSTRAINTS:
- Do NOT include labels like "Hook:" or "Intro:" inside the text.
- Avoid famous quotes or copyrighted phrases.
- Must include keywords (if any): ${mustInclude}
- Must avoid: ${mustAvoid}
- Avoid repeating the same sentence. Avoid copying previous outputs.

SECTION PLAN (keep timings/types EXACT):
${JSON.stringify(plan)}

TARGET WORDS (voiceover total): ${target} (+/- 20%)
WORD RANGE: ${spec.minWords}-${spec.maxWords}
BEAT COUNT REQUIRED: ${spec.beats}

PREVIOUS OUTPUTS (avoid reusing phrasing):
${prev}

OUTPUT JSON SCHEMA:
{
  "script": {"title": string, "sections":[{"tStart":number,"tEnd":number,"type":"hook|setup|value|steps|cta","text":string}]},
  "caption": {"text": string, "hashtags": string[]}
}

RULES:
- Always return script AND caption when contentType includes them.
- Caption: 2-6 short lines, include CTA if CTA != none, 3-8 relevant hashtags.
- No markdown, no explanations. JSON only.
`.trim();
}

function validateAndNormalize(
  out: any,
  input: ScriptGenInput,
  plan: PlanSlot[],
  target: number,
  spec: TemplateSpec,
  previousTexts: string[],
): { ok: boolean; output: StructuredOutput } {
  const issues: string[] = [];
  const fixesApplied: string[] = [];

  const wantScript =
  input.contentType === "short_script" ||
  input.contentType === "long_script" ||
  input.contentType === "script_and_caption";

  const wantCaption =
  input.contentType === "caption" ||
  input.contentType === "script_and_caption";


  const output: StructuredOutput = {
    script: wantScript ? { title: input.topic, sections: plan.map((p) => ({ ...p, text: "" })) } : undefined,
    caption: wantCaption ? { text: "", hashtags: [] } : undefined,
    qc: { targetWords: target, wordCount: 0, dedupeScore: 0, issues: [], fixesApplied: [], similarityPrev: undefined },
  };

  if (wantScript) {
    const provided = Array.isArray(out?.script?.sections) ? out.script.sections : [];
    output.script = {
      title: String(out?.script?.title || input.topic).slice(0, 160),
      sections: plan.map((slot, idx) => {
        const candidate = provided[idx] || provided.find((s: any) => s?.type === slot.type) || {};
        const text = stripBadPrefixes(String(candidate?.text ?? ""));
        return { ...slot, text };
      }),
    };

    if (!provided.length) {
      issues.push("script_sections_missing");
    }

    const hookText = output.script.sections.find((s) => s.type === "hook")?.text || "";
    if (!hookText || hookText.length < 6) issues.push("hook_missing");
    const hookSimilarity = similarityToPrevious(hookText, previousTexts);
    if (hookSimilarity >= 0.6) issues.push("hook_too_similar_previous");

    const ctaText = output.script.sections.find((s) => s.type === "cta")?.text || "";
    if ((input.cta || "none") !== "none" && !ctaText.toLowerCase().includes(String(input.cta).toLowerCase())) {
      issues.push("cta_missing");
    }

    const scriptText = output.script.sections.map((s) => s.text).join(" ").trim();
    const wc = countWords(scriptText);
    output.qc.wordCount = wc;
    const min = Math.max(spec.minWords, Math.round(target * 0.8));
    const max = Math.min(spec.maxWords, Math.round(target * 1.2));
    if (wc < min) issues.push("too_short");
    if (wc > max) issues.push("too_long");

    const dd = sentenceDedupeScore(scriptText);
    output.qc.dedupeScore = dd;
    if (dd >= 0.25) issues.push("duplicate_lines");

    const similarityPrev = similarityToPrevious(scriptText, previousTexts);
    output.qc.similarityPrev = similarityPrev;
    if (similarityPrev >= 0.65) issues.push("too_similar_previous");

    if (output.script.sections.length < spec.beats) {
      issues.push("beats_too_few");
    }
  }

  if (wantCaption) {
    if (!out?.caption?.text || typeof out.caption.text !== "string") {
      issues.push("caption_missing");
    } else {
      output.caption = {
        text: String(out.caption.text).trim(),
        hashtags: Array.isArray(out.caption.hashtags) ? out.caption.hashtags.map(String) : [],
      };
      if (output.caption.text.length < Math.max(60, input.topic.length + 20)) issues.push("caption_too_short");
      if ((output.caption.hashtags ?? []).length < 3) issues.push("hashtags_too_few");
      if ((output.caption.hashtags ?? []).length > 12) {
        output.caption.hashtags = output.caption.hashtags.slice(0, 8);
        fixesApplied.push("trim_hashtags");
      }
    }
  }

  output.qc.issues = issues;
  output.qc.fixesApplied = fixesApplied;

  return { ok: issues.length === 0, output };
}

function buildRepairPrompt(badJson: any, issues: string[], input: ScriptGenInput, plan: PlanSlot[], target: number) {
  const bad = typeof badJson === "string" ? badJson : JSON.stringify(badJson);
  return `
You must FIX the JSON to satisfy these issues: ${issues.join(", ")}.

Return STRICT JSON only. No markdown. Do not wrap in code fences.
Rewrite with a new hook angle and different phrasing; do not reuse previous lines.

Schema:
{
  "script": {"title": string, "sections":[{"tStart":number,"tEnd":number,"type":"hook|setup|value|steps|cta","text":string}]},
  "caption": {"text": string, "hashtags": string[]}
}

Keep timings/types exactly as this plan:
${JSON.stringify(plan)}

Target words: ${target} +/- 20%.

BAD JSON:
${bad}
`.trim();
}

async function runWithProvider(
  provider: TextProvider,
  input: ScriptGenInput,
  plan: PlanSlot[],
  target: number,
  spec: TemplateSpec,
  system: string,
): Promise<StructuredOutput> {
  const previousTexts = input.previousTexts || [];
  const basePrompt = buildPrompt(input, plan, target, spec);

  const tryGenerate = async (prompt: string) => {
    const raw = await provider.generateText({
      system,
      prompt,
      temperature: provider.name === "gemini" ? 0.6 : 0.45,
      maxTokens: 1400,
    });
    const parsed = safeJsonParse(raw);
    const { output } = validateAndNormalize(parsed || {}, input, plan, target, spec, previousTexts);
    if (!parsed) {
      output.qc.issues = Array.from(new Set(["invalid_json", ...output.qc.issues]));
    }
    return { raw, parsed, output };
  };

  let attempt = await tryGenerate(basePrompt);
  let tries = 0;

  while (attempt.output.qc.issues.length > 0 && tries < 2) {
    tries += 1;
    const repairPrompt = buildRepairPrompt(attempt.parsed ?? attempt.raw, attempt.output.qc.issues, input, plan, target);
    attempt = await tryGenerate(repairPrompt);
    attempt.output.qc.fixesApplied = Array.from(new Set([...(attempt.output.qc.fixesApplied || []), "auto_repair"]));
  }

  return attempt.output;
}

export async function generateStructuredScript(
  input: ScriptGenInput,
  providers?: GenerationProviders,
): Promise<StructuredOutput> {
  const plan = templateForDuration(input.durationSec);
  const target = targetWords(input.durationSec, input.language, input.pace);
  const spec = templateSpec(input.durationSec, input.contentType, target);

  const system =
    "You are a reliable generator. You ALWAYS output valid JSON only, matching the requested schema. No markdown. No code fences.";

  const resolvedProviders = providers ?? getTextProviders();
  const primary = resolvedProviders.primary;
  const fallback = resolvedProviders.fallback;

  if (!primary && !fallback) {
    throw new Error("No LLM provider configured (Gemini/OpenAI).");
  }

  const outputs: StructuredOutput[] = [];
  const errors: string[] = [];

  if (primary) {
    try {
      outputs.push(await runWithProvider(primary, input, plan, target, spec, system));
    } catch (error) {
      errors.push((error as Error).message || "primary_provider_failed");
    }
  }

  const primaryClean = outputs[0];
  if (primaryClean && primaryClean.qc.issues.length === 0) {
    return primaryClean;
  }

  if (fallback) {
    try {
      outputs.push(await runWithProvider(fallback, input, plan, target, spec, system));
    } catch (error) {
      errors.push((error as Error).message || "fallback_provider_failed");
    }
  }

  // Pick the result with fewer issues
  if (outputs.length) {
    const sorted = outputs.sort((a, b) => a.qc.issues.length - b.qc.issues.length);
    return sorted[0];
  }

  throw new Error(errors.join(" | ") || "generation_failed");
}
