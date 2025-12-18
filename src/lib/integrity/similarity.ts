// Lightweight shingle/Jaccard similarity for text

export function tokenizeShingles(text: string, k = 3): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
  const shingles = new Set<string>();
  for (let i = 0; i < normalized.length; i += 1) {
    const window = normalized.slice(i, i + k);
    if (window.length === k) {
      shingles.add(window.join(" "));
    }
  }
  return shingles;
}

export function jaccardSimilarity(a: string, b: string, k = 3): number {
  if (!a?.trim() || !b?.trim()) return 0;
  const setA = tokenizeShingles(a, k);
  const setB = tokenizeShingles(b, k);
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  setA.forEach((item) => {
    if (setB.has(item)) intersection += 1;
  });
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Minimal self-checks (console-based; run manually or via a test runner)
export function selfTestSimilarity() {
  const base = "This is a short test sentence about reels and hooks.";
  const close = "This is a short test sentence about reels and hooks!";
  const far = "Completely different topic with no overlap.";

  const s1 = jaccardSimilarity(base, close);
  const s2 = jaccardSimilarity(base, far);
  if (s1 <= s2) {
    throw new Error(`Similarity self-test failed: expected close (${s1}) > far (${s2}).`);
  }
  return true;
}

