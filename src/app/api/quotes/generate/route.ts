import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { generateQuotesList, storeQuotePack } from '@/lib/quote-service';
import { pickProvider } from '@/lib/llm-provider';
import { defaultProvider } from '@/lib/openai';

type QuotePayload = {
  topic?: string;
  tone?: string;
  persona?: string;
  language?: string;
  style?: string;
  count?: number;
  provider?: 'openai' | 'gemini';
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as QuotePayload;
  const count = Number(body.count ?? 10);
  const safeCount = Number.isFinite(count) ? Math.min(Math.max(count, 1), 100) : 10;
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });

  const quotes = await generateQuotesList({
    topic: body.topic,
    tone: body.tone,
    persona: body.persona,
    language: body.language,
    count: safeCount,
    provider,
  });

  const record = await storeQuotePack({
    user_id: user.id,
    persona: body.persona ?? null,
    tone: body.tone ?? null,
    language: body.language ?? 'en',
    style: body.style ?? null,
    quotes,
  });

  const response = NextResponse.json({
    message: 'Quotes generated',
    quotes,
    packId: record?.id,
  });
  applyCookies(response);
  return response;
}
