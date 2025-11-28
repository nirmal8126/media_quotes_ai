import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { PostgrestError } from '@supabase/supabase-js';

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

export async function POST(request: Request) {
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

  return applyResponse(await supabaseAdmin.from('plans').insert(payload));
}

export async function PATCH(request: Request) {
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

  return applyResponse(
    await supabaseAdmin.from('plans').update(updates).eq('id', body.id).select().single(),
  );
}

export async function DELETE(request: Request) {
  const body = await request.json();
  if (!body.id) {
    return NextResponse.json({ error: 'Plan id is required' }, { status: 422 });
  }

  return applyResponse(await supabaseAdmin.from('plans').delete().eq('id', body.id));
}
