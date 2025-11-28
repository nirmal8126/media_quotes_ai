import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('generated_reels')
    .select('id, tone, platform, script, caption, hashtags, thumbnail_prompt, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: 'Failed to load reels history' }, { status: 500 });
  }

  return NextResponse.json({ reels: data ?? [] });
}
