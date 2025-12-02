import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { buildSupabaseCookies } from '@/lib/supabase-cookies';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase credentials are missing.' }, { status: 500 });
  }

  const supabaseCookies = buildSupabaseCookies(request);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: supabaseCookies.cookies,
  });

  const { error } = await supabase.auth.signOut();

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    supabaseCookies.applyToResponse(response);
    return response;
  }

  const response = NextResponse.json({ success: true, redirect: '/auth/signin' });
  supabaseCookies.applyToResponse(response);
  return response;
}
