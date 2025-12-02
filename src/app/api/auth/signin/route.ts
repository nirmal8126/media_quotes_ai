import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { buildSupabaseCookies } from '@/lib/supabase-cookies';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.includes('@');
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8;
}

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: 'Supabase credentials are missing.' }, { status: 500 });
  }

  const body = await request.json();
  const email = body?.email;
  const password = body?.password;

  if (!isValidEmail(email) || !isValidPassword(password)) {
    return NextResponse.json(
      { error: 'Email must be valid and password should be at least 8 characters.' },
      { status: 422 },
    );
  }

  const supabaseCookies = buildSupabaseCookies(request);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: supabaseCookies.cookies,
  });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    supabaseCookies.applyToResponse(response);
    return response;
  }

  const response = NextResponse.json({ session: data.session, user: data.user });
  supabaseCookies.applyToResponse(response);
  return response;
}
