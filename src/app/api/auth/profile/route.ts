import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase-client';

function extractToken(request: Request) {
  const header = request.headers.get('Authorization') ?? '';
  return header.startsWith('Bearer ') ? header.slice(7) : null;
}

export async function PATCH(request: Request) {
  const token = extractToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Missing access token.' }, { status: 401 });
  }

  const body = await request.json();
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : undefined;
  const metadata = typeof body?.metadata === 'object' ? body.metadata : undefined;

  const supabase = createSupabaseClient(token);
  const updates: Record<string, unknown> = {};

  if (fullName) {
    updates.full_name = fullName;
  }
  if (metadata) {
    updates.metadata = metadata;
  }

  if (!Object.keys(updates).length) {
    return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 422 });
  }

  const { data, error } = await supabase.auth.updateUser({ data: updates });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ user: data.user });
}
