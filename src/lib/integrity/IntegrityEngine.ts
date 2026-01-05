import type { ContentUnit, IntegrityFix, IntegrityIssue, IntegrityReport } from "./types";
import { jaccardSimilarity } from "./similarity";

type RuleContext = {
  unit: ContentUnit;
};

function makeIssue(code: string, severity: IntegrityIssue["severity"], message: string): IntegrityIssue {
  return { code, severity, message };
}

function evaluateSimilarity(ctx: RuleContext): IntegrityIssue | null {
  const { unit } = ctx;
  const prev = unit.previousTexts ?? [];
  if (!unit.textContent || !prev.length) return null;
  const maxSim = Math.max(...prev.map((p) => jaccardSimilarity(unit.textContent || "", p || "")));
  if (maxSim >= 0.75) {
    return makeIssue("HIGH_SIMILARITY", "warn", "Content is very similar to prior items. Rewrite recommended.");
  }
  return null;
}

function evaluateGenerationCount(ctx: RuleContext): IntegrityIssue | null {
  if ((ctx.unit.generatedCount ?? 0) > 1) {
    return makeIssue("GENERATED_MULTIPLE_TIMES", "warn", "Generated multiple times; ensure variation.");
  }
  return null;
}

function evaluateTrendingAudio(ctx: RuleContext): IntegrityIssue | null {
  if (ctx.unit.audio?.source === "trending" || ctx.unit.metadata?.audioSource === "trending") {
    return makeIssue("TRENDING_AUDIO", "warn", "Trending audio may limit monetization.");
  }
  return null;
}

function evaluateMediaSources(ctx: RuleContext): IntegrityIssue | null {
  if ((ctx.unit.mediaAssets || []).some((m) => (m.source || "unknown") === "unknown")) {
    return makeIssue("UNKNOWN_MEDIA_SOURCE", "risk", "Media source is unknown or missing.");
  }
  return null;
}

function evaluateHumanEdit(ctx: RuleContext): IntegrityIssue | null {
  const edited = ctx.unit.metadata?.userEdited === true;
  if (!edited) {
    return makeIssue("NO_HUMAN_EDIT", "warn", "No human edits detected. Add your touch to improve compliance.");
  }
  return null;
}

function worstStatus(issues: IntegrityIssue[]): IntegrityReport["status"] {
  if (issues.some((i) => i.severity === "risk")) return "risk";
  if (issues.some((i) => i.severity === "warn")) return "warn";
  return "safe";
}

function scoreFromIssues(issues: IntegrityIssue[]): number {
  const base = 95;
  const delta = issues.reduce((acc, issue) => {
    if (issue.severity === "risk") return acc - 30;
    if (issue.severity === "warn") return acc - 15;
    return acc;
  }, base);
  return Math.max(0, Math.min(100, delta));
}

function collectFixes(issues: IntegrityIssue[]): IntegrityFix[] {
  const map: Record<string, IntegrityFix> = {};
  for (const issue of issues) {
    if (issue.code === "TRENDING_AUDIO") {
      map.REPLACE_AUDIO = { action: "REPLACE_AUDIO", label: "Switch to royalty-free audio" };
    }
    if (issue.code === "UNKNOWN_MEDIA_SOURCE") {
      map.REPLACE_MEDIA = { action: "REPLACE_MEDIA", label: "Use trusted/stock media" };
    }
    if (issue.code === "HIGH_SIMILARITY" || issue.code === "GENERATED_MULTIPLE_TIMES") {
      map.REGENERATE = { action: "REGENERATE", label: "Regenerate with variation" };
    }
    if (issue.code === "NO_HUMAN_EDIT") {
      map.REWRITE = { action: "REWRITE", label: "Make a manual edit for compliance" };
    }
  }
  return Object.values(map);
}

export function analyzeContent(unit: ContentUnit): IntegrityReport {
  const ctx: RuleContext = { unit };
  const issues: IntegrityIssue[] = [];

  [evaluateSimilarity, evaluateGenerationCount, evaluateTrendingAudio, evaluateMediaSources, evaluateHumanEdit].forEach(
    (rule) => {
      const res = rule(ctx);
      if (res) issues.push(res);
    },
  );

  const status = worstStatus(issues);
  const score = scoreFromIssues(issues);
  const fixes = collectFixes(issues);

  return { status, score, issues, fixes };
}

