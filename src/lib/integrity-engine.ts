import { supabaseAdmin } from "@/lib/supabase";
import type { ContentUnit, IntegrityFix, IntegrityIssue, IntegrityReport } from "@/types/content-integrity";

const UNKNOWN_SOURCE_CODES = new Set(["unknown", "untrusted", ""]);

function textSimilarity(a?: string | null, b?: string | null): number {
  if (!a || !b) return 0;
  const aWords = a.toLowerCase().split(/\s+/).filter(Boolean);
  const bWords = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (!aWords.length || !bWords.length) return 0;
  const aSet = new Set(aWords);
  const overlap = bWords.filter((w) => aSet.has(w)).length;
  return Math.round((overlap / Math.max(aWords.length, bWords.length)) * 100);
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
      map.REPLACE_AUDIO = { action: "REPLACE_AUDIO", label: "Replace trending audio" };
    }
    if (issue.code === "UNKNOWN_MEDIA_SOURCE") {
      map.REPLACE_MEDIA = { action: "REPLACE_MEDIA", label: "Replace untrusted media" };
    }
    if (issue.code === "HIGH_SIMILARITY" || issue.code === "REUSED_CONTENT") {
      map.REGENERATE = { action: "REGENERATE", label: "Regenerate with higher variation" };
    }
    if (issue.code === "LOW_TRANSFORMATION") {
      map.REWRITE = { action: "REWRITE", label: "Rewrite with different tone" };
    }
  }
  return Object.values(map);
}

export async function analyzeContentIntegrity(unit: ContentUnit): Promise<IntegrityReport> {
  const issues: IntegrityIssue[] = [];

  // Rule: similarity vs previous texts
  const prevTexts = unit.previousTexts ?? [];
  const similarityScores = prevTexts.map((prev) => textSimilarity(unit.text, prev));
  const maxSimilarity = similarityScores.length ? Math.max(...similarityScores) : 0;
  if (maxSimilarity >= 70) {
    issues.push({
      code: "HIGH_SIMILARITY",
      severity: "warn",
      message: "Content is very similar to past items. Consider rewriting.",
    });
  }

  // Rule: generated multiple times
  if ((unit.generatedCount ?? 0) > 1) {
    issues.push({
      code: "GENERATED_MULTIPLE_TIMES",
      severity: "warn",
      message: "This item was generated multiple times.",
    });
  }

  // Rule: trending audio
  if (unit.hasTrendingAudio) {
    issues.push({
      code: "TRENDING_AUDIO",
      severity: "warn",
      message: "Trending audio may limit monetization.",
    });
  }

  // Rule: unknown media sources
  if ((unit.mediaSources || []).some((source) => UNKNOWN_SOURCE_CODES.has((source || "unknown").toLowerCase()))) {
    issues.push({
      code: "UNKNOWN_MEDIA_SOURCE",
      severity: "risk",
      message: "Media source is unknown or untrusted.",
    });
  }

  // Rule: no transformation detected
  if (unit.originalText && unit.text && textSimilarity(unit.text, unit.originalText) > 85) {
    issues.push({
      code: "LOW_TRANSFORMATION",
      severity: "warn",
      message: "Content appears unedited from original. Add human edits.",
    });
  }

  const status = worstStatus(issues);
  const score = scoreFromIssues(issues);
  const fixes = collectFixes(issues);

  return { status, score, issues, fixes };
}

export async function persistIntegrityReport(reelId: string, userId: string, report: IntegrityReport) {
  // Best-effort insert; ignore errors if table missing
  await supabaseAdmin
    .from("content_integrity_reports")
    .insert({
      content_id: reelId,
      user_id: userId,
      status: report.status,
      score: report.score,
      issues: report.issues,
      fixes: report.fixes,
      created_at: new Date().toISOString(),
    })
    .catch(() => null);
}

