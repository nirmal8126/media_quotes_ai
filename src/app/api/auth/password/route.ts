import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase-client';

function extractToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8;
}

export async function PATCH(request: Request) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing access token.' }, { status: 401 });
  }

  const body = await request.json();
  const password = body?.password;

  if (!isValidPassword(password)) {
    return NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 422 });
  }

  const supabase = createSupabaseClient(token);
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ user: data.user });
}
