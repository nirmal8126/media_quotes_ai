import { supabaseAdmin } from '@/lib/supabase';
import { DEFAULT_LANGUAGE } from '@/lib/languages';
import { generateCompletion, type LlmProvider } from '@/lib/openai';

export type QuoteRecord = {
  id?: string;
  user_id: string;
  topic?: string | null;
  persona?: string | null;
  tone?: string | null;
  language?: string | null;
  style?: string | null;
  quote_type?: 'text' | 'image' | null;
  quotes: string[];
  image_quotes?: Array<{ text: string }> | null;
  hook?: string | null;
  word_limit?: number | null;
};

function sanitizeQuoteText(input: unknown) {
  if (typeof input !== 'string') return '';
  let text = input;

  // Decode common escapes
  text = text.replace(/\\n/gi, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');

  text = text
    .replace(/```[\w-]*\s*/gi, '') // drop code fences like ```json
    .replace(/^\s*\[\s*|\s*\]\s*$/g, '') // drop stray brackets
    .replace(/^[\d]+\.\s*/, '') // drop leading numbering
    .replace(/^[-–]\s*/, '') // drop leading dash
    .replace(/[",]+\s*$/g, '') // drop trailing quotes/commas
    .trim();

  // drop surrounding quotes/backticks
  text = text.replace(/^['"`]+/, '').replace(/['"`]+$/, '').trim();

  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower === 'json') return '';
  if (text === '[' || text === ']') return '';
  return text;
}

function insertLineBreaks(text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 3) return text;
  const targetLines = Math.max(3, Math.min(6, Math.ceil(words.length / 4)));
  const wordsPerLine = Math.max(3, Math.min(5, Math.ceil(words.length / targetLines)));
  const lines: string[] = [];
  let index = 0;

  while (index < words.length) {
    if (lines.length >= 5) {
      lines.push(words.slice(index).join(' '));
      break;
    }
    lines.push(words.slice(index, index + wordsPerLine).join(' '));
    index += wordsPerLine;
  }

  return lines.join('\n');
}

function clipToWords(text: string, maxWords: number) {
  if (!maxWords || maxWords <= 0) return text;
  const parts = text.split(/(\s+)/);
  let count = 0;
  const kept: string[] = [];
  for (const part of parts) {
    if (!part.trim()) {
      kept.push(part);
      continue;
    }
    count += 1;
    if (count > maxWords) break;
    kept.push(part);
  }
  return kept.join('').trim();
}

function cleanQuotes(list: unknown[], limit: number, quoteType?: 'text' | 'image', maxWords?: number | null) {
  const cleaned = list
    .map((q) => sanitizeQuoteText(q))
    .filter((q) => Boolean(q))
    .slice(0, limit) as string[];

  if (quoteType === 'image') {
    return cleaned.map((line) => {
      const unescaped = line
        .replace(/\\n/g, '\n') // decode escaped newlines
        .replace(/\\"/g, '"') // decode escaped quotes
        .replace(/[",]+\s*$/g, '') // strip trailing quote/comma artifacts
        .trim();
      const clipped = maxWords ? clipToWords(unescaped, maxWords) : unescaped;
      if (!clipped.includes('\n')) {
        return insertLineBreaks(clipped);
      }
      return clipped;
    });
  }

  return cleaned.map((line) => (maxWords ? clipToWords(line, maxWords) : line));
}

export function enforceQuoteLimits(
  quotes: unknown[],
  options: { count: number; quoteType?: 'text' | 'image'; wordLimit?: number | null },
) {
  const safeCount = Math.max(1, Math.min(options.count || 1, 100));
  const maxWords =
    typeof options.wordLimit === 'number' && Number.isFinite(options.wordLimit)
      ? Math.min(Math.max(Math.round(options.wordLimit), 4), 100)
      : null;

  return cleanQuotes(quotes, safeCount, options.quoteType, maxWords);
}

function countWords(text: string) {
  return text
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean).length;
}

function ensureSentenceEnding(text: string) {
  if (!text) return text;
  if (/[.!?।]$/.test(text.trim())) return text;
  return `${text.trim()}।`;
}

function stripEmojis(text: string) {
  try {
    return text.replace(/\p{Extended_Pictographic}/gu, '');
  } catch {
    return text;
  }
}

function normalizeForDedupe(text: string) {
  return stripEmojis(text)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?।]+$/g, '')
    .trim();
}

function dedupe(quotes: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  quotes.forEach((q) => {
    const key = normalizeForDedupe(q);
    if (!key) return;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(q);
    }
  });
  return out;
}

export async function generateQuotesList(options: {
  topic?: string;
  tone?: string;
  persona?: string;
  language?: string;
  style?: string;
  count?: number;
  hook?: string;
  wordLimit?: number;
  quoteType?: 'text' | 'image';
  provider?: LlmProvider;
}) {
  const {
    topic = 'general inspiration',
    tone = 'motivational',
    persona,
    language = DEFAULT_LANGUAGE,
    style,
    count = 10,
    hook,
    wordLimit,
    quoteType = 'text',
  } = options;
  const capped = Math.max(1, Math.min(count, 100));
  const maxWords = Number.isFinite(wordLimit) ? Math.min(Math.max(Number(wordLimit), 4), 100) : null;
  const minWords =
    maxWords && maxWords >= 8 ? Math.max(6, Math.min(maxWords - 10, Math.floor(maxWords * 0.85))) : maxWords ?? null;

  const personaLine = persona ? `Write in the persona/voice of: ${persona}.` : '';
  const styleLine = style ? `Style: ${style}.` : '';
  const hookLine = hook ? `Anchor the ideas to this hook/angle: ${hook}.` : '';
  const wordLimitLine = maxWords
    ? `Each quote must be between ${minWords ?? maxWords} and ${maxWords} words (count words, not emojis). If you exceed ${maxWords} words, trim to ${maxWords}. Do not return fewer than ${minWords ?? maxWords} words.`
    : 'Keep each quote concise.';

  const formatLine =
    quoteType === 'image'
      ? 'Format as overlay-friendly lines for quote images: use line breaks (\\n) to create 3-6 short lines, keep total words at the required count, and use punchy visual language.'
      : 'Format as short text quotes at the required word count.';

  const prompt = `Generate ${capped} short, shareable quotes about "${topic}" in a ${tone} tone. ${personaLine} ${styleLine} ${hookLine} ${wordLimitLine} ${formatLine} Language: ${language}. Do not use emojis. Return JSON array of strings only.`;

  const strictPrompt = `Return exactly ${capped} distinct quotes as a pure JSON array of ${capped} strings (no keys). Each quote must be a complete sentence, end with punctuation, and be between ${minWords ?? maxWords ?? 8} and ${maxWords ?? 'concise'} words. Do not repeat quotes or rephrase the same idea. Cover different angles or sub-themes of the topic: "${topic}". Tone: ${tone}. Style: ${style ?? 'default'}. Persona: ${persona ?? 'default'}. Language: ${language}. Do not include numbering or explanations. Do not use emojis.`;
  const diversePrompt = `Generate ${capped} unique, non-repetitive quotes as a pure JSON array. Each quote must be a complete sentence, between ${minWords ?? maxWords ?? 8} and ${maxWords ?? 'concise'} words, and end with punctuation. Do NOT repeat wording. Vary angles (inspiration, challenge, empathy, action). Topic: "${topic}". Tone: ${tone}. Style: ${style ?? 'default'}. Persona: ${persona ?? 'default'}. Language: ${language}. Do not use emojis.`;

  const parseQuotes = (raw: string, limit: number) => {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return cleanQuotes(parsed, limit, quoteType, maxWords).map(ensureSentenceEnding);
      }
    } catch {
      // fall through
    }
    const split = raw
      .split(/\n+/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return cleanQuotes(split, limit, quoteType, maxWords).map(ensureSentenceEnding);
  };

  const generateAndClean = async (p: string, limit: number) => {
    const raw = await generateCompletion(p, { temperature: 0.8, maxTokens: 800, provider: options.provider });
    return parseQuotes(raw, limit);
  };

  let cleaned: string[] = [];
  const prompts = [prompt, strictPrompt, diversePrompt, strictPrompt];
  for (let attempt = 0; attempt < prompts.length; attempt += 1) {
    cleaned = dedupe(await generateAndClean(prompts[attempt], capped));

    const hasTooFew = cleaned.length < capped;
    const tooShort =
      maxWords != null && maxWords >= 8
        ? cleaned.some((q) => countWords(q) < Math.max(6, Math.floor(maxWords * 0.8)))
        : false;
    const tooLong = maxWords != null ? cleaned.some((q) => countWords(q) > maxWords + 2) : false;
    const hasDuplicates = cleaned.length !== new Set(cleaned.map(normalizeForDedupe)).size;

    if (!hasTooFew && !tooShort && !tooLong && !hasDuplicates) {
      break;
    }
  }

  if (cleaned.length < capped) {
    const missingCount = capped - cleaned.length;
    const followupPrompt = `Generate ${missingCount} NEW quotes as a JSON array of strings only. Do not repeat any of these existing quotes: ${JSON.stringify(
      cleaned,
    )}. Topic: "${topic}". Tone: ${tone}. Style: ${style ?? 'default'}. Persona: ${persona ?? 'default'}. Language: ${language}. ${wordLimitLine} ${formatLine} Do not use emojis. Return JSON array of strings only.`;
    const followup = await generateAndClean(followupPrompt, missingCount);
    cleaned = dedupe([...cleaned, ...followup]);
  }

  if (cleaned.length < capped) {
    const missingCount = capped - cleaned.length;
    const followupPrompt = `Generate ${missingCount} NEW quotes as a JSON array of strings only. Do not repeat any of these existing quotes: ${JSON.stringify(
      cleaned,
    )}. Topic: "${topic}". Tone: ${tone}. Style: ${style ?? 'default'}. Persona: ${persona ?? 'default'}. Language: ${language}. ${wordLimitLine} ${formatLine} Do not use emojis. Return JSON array of strings only.`;
    const followup = await generateAndClean(followupPrompt, missingCount);
    cleaned = dedupe([...cleaned, ...followup]);
  }

  if (cleaned.length < capped) {
    const base = cleaned[cleaned.length - 1] || (language.startsWith('hi') ? 'आज से बेहतर शुरू करो।' : 'Start better today.');
    const prefixes = language.startsWith('hi') ? ['याद रखो:', 'आज से:', 'ध्यान रहे:'] : ['Remember:', 'Starting now:', 'Note this:'];
    let index = 0;
    while (cleaned.length < capped) {
      const prefix = prefixes[index % prefixes.length];
      const combined = `${prefix} ${base}`.trim();
      const clipped = maxWords ? clipToWords(combined, maxWords) : combined;
      const padded = ensureSentenceEnding(clipped);
      const deduped = dedupe([padded, ...cleaned]);
      cleaned = deduped;
      index += 1;
      if (index > prefixes.length * 3) break;
    }
  }

  if (cleaned.length > capped) {
    cleaned = cleaned.slice(0, capped);
  }

  return cleaned;
}

export async function storeQuotePack(record: QuoteRecord) {
  const safeTopic = (record.topic ?? '').trim() || 'Untitled';
  const imageQuotes =
    record.image_quotes ??
    (record.quote_type === 'image' && record.quotes?.length ? record.quotes.map((text) => ({ text })) : null);

  const payload = {
    user_id: record.user_id,
    topic: safeTopic,
    persona: record.persona ?? null,
    tone: record.tone ?? null,
    language: record.language ?? null,
    style: record.style ?? null,
    quote_type: record.quote_type ?? null,
    image_quotes: imageQuotes,
    hook: record.hook ?? null,
    word_limit: record.word_limit ?? null,
    quotes: record.quotes,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from('quotes').insert(payload).select('id').maybeSingle();
  if (!error) return data;

  if (String(error.message).toLowerCase().includes('quote_type')) {
    console.error('quotes.quote_type column is missing. Please run the migration to add it.');
    throw new Error('Database missing quote_type column on quotes table. Please run the provided ALTER TABLE.');
  }

  console.error('Failed to persist quotes', error);
  throw new Error('Unable to save quotes');
}
