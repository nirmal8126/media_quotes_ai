import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase-client';

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.includes('@');
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8;
}

export async function POST(request: Request) {
  const body = await request.json();
  const email = body?.email;
  const password = body?.password;
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : undefined;

  if (!isValidEmail(email) || !isValidPassword(password)) {
    return NextResponse.json(
      { error: 'Email must be valid and password should be at least 8 characters.' },
      { status: 422 },
    );
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ user: data.user });
}
