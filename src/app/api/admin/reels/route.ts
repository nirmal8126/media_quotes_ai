import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireUser } from '@/lib/api-auth';
import type { User } from '@supabase/supabase-js';

type ReelPayload = {
  id?: unknown;
  userId?: unknown;
  platform?: unknown;
  tone?: unknown;
  caption?: unknown;
  script?: unknown;
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

const BASE_SELECT = 'id, user_id, platform, tone, caption, script, created_at';
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  const auth = await ensureAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), MAX_LIMIT) : 50;

  const { data, error } = await supabaseAdmin
    .from('generated_reels')
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

  const body = (await request.json().catch(() => ({}))) as ReelPayload;
  const platform = normalizeString(body.platform);
  const tone = normalizeString(body.tone);
  const caption = normalizeString(body.caption);
  const script = normalizeString(body.script);
  const userId = normalizeString(body.userId);

  if (!platform && !tone && !script && !caption) {
    const response = NextResponse.json({ error: 'Provide at least one field to create a reel.' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const payload = {
    user_id: userId || null,
    platform: platform || null,
    tone: tone || null,
    caption: caption || null,
    script: script || null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin.from('generated_reels').insert(payload).select(BASE_SELECT).maybeSingle();

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

  const body = (await request.json().catch(() => ({}))) as ReelPayload;
  const id = normalizeString(body.id);
  if (!id) {
    const response = NextResponse.json({ error: 'Reel id is required.' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const updates: Record<string, unknown> = {};
  const userId = normalizeString(body.userId);
  const platform = normalizeString(body.platform);
  const tone = normalizeString(body.tone);
  const caption = normalizeString(body.caption);
  const script = normalizeString(body.script);

  if (userId) updates.user_id = userId;
  if (platform) updates.platform = platform;
  if (tone) updates.tone = tone;
  if (caption) updates.caption = caption;
  if (script) updates.script = script;

  if (!Object.keys(updates).length) {
    const response = NextResponse.json({ error: 'No fields provided to update.' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from('generated_reels')
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

  const body = (await request.json().catch(() => ({}))) as ReelPayload;
  const id = normalizeString(body.id);
  if (!id) {
    const response = NextResponse.json({ error: 'Reel id is required.' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const { error } = await supabaseAdmin.from('generated_reels').delete().eq('id', id);
  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    auth.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  auth.applyCookies(response);
  return response;
}
