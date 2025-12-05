import { supabaseAdmin } from '@/lib/supabase';
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
      return maxWords ? clipToWords(unescaped, maxWords) : unescaped;
    });
  }

  return cleaned.map((line) => (maxWords ? clipToWords(line, maxWords) : line));
}

export async function generateQuotesList(options: {
  topic?: string;
  tone?: string;
  persona?: string;
  language?: string;
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
    language = 'en',
    count = 10,
    hook,
    wordLimit,
    quoteType = 'text',
  } = options;
  const capped = Math.max(1, Math.min(count, 100));
  const maxWords = Number.isFinite(wordLimit) ? Math.min(Math.max(Number(wordLimit), 4), 100) : null;
  const minWords = maxWords ?? null;

  const personaLine = persona ? `Write in the persona/voice of: ${persona}.` : '';
  const hookLine = hook ? `Anchor the ideas to this hook/angle: ${hook}.` : '';
  const wordLimitLine = maxWords
    ? `Each quote must be exactly ${maxWords} words (count words, not emojis). If you exceed ${maxWords} words, trim to ${maxWords}. Do not return fewer than ${maxWords} words.`
    : 'Keep each quote concise.';

  const formatLine =
    quoteType === 'image'
      ? 'Format as overlay-friendly lines for quote images: use line breaks (\\n) to create 3-6 short lines, keep total words at the required count, use punchy visual language, and end with 1-2 fitting emojis.'
      : 'Format as short text quotes at the required word count, and end with 1-2 fitting emojis.';

  const prompt = `Generate ${capped} short, shareable quotes about "${topic}" in a ${tone} tone. ${personaLine} ${hookLine} ${wordLimitLine} ${formatLine} Language: ${language}. Return JSON array of strings only.`;

  const raw = await generateCompletion(prompt, { temperature: 0.8, maxTokens: 400, provider: options.provider });

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return cleanQuotes(parsed, capped, quoteType, maxWords);
    }
  } catch {
    // fall through
  }

  const split = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return cleanQuotes(split, capped, quoteType, maxWords);
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
