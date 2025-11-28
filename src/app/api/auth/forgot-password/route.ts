import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase-client';

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.includes('@');
}

export async function POST(request: Request) {
  const body = await request.json();
  const email = body?.email;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Valid email is required.' }, { status: 422 });
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/reset-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ message: 'Password reset email sent.', data });
}
