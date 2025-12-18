import { jaccardSimilarity } from "../similarity";
import { analyzeContent } from "../IntegrityEngine";
import type { ContentUnit } from "../types";

// These tests are lightweight and can be run manually or with a TS test runner.

(() => {
  const base = "This is a short test sentence about reels and hooks.";
  const close = "This is a short test sentence about reels and hooks!";
  const far = "A different topic entirely.";
  const s1 = jaccardSimilarity(base, close);
  const s2 = jaccardSimilarity(base, far);
  if (!(s1 > s2)) {
    throw new Error(`Expected similar text to score higher than distant text (s1=${s1}, s2=${s2})`);
  }
})();

(() => {
  const unit: ContentUnit = {
    id: "test",
    type: "script",
    platform: "youtube_shorts",
    textContent: "Hello world hook",
    previousTexts: ["Hello world hook", "Another script"],
    generatedCount: 2,
    mediaAssets: [{ source: "unknown" }],
    audio: { source: "trending" },
    metadata: { userEdited: false },
  };
  const report = analyzeContent(unit);
  if (report.status === "safe") {
    throw new Error("Expected report to be warn/risk due to multiple issues.");
  }
})();

