import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase-client';

function extractToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function GET(request: Request) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing access token.' }, { status: 401 });
  }

  const supabase = createSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ user: data.user });
}
