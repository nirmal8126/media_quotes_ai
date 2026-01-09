import { NextResponse } from 'next/server';
import { requireUser } from "@/lib/api-auth";
import { DEFAULT_LANGUAGE, resolveLanguageCode } from "@/lib/languages";
import { enforceQuoteLimits, generateQuotesList, storeQuotePack } from "@/lib/quote-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";

type QuotePayload = {
  topic?: string;
  tone?: string;
  persona?: string;
  language?: string;
  style?: string;
  count?: number;
  wordLimit?: number;
  hook?: string;
  quoteType?: 'text' | 'image';
  provider?: 'openai' | 'gemini';
};

function resolveLanguage(input?: string | null) {
  if (!input) return DEFAULT_LANGUAGE;
  const normalized = input.trim();
  if (!normalized) return DEFAULT_LANGUAGE;
  return resolveLanguageCode(normalized) || DEFAULT_LANGUAGE;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as QuotePayload;
  const safeTopic = (body.topic ?? "").trim() || "Untitled";
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const count = Number(body.count ?? 5);
  const safeCount = Number.isFinite(count) ? Math.min(Math.max(count, 1), 5) : 5;
  const wordLimit = Number(body.wordLimit);
  const safeWordLimit = Number.isFinite(wordLimit) ? Math.min(Math.max(Math.round(wordLimit), 4), 100) : undefined;
  const safeHook = (body.hook ?? "").trim() || undefined;
  const safeQuoteType = body.quoteType === 'image' ? 'image' : 'text';
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });

  const resolvedLanguage = resolveLanguage(body.language);
  let quotes: string[] = [];
  try {
    const generated = await generateQuotesList({
      topic: safeTopic,
      tone: body.tone,
      persona: body.persona,
      language: resolvedLanguage,
      style: body.style,
      count: safeCount,
      wordLimit: safeWordLimit,
      hook: safeHook,
      quoteType: safeQuoteType,
      provider,
    });
    quotes = enforceQuoteLimits(generated, {
      count: safeCount,
      quoteType: safeQuoteType,
      wordLimit: safeWordLimit ?? null,
    });
  } catch (error) {
    console.error("Quote generation failed", error);
    const response = NextResponse.json(
      { error: "Quote generation failed. Please try again." },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
  const imageQuotes = safeQuoteType === 'image' ? quotes.map((text: string) => ({ text })) : null;

  try {
    const record = await storeQuotePack({
      user_id: user.id,
      topic: safeTopic,
      persona: body.persona ?? null,
      tone: body.tone ?? null,
      language: resolvedLanguage,
      style: body.style ?? null,
      quote_type: safeQuoteType,
      hook: safeHook ?? null,
      word_limit: safeWordLimit ?? null,
      image_quotes: imageQuotes,
      quotes,
    });

    const response = NextResponse.json({
      message: "Quotes generated",
      quotes,
      packId: record?.id,
    });
    applyCookies(response);
    return response;
  } catch (error) {
    console.error("Failed to save quotes", error);
    const response = NextResponse.json(
      { error: "Failed to save quotes. Please try again." },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
