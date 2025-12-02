import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireUser } from '@/lib/api-auth';

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const { data, error } = await supabaseAdmin
    .from('content_calendar')
    .select('id, reel_id, scheduled_date, best_time, status, platform')
    .eq('user_id', user.id)
    .order('scheduled_date', { ascending: true })
    .limit(7);

  if (error) {
    return NextResponse.json({ error: 'Unable to read calendar' }, { status: 500 });
  }

  const response = NextResponse.json({ schedule: data ?? [] });
  applyCookies(response);
  return response;
}
