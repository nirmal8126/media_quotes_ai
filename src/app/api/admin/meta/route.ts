import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireUser } from '@/lib/api-auth';
import type { User } from '@supabase/supabase-js';

type MetaType = 'platform' | 'niche' | 'format' | 'tone';

const tableMap: Record<MetaType, string> = {
  platform: 'default_platforms',
  niche: 'default_niches',
  format: 'default_formats',
  tone: 'default_tones',
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

function normalizeType(value: unknown): MetaType | null {
  if (typeof value !== 'string') return null;
  if (['platform', 'niche', 'format', 'tone'].includes(value)) {
    return value as MetaType;
  }
  return null;
}

function normalizeName(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET(request: Request) {
  const auth = await ensureAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const responses = await Promise.all(
    (Object.keys(tableMap) as MetaType[]).map((key) =>
      supabaseAdmin.from(tableMap[key]).select('id, name').then((res) => ({ key, res }))
    )
  );

  const data: Record<string, unknown> = {};
  for (const { key, res } of responses) {
    data[`${key}s`] = res.data ?? [];
  }

  const response = NextResponse.json(data);
  auth.applyCookies(response);
  return response;
}

export async function POST(request: Request) {
  const auth = await ensureAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const body = await request.json().catch(() => ({}));
  const type = normalizeType(body?.type);
  const name = normalizeName(body?.name);

  if (!type || !tableMap[type] || !name) {
    const response = NextResponse.json({ error: 'type and name are required' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin.from(tableMap[type]).insert({ name }).select('id, name').maybeSingle();
  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    auth.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ id: data?.id, name, type });
  auth.applyCookies(response);
  return response;
}

export async function PATCH(request: Request) {
  const auth = await ensureAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const body = await request.json().catch(() => ({}));
  const type = normalizeType(body?.type);
  const id = typeof body?.id === 'string' ? body.id : null;
  const name = normalizeName(body?.name);

  if (!type || !tableMap[type] || !id || !name) {
    const response = NextResponse.json({ error: 'type, id, and name are required' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from(tableMap[type])
    .update({ name })
    .eq('id', id)
    .select('id, name')
    .maybeSingle();

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    auth.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ id: data?.id, name, type });
  auth.applyCookies(response);
  return response;
}

export async function DELETE(request: Request) {
  const auth = await ensureAdmin(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const body = await request.json().catch(() => ({}));
  const type = normalizeType(body?.type);
  const id = typeof body?.id === 'string' ? body.id : null;

  if (!type || !tableMap[type] || !id) {
    const response = NextResponse.json({ error: 'type and id are required' }, { status: 422 });
    auth.applyCookies(response);
    return response;
  }

  const { error } = await supabaseAdmin.from(tableMap[type]).delete().eq('id', id);
  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    auth.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true, id, type });
  auth.applyCookies(response);
  return response;
}
