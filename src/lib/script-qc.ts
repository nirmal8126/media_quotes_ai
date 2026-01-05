import crypto from "node:crypto";

export type ScriptSection = {
  tStart: number;
  tEnd: number;
  type?: string;
  text: string;
};

export type GeneratedScript = {
  title: string;
  sections: ScriptSection[];
};

export type GeneratedCaption = {
  text: string;
  hashtags: string[];
};

export type QcReport = {
  dedupeScore: number;
  issues: string[];
  fixesApplied: string[];
};

export function normalizeTopic(topic: string) {
  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function topicHash(topic: string) {
  const normalized = normalizeTopic(topic);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function normalizeSentence(input: string) {
  return input
    .toLowerCase()
    .replace(/['"’”“]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitSentences(text: string): string[] {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  return cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function toSections(text: string, durationSec: number): ScriptSection[] {
  const sentences = splitSentences(text);
  if (sentences.length === 0) {
    return [
      {
        tStart: 0,
        tEnd: Math.max(durationSec, 5),
        text,
      },
    ];
  }
  const per = durationSec / sentences.length;
  return sentences.map((s, idx) => {
    const tStart = Math.max(0, Math.round(idx * per));
    const tEnd = Math.round((idx + 1) * per);
    return { tStart, tEnd, text: s };
  });
}

export function computeDedupeScore(current: string, previous: string[]) {
  const currentSentences = splitSentences(current).map(normalizeSentence);
  const prevSentences = previous
    .flatMap((p) => splitSentences(p).map(normalizeSentence))
    .filter(Boolean);
  const prevSet = new Set(prevSentences);
  let dupes = 0;
  currentSentences.forEach((s) => {
    if (prevSet.has(s)) dupes += 1;
  });
  const score = currentSentences.length ? dupes / currentSentences.length : 0;
  return { score, duplicates: currentSentences.filter((s) => prevSet.has(s)) };
}

export function estimateMaxWords(durationSec: number, wpm = 150) {
  return Math.max(10, Math.round((durationSec / 60) * wpm));
}

export function runQualityChecks(options: {
  scriptText: string;
  captionText: string;
  durationSec: number;
  cta?: string | null;
  previousTexts: string[];
  contentType?: string;
  requiredTypes?: string[];
  minSections?: number;
  targetWords?: number;
  topic?: string;
  sections?: ScriptSection[];
}) {
  const issues: string[] = [];
  const fixesApplied: string[] = [];

  const { score: dedupeScore } = computeDedupeScore(options.scriptText, options.previousTexts);
  if (dedupeScore > 0.35) {
    issues.push("dedupe_high");
  }

  const needsCaption = !options.contentType || options.contentType.includes("caption");
  if (needsCaption && !options.captionText.trim()) {
    issues.push("caption_missing");
  }

  if (options.cta && options.cta !== "none") {
    const sections = toSections(options.scriptText, options.durationSec);
    const last = sections[sections.length - 1]?.text?.toLowerCase() || "";
    if (!last.includes(options.cta.toLowerCase())) {
      issues.push("cta_missing");
    }
  }

  const words = options.scriptText.split(/\s+/).filter(Boolean).length;
  const target = options.targetWords ?? estimateMaxWords(options.durationSec);
  const maxWords = Math.round(target * 1.2);
  const minWords = Math.max(10, Math.round(target * 0.8));
  if (words > maxWords) issues.push("wordcount_over");
  if (words < minWords) issues.push("wordcount_under");

  const sectionsForCheck = options.sections ?? toSections(options.scriptText, options.durationSec);

  if (options.requiredTypes?.length || options.minSections) {
    if (options.minSections && sectionsForCheck.length < options.minSections) {
      issues.push("sections_too_few");
    }
    if (options.requiredTypes?.length) {
      const hasTypes = new Set(sectionsForCheck.map((s) => (s.type || "").toLowerCase()));
      options.requiredTypes.forEach((t) => {
        if (!hasTypes.has(t.toLowerCase())) issues.push(`missing_type_${t.toLowerCase()}`);
      });
    }
  }

  // Caption quality: longer than topic and >= 2 lines, hashtags 3-8
  if (options.topic) {
    if (options.captionText.trim().toLowerCase() === options.topic.trim().toLowerCase()) {
      issues.push("caption_too_short");
    }
  }
  const captionLines = options.captionText.split(/\n/).filter((l) => l.trim().length > 0);
  if (captionLines.length < 2 || options.captionText.trim().length < 80) {
    issues.push("caption_quality");
  }
  const hashtagCount = (options.captionText.match(/#[\w]+/g) || []).length;
  if (hashtagCount < 3 || hashtagCount > 8) {
    issues.push("caption_hashtags");
  }

  const qc: QcReport = {
    dedupeScore,
    issues,
    fixesApplied,
  };

  return qc;
}

export function buildRepairPrompt(params: {
  topic: string;
  platform: string;
  tone: string;
  language: string;
  durationSec: number;
  cta?: string | null;
  captionText: string;
  scriptText: string;
  template: Array<{ tStart: number; tEnd: number; type: string }>;
  issues: string[];
}) {
  const { topic, platform, tone, language, durationSec, cta, captionText, scriptText, issues, template } = params;
  const issueList = issues.join(", ") || "none";
  return [
    "You are a professional short-form content writer.",
    `Fix ONLY these issues: ${issueList}. Keep everything else intact.`,
    `Topic: ${topic}. Platform: ${platform}. Tone: ${tone}. Language: ${language}. Duration: ${durationSec}s.`,
    cta && cta !== "none" ? `CTA required in final 5-10 seconds: ${cta}.` : "CTA: none.",
    `Use this section template (keep timings/types): ${JSON.stringify(template)}`,
    "STRICT OUTPUT: pure JSON { script:{ title, sections:[{tStart,tEnd,type,text}] }, caption:{ text, hashtags[] }, qc:{ issues, fixesApplied } }.",
    "Do not include labels like Hook/Intro/Conclusion in text.",
    "Script must fit duration (150 wpm baseline). Caption must be platform-ready, >80 chars, 2+ lines, hashtags 3-8.",
    "Current script:",
    scriptText,
    "Current caption:",
    captionText,
  ].join("\n");
}
