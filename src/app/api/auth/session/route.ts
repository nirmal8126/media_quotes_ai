import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { buildSupabaseCookies } from '@/lib/supabase-cookies';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function GET(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase credentials are missing.' }, { status: 500 });
  }

  const supabaseCookies = buildSupabaseCookies(request);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: supabaseCookies.cookies,
  });

  const { data, error } = await supabase.auth.getUser();

  if (error) {
    const fallbackStatus = typeof error.status === 'number' && error.status >= 400 && error.status <= 599 ? error.status : 500;
    const response = NextResponse.json({ error: error.message }, { status: fallbackStatus });
    supabaseCookies.applyToResponse(response);
    return response;
  }

  const response = NextResponse.json({ user: data.user });
  supabaseCookies.applyToResponse(response);
  return response;
}
