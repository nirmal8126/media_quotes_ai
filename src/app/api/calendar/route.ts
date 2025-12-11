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

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as {
    reelId?: string;
    scheduledDate?: string;
    bestTime?: string;
    status?: string;
    platform?: string;
  };

  const reelId = body.reelId;
  if (!reelId) {
    const response = NextResponse.json({ error: "reelId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const scheduledDate = body.scheduledDate || new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const bestTime = body.bestTime || "Best time TBD";
  const status = body.status || "planned";
  const platform = body.platform || "instagram";

  const { data, error } = await supabaseAdmin
    .from("content_calendar")
    .insert({
      user_id: user.id,
      reel_id: reelId,
      scheduled_date: scheduledDate,
      best_time: bestTime,
      status,
      platform,
    })
    .select("id, reel_id, scheduled_date, best_time, status, platform")
    .maybeSingle();

  if (error) {
    const response = NextResponse.json({ error: "Unable to add to planner" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ entry: data });
  applyCookies(response);
  return response;
}
