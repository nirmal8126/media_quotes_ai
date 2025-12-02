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
    .from('generated_reels')
    .select('id, tone, platform, script, caption, hashtags, thumbnail_prompt, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: 'Failed to load reels history' }, { status: 500 });
  }

  const response = NextResponse.json({ reels: data ?? [] });
  applyCookies(response);
  return response;
}
