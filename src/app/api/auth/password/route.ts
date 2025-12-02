import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8;
}

export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { supabase, applyCookies } = session;
  const body = await request.json().catch(() => ({}));
  const password = body?.password;

  if (!isValidPassword(password)) {
    const response = NextResponse.json({ error: 'Password must be at least 8 characters.' }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: error.status });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ user: data.user });
  applyCookies(response);
  return response;
}
