import { supabaseAdmin } from '@/lib/supabase';
import { generateCompletion, type LlmProvider } from '@/lib/openai';

export type QuoteRecord = {
  id?: string;
  user_id: string;
  persona?: string | null;
  tone?: string | null;
  language?: string | null;
  style?: string | null;
  quotes: string[];
};

export async function generateQuotesList(options: {
  topic?: string;
  tone?: string;
  persona?: string;
  language?: string;
  count?: number;
  provider?: LlmProvider;
}) {
  const { topic = 'general inspiration', tone = 'motivational', persona, language = 'en', count = 10 } = options;
  const capped = Math.max(1, Math.min(count, 100));

  const personaLine = persona ? `Write in the persona/voice of: ${persona}.` : '';
  const prompt = `Generate ${capped} short, shareable quotes about "${topic}" in a ${tone} tone. ${personaLine} Language: ${language}. Return JSON array of strings only.`;

  const raw = await generateCompletion(prompt, { temperature: 0.8, maxTokens: 400, provider: options.provider });

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((q) => String(q).trim()).filter(Boolean);
    }
  } catch {
    // fall through
  }

  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^\d+\.\s*/, '').replace(/^[-–]\s*/, '').trim())
    .filter((line) => line.length > 0)
    .slice(0, capped);
}

export async function storeQuotePack(record: QuoteRecord) {
  const payload = {
    user_id: record.user_id,
    persona: record.persona ?? null,
    tone: record.tone ?? null,
    language: record.language ?? null,
    style: record.style ?? null,
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
