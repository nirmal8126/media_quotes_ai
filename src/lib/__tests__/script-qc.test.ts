import assert from "node:assert";
import { computeDedupeScore, runQualityChecks, toSections } from "@/lib/script-qc";
import { pickTemplate } from "@/lib/scriptTemplates";

// Simple console-based tests (run with ts-node or node -r ts-node/register)

// Dedupe detection
const prev = ["Discipline beats motivation. Show up daily.", "Consistency compounds results."];
const cur = "Discipline beats motivation. Show up daily. Keep going.";
const { score } = computeDedupeScore(cur, prev);
assert(score > 0.4, "Dedupe score should detect repeated sentences");

// Caption presence + CTA check
const qc = runQualityChecks({
  scriptText: "Stay focused till the end. Follow for more.",
  captionText: "",
  durationSec: 30,
  cta: "follow",
  previousTexts: [],
  contentType: "script_and_caption",
});
assert(qc.issues.includes("caption_missing"), "Caption missing should be flagged");
assert(qc.issues.includes("cta_missing"), "CTA missing should be flagged when absent in final section");

// Section timing sanity
const sections = toSections("Sentence one. Sentence two.", 30);
assert(sections.length === 2, "Should split into 2 sections");
assert(sections[1].tEnd === 30, "Last section should end near duration");

console.log("script-qc tests passed");

// 60s template requirements
const tmpl = pickTemplate(60);
const sampleSections = tmpl.map((t) => `${t.type} text`).join(". ");
const qcTemplate = runQualityChecks({
  scriptText: sampleSections,
  captionText: "Line one with hashtags #aa #bb #cc\nLine two extra detail",
  durationSec: 60,
  cta: "follow",
  previousTexts: [],
  contentType: "script_and_caption",
  requiredTypes: ["hook", "cta"],
  minSections: 5,
  targetWords: Math.round((60 / 60) * 150),
});
console.log("Template QC issues", qcTemplate.issues);
