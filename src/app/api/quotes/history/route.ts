import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const { data, error } = await supabaseAdmin
    .from('quotes')
    .select('id, topic, persona, tone, language, style, quotes, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    const response = NextResponse.json({ error: 'Unable to load quotes' }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ quotes: data ?? [] });
  applyCookies(response);
  return response;
}
