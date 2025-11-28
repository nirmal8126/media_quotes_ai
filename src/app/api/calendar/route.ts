import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('content_calendar')
    .select('id, reel_id, scheduled_date, best_time, status, platform')
    .order('scheduled_date', { ascending: true })
    .limit(7);

  if (error) {
    return NextResponse.json({ error: 'Unable to read calendar' }, { status: 500 });
  }

  return NextResponse.json({ schedule: data ?? [] });
}
