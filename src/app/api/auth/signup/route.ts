import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { supabaseAdmin } from '@/lib/supabase';
import { buildSupabaseCookies } from '@/lib/supabase-cookies';

type SignupPayload = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 2;
}

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

  const body = (await request.json().catch(() => ({}))) as SignupPayload;
  const name = isValidName(body.name) ? body.name.trim() : '';
  const email = isValidEmail(body.email) ? body.email.trim() : '';
  const password = isValidPassword(body.password) ? body.password : '';

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: 'Provide a valid name, email, and password (min 8 characters).' },
      { status: 422 },
    );
  }

  const supabaseCookies = buildSupabaseCookies(request);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: supabaseCookies.cookies,
  });

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
    },
  });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    supabaseCookies.applyToResponse(response);
    return response;
  }

  if (data.user?.id) {
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          id: data.user.id,
          email: data.user.email,
          full_name: name,
          plan_tier: 'standard',
          quota_used: 0,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' },
      );

    if (insertError) {
      const status = (insertError as { status?: number }).status;
      console.error('Failed to sync Supabase auth user to public.users', insertError);
      const response = NextResponse.json(
        { error: 'Database error saving new user', details: insertError.message },
        { status: status ?? 500 },
      );
      supabaseCookies.applyToResponse(response);
      return response;
    }
  }

  const response = NextResponse.json({ user: data.user, session: data.session });
  supabaseCookies.applyToResponse(response);
  return response;
}
