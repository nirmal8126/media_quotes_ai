type Scene = { startMs: number; endMs: number; text: string };

type SplitOptions = {
  scriptText: string;
  durationSec: number;
  language?: string | null;
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function extractCtaLine(text: string) {
  const match = text.split(/\r?\n/).find((line) => /^cta[:\-]?/i.test(line.trim()));
  if (!match) return null;
  return normalizeText(match.replace(/^cta[:\-]?/i, ""));
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?।])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function wrapLines(text: string, maxChars = 28) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function splitIfTooLong(text: string, maxLines = 2) {
  const lines = wrapLines(text);
  if (lines.length <= maxLines) return [lines.join("\n")];
  const words = text.split(/\s+/).filter(Boolean);
  const mid = Math.ceil(words.length / 2);
  const first = words.slice(0, mid).join(" ");
  const second = words.slice(mid).join(" ");
  return [wrapLines(first).slice(0, maxLines).join("\n"), wrapLines(second).slice(0, maxLines).join("\n")].filter(Boolean);
}

function clampScenes(count: number) {
  return Math.max(4, Math.min(count, 8));
}

export function splitIntoScenes(options: SplitOptions): Scene[] {
  const scriptText = options.scriptText || "";
  const cleaned = scriptText
    .split(/\r?\n/)
    .filter((line) => !/^cta[:\-]?/i.test(line.trim()))
    .join("\n")
    .trim();

  const sentences = splitSentences(cleaned);
  const cta = extractCtaLine(scriptText);
  const baseSegments = sentences.length ? sentences : [normalizeText(cleaned) || "Keep going."];

  const targetCount = clampScenes(baseSegments.length);
  const chunks: string[] = [];
  let cursor = 0;

  while (chunks.length < targetCount && cursor < baseSegments.length) {
    const current = baseSegments[cursor];
    const next = baseSegments[cursor + 1];
    if (current.length < 50 && next && chunks.length < targetCount - 1) {
      chunks.push(`${current} ${next}`.trim());
      cursor += 2;
    } else {
      chunks.push(current);
      cursor += 1;
    }
  }

  while (chunks.length < targetCount) {
    const last = chunks[chunks.length - 1] || "";
    chunks.push(last);
  }

  if (cta) {
    const last = chunks[chunks.length - 1];
    if (!last.toLowerCase().includes(cta.toLowerCase())) {
      chunks[chunks.length - 1] = `${last} ${cta}`.trim();
    }
  }

  const wrappedChunks: string[] = [];
  chunks.forEach((chunk) => {
    const parts = splitIfTooLong(chunk, 2);
    wrappedChunks.push(...parts);
  });

  while (wrappedChunks.length > 8) {
    const last = wrappedChunks.pop();
    const prev = wrappedChunks.pop();
    wrappedChunks.push([prev, last].filter(Boolean).join(" "));
  }

  while (wrappedChunks.length < 4) {
    const last = wrappedChunks[wrappedChunks.length - 1] || "";
    wrappedChunks.push(last);
  }

  const totalMs = Math.max(4000, Math.round((options.durationSec || 15) * 1000));
  const perScene = Math.floor(totalMs / wrappedChunks.length);
  let remainder = totalMs - perScene * wrappedChunks.length;

  let start = 0;
  return wrappedChunks.map((text) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);
    const duration = perScene + extra;
    const end = start + duration;
    const scene = { startMs: start, endMs: end, text: text.trim() };
    start = end;
    return scene;
  });
}
