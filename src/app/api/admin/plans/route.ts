import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';
import { requireUser } from '@/lib/api-auth';
import type { User } from '@supabase/supabase-js';

type PlanPayload = {
  name?: string;
  price?: number;
  reelsPerMonth?: number;
  perks?: string[];
};

function asNumber(value: unknown) {
  const num = typeof value === 'string' ? Number(value.trim()) : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function normalizePerks(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map((perk) => perk.trim())
      .filter(Boolean);
  }
  return [];
}

async function applyResponse(result: { error: PostgrestError | null; data?: unknown }) {
  if (result.error) {
    return NextResponse.json({ error: result.error.message ?? 'Supabase error' }, { status: 500 });
  }
  return NextResponse.json({ success: true, data: result.data });
}

function isSuperAdmin(user: User): boolean {
  const role =
    (user.app_metadata?.role as string | undefined) ??
    (user.user_metadata?.role as string | undefined);
  const flag = user.user_metadata?.is_admin ?? user.user_metadata?.admin;
  return role === 'superadmin' || flag === true;
}

async function ensureAuthenticated(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return { errorResponse: session.errorResponse };
  }

  if (!isSuperAdmin(session.user)) {
    const response = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    session.applyCookies(response);
    return { errorResponse: response };
  }

  return { applyCookies: session.applyCookies };
}

export async function POST(request: Request) {
  const auth = await ensureAuthenticated(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const body = (await request.json()) as PlanPayload;
  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Plan name is required' }, { status: 422 });
  }

  const payload = {
    name: body.name.trim(),
    price: asNumber(body.price) ?? 0,
    reels_per_month: asNumber(body.reelsPerMonth) ?? 0,
    perks: normalizePerks(body.perks),
  };

  const response = await applyResponse(await supabaseAdmin.from('plans').insert(payload));
  auth.applyCookies(response);
  return response;
}

export async function PATCH(request: Request) {
  const auth = await ensureAuthenticated(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: 'Plan id is required' }, { status: 422 });
  }

  const updates: Record<string, unknown> = {};

  if (body.name) {
    updates.name = String(body.name).trim();
  }
  if (body.price !== undefined) {
    const normalized = asNumber(body.price);
    if (normalized !== undefined) {
      updates.price = normalized;
    }
  }
  if (body.reelsPerMonth !== undefined) {
    const normalized = asNumber(body.reelsPerMonth);
    if (normalized !== undefined) {
      updates.reels_per_month = normalized;
    }
  }
  if (body.perks !== undefined) {
    updates.perks = normalizePerks(body.perks);
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No fields provided to update' }, { status: 422 });
  }

  const response = await applyResponse(
    await supabaseAdmin.from('plans').update(updates).eq('id', body.id).select().single(),
  );
  auth.applyCookies(response);
  return response;
}

export async function DELETE(request: Request) {
  const auth = await ensureAuthenticated(request);
  if ('errorResponse' in auth) return auth.errorResponse;

  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: 'Plan id is required' }, { status: 422 });
  }

  const response = await applyResponse(await supabaseAdmin.from('plans').delete().eq('id', body.id));
  auth.applyCookies(response);
  return response;
}
