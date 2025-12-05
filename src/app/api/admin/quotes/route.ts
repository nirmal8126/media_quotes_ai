import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireUser } from '@/lib/api-auth';
import type { User } from '@supabase/supabase-js';

type QuotesPayload = {
  id?: unknown;
  userId?: unknown;
  persona?: unknown;
  tone?: unknown;
  language?: unknown;
  hook?: unknown;
  wordLimit?: unknown;
  quotes?: unknown;
};

function isSuperAdmin(user: User) {
  const role = (user.app_metadata?.role as string | undefined) ?? (user.user_metadata?.role as string | undefined);
  const flag = user.user_metadata?.is_admin ?? user.user_metadata?.admin;
  return role === 'superadmin' || flag === true;
}

async function ensureAdmin(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return { errorResponse: session.errorResponse };
  }
  if (!isSuperAdmin(session.user)) {
    const response = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    session.applyCookies(response);
    return { errorResponse: response };
  }
  return session;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return Math.max(4, Math.min(Math.round(num), 100));
}

function normalizeQuotes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

const BASE_SELECT = 'id, user_id, persona, tone, language, hook, word_limit, quotes, created_at';
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const auth = await ensureAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : 50;

  const { data, error } = await supabaseAdmin
    .from('quotes')
    .select(BASE_SELECT)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    auth.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ data });
  auth.applyCookies(response);
  return response;
}

export async function POST(request: Request) {
  const auth = await ensureAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const body = (await request.json().catch(() => ({}))) as QuotesPayload;
  const persona = normalizeString(body.persona);
  const tone = normalizeString(body.tone);
  const language = normalizeString(body.language);
  const hook = normalizeString(body.hook);
  const wordLimit = normalizeNumber(body.wordLimit);
  const quotes = normalizeQuotes(body.quotes);
  const userId = normalizeString(body.userId);

  if (!persona && !tone && !language && !hook && !quotes.length) {
    const response = NextResponse.json(
      { error: 'Provide persona, tone, language, hook, or quotes to create a pack.' },
      { status: 422 },
    );
    auth.applyCookies(response);
    return response;
  }

  const payload = {
    user_id: userId || null,
    persona: persona || null,
    tone: tone || null,
    language: language || null,
    hook: hook || null,
    word_limit: wordLimit ?? null,
    quotes: quotes.length ? quotes : null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from('quotes').insert(payload).select(BASE_SELECT).maybeSingle();

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    auth.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ data });
  auth.applyCookies(response);
  return response;
}

export async function PATCH(request: Request) {
  const auth = await ensureAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const body = (await request.json().catch(() => ({}))) as QuotesPayload;
  const id = normalizeString(body.id);
  if (!id) {
    const response = NextResponse.json({ error: 'Quote id is required.' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const updates: Record<string, unknown> = {};
  const userId = normalizeString(body.userId);
  const persona = normalizeString(body.persona);
  const tone = normalizeString(body.tone);
  const language = normalizeString(body.language);
  const hook = normalizeString(body.hook);
  const wordLimit = normalizeNumber(body.wordLimit);
  const quotes = normalizeQuotes(body.quotes);

  if (userId) updates.user_id = userId;
  if (persona) updates.persona = persona;
  if (tone) updates.tone = tone;
  if (language) updates.language = language;
  if (hook) updates.hook = hook;
  if (typeof wordLimit === 'number') updates.word_limit = wordLimit;
  if (quotes.length) updates.quotes = quotes;

  if (!Object.keys(updates).length) {
    const response = NextResponse.json({ error: 'No fields provided to update.' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from('quotes')
    .update(updates)
    .eq('id', id)
    .select(BASE_SELECT)
    .maybeSingle();

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    auth.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ data });
  auth.applyCookies(response);
  return response;
}

export async function DELETE(request: Request) {
  const auth = await ensureAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const body = (await request.json().catch(() => ({}))) as QuotesPayload;
  const id = normalizeString(body.id);
  if (!id) {
    const response = NextResponse.json({ error: 'Quote id is required.' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const { error } = await supabaseAdmin.from('quotes').delete().eq('id', id);
  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    auth.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  auth.applyCookies(response);
  return response;
}
