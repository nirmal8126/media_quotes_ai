import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { DEFAULT_LANGUAGE } from "@/lib/languages";
import { supabaseAdmin } from "@/lib/supabase";
import { enforceQuoteLimits, generateQuotesList } from "@/lib/quote-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";

type UpdatePayload = {
  id?: string;
  topic?: string | null;
  tone?: string | null;
  persona?: string | null;
  language?: string | null;
  style?: string | null;
  quotes?: string[];
  count?: number;
  wordLimit?: number;
  hook?: string;
  quoteType?: 'text' | 'image';
  provider?: "openai" | "gemini";
  regenerate?: boolean;
};

function normalizeQuoteForDedupe(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?।]+$/g, "")
    .trim();
}

function dedupeQuotes(quotes: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const quote of quotes) {
    const key = normalizeQuoteForDedupe(quote);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(quote);
  }
  return out;
}

export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as UpdatePayload;
  const { id } = body;
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });

  if (!id) {
    const response = NextResponse.json({ error: "Quote id is required." }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from("quotes")
    .select("id, quotes, quote_type, hook, word_limit, tone, persona, language, style")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError || !existing) {
    const response = NextResponse.json({ error: "Quote pack not found." }, { status: 404 });
    applyCookies(response);
    return response;
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.topic === "string") {
    const topic = body.topic.trim();
    updates.topic = topic.length > 0 ? topic : "Untitled";
  }
  if (typeof body.tone === "string") updates.tone = body.tone || null;
  if (typeof body.persona === "string") updates.persona = body.persona || null;
  if (typeof body.language === "string") updates.language = body.language || null;
  if (typeof body.style === "string") updates.style = body.style || null;
  if (Array.isArray(body.quotes)) updates.quotes = body.quotes;

  const wordLimitNum = Number(body.wordLimit);
  const safeWordLimit =
    Number.isFinite(wordLimitNum) && wordLimitNum > 0 ? Math.min(Math.max(Math.round(wordLimitNum), 4), 100) : undefined;
  const safeHook = typeof body.hook === "string" && body.hook.trim().length > 0 ? body.hook.trim() : undefined;
  const safeQuoteType = body.quoteType === "image" ? "image" : "text";
  if (typeof safeHook === "string") updates.hook = safeHook;
  if (typeof safeWordLimit === "number") updates.word_limit = safeWordLimit;
  updates.quote_type = safeQuoteType;

  const requestedCount =
    typeof body.count === "number" && Number.isFinite(body.count) ? Math.max(1, Math.min(Math.round(body.count), 5)) : null;
  const existingCount = Array.isArray(existing.quotes) ? existing.quotes.length : 0;
  const shouldRegenerate =
    Boolean(body.regenerate) ||
    (requestedCount !== null && requestedCount !== existingCount) ||
    (typeof safeHook === "string" && safeHook !== existing.hook) ||
    (typeof safeWordLimit === "number" && safeWordLimit !== existing.word_limit) ||
    safeQuoteType !== (existing.quote_type ?? "text") ||
    (typeof body.style === "string" && body.style !== existing.style) ||
    (typeof body.tone === "string" && body.tone !== existing.tone) ||
    (typeof body.persona === "string" && body.persona !== existing.persona) ||
    (typeof body.language === "string" && body.language !== existing.language);

  if (shouldRegenerate) {
    const countToUse = requestedCount ?? (existingCount || 5);
    try {
      const topicText =
        typeof updates.topic === "string"
          ? updates.topic
          : typeof body.topic === "string" && body.topic.trim()
            ? body.topic.trim()
            : "Untitled";
      const generated = await generateQuotesList({
        topic: topicText,
        tone: (typeof body.tone === "string" && body.tone) || undefined,
        persona: (typeof body.persona === "string" && body.persona) || undefined,
        language: (typeof body.language === "string" && body.language) || DEFAULT_LANGUAGE,
        style: (typeof body.style === "string" && body.style) || undefined,
        count: countToUse,
        wordLimit: safeWordLimit,
        hook: safeHook,
        quoteType: safeQuoteType || (body.quoteType as "text" | "image" | undefined),
        provider,
      });
      const trimmed = enforceQuoteLimits(generated, {
        count: countToUse,
        quoteType: safeQuoteType,
        wordLimit: safeWordLimit ?? null,
      });
      updates.quotes = trimmed;
      if (safeQuoteType === "image") {
        updates.image_quotes = trimmed.map((text: string) => ({ text }));
      } else if (typeof updates.quote_type === "string" && updates.quote_type !== "image") {
        updates.image_quotes = null;
      }
    } catch (err) {
      console.error("Failed to regenerate quotes during update", err);
      const response = NextResponse.json({ error: "Unable to regenerate quotes." }, { status: 500 });
      applyCookies(response);
      return response;
    }
  } else if (Array.isArray(body.quotes)) {
    const cleaned = enforceQuoteLimits(body.quotes, {
      count: requestedCount ?? body.quotes.length ?? 5,
      quoteType: safeQuoteType,
      wordLimit: safeWordLimit ?? null,
    });
    const deduped = dedupeQuotes(cleaned);
    updates.quotes = deduped;
    updates.image_quotes = safeQuoteType === "image" ? deduped.map((text: string) => ({ text })) : null;
  }

  if (Object.keys(updates).length === 0) {
    const response = NextResponse.json({ error: "No fields to update." }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from("quotes")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, topic, persona, tone, language, style, quote_type, image_quotes, quotes, hook, word_limit, created_at")
    .maybeSingle();

  if (error) {
    const needsMigration = String(error.message).toLowerCase().includes("quote_type");
    console.error("Failed to update quote pack", error);
    const response = NextResponse.json(
      {
        error: needsMigration
          ? "Database missing quote_type column on quotes table. Please run ALTER TABLE to add it."
          : "Unable to update quote pack.",
      },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true, quote: data });
  applyCookies(response);
  return response;
}
