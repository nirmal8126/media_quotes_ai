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
  quotes: string[];
  hook?: string | null;
  word_limit?: number | null;
};

function sanitizeQuoteText(input: unknown) {
  if (typeof input !== 'string') return '';
  let text = input
    .replace(/```[\w-]*\s*/gi, '') // drop code fences like ```json
    .replace(/^\s*\[\s*|\s*\]\s*$/g, '') // drop stray brackets
    .replace(/^[\d]+\.\s*/, '') // drop leading numbering
    .replace(/^[-–]\s*/, '') // drop leading dash
    .trim();

  // drop surrounding quotes/backticks
  text = text.replace(/^['"`]+/, '').replace(/['"`]+$/, '').trim();

  if (!text) return '';
  const lower = text.toLowerCase();
  if (lower === 'json') return '';
  if (text === '[' || text === ']') return '';
  return text;
}

function cleanQuotes(list: unknown[], limit: number) {
  return list
    .map((q) => sanitizeQuoteText(q))
    .filter((q) => Boolean(q))
    .slice(0, limit) as string[];
}

export async function generateQuotesList(options: {
  topic?: string;
  tone?: string;
  persona?: string;
  language?: string;
  count?: number;
  hook?: string;
  wordLimit?: number;
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
  } = options;
  const capped = Math.max(1, Math.min(count, 100));
  const maxWords = Number.isFinite(wordLimit) ? Math.min(Math.max(Number(wordLimit), 4), 100) : null;

  const personaLine = persona ? `Write in the persona/voice of: ${persona}.` : '';
  const hookLine = hook ? `Anchor the ideas to this hook/angle: ${hook}.` : '';
  const wordLimitLine = maxWords ? `Cap each quote at ${maxWords} words.` : 'Keep each quote concise.';

  const prompt = `Generate ${capped} short, shareable quotes about "${topic}" in a ${tone} tone. ${personaLine} ${hookLine} ${wordLimitLine} Language: ${language}. Return JSON array of strings only.`;

  const raw = await generateCompletion(prompt, { temperature: 0.8, maxTokens: 400, provider: options.provider });

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return cleanQuotes(parsed, capped);
    }
  } catch {
    // fall through
  }

  const split = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return cleanQuotes(split, capped);
}

export async function storeQuotePack(record: QuoteRecord) {
  const safeTopic = (record.topic ?? '').trim() || 'Untitled';

  const payload = {
    user_id: record.user_id,
    topic: safeTopic,
    persona: record.persona ?? null,
    tone: record.tone ?? null,
    language: record.language ?? null,
    style: record.style ?? null,
    hook: record.hook ?? null,
    word_limit: record.word_limit ?? null,
    quotes: record.quotes,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from('quotes').insert(payload).select('id').maybeSingle();
  if (error) {
    console.error('Failed to persist quotes', error);
    throw new Error('Unable to save quotes');
  }
  return data;
}
