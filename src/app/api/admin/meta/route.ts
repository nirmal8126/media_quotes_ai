import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

type MetaType = 'platform' | 'niche' | 'format' | 'tone';

const tableMap: Record<MetaType, string> = {
  platform: 'default_platforms',
  niche: 'default_niches',
  format: 'default_formats',
  tone: 'default_tones',
};

export async function GET() {
  const responses = await Promise.all(
    (Object.keys(tableMap) as MetaType[]).map((key) =>
      supabaseAdmin.from(tableMap[key]).select('id, name').then((res) => ({ key, res }))
    )
  );

  const data: Record<string, unknown> = {};
  for (const { key, res } of responses) {
    data[`${key}s`] = res.data ?? [];
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const type = body?.type as MetaType;
  const name = typeof body?.name === 'string' ? body.name.trim() : '';

  if (!type || !tableMap[type] || !name) {
    return NextResponse.json({ error: 'type and name are required' }, { status: 422 });
  }

  const { data, error } = await supabaseAdmin.from(tableMap[type]).insert({ name }).select('id').maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data?.id, name, type });
}
