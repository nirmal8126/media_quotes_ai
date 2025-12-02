import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';

export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { supabase, applyCookies } = session;
  const body = await request.json().catch(() => ({}));
  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : undefined;
  const metadata = typeof body?.metadata === 'object' ? body.metadata : undefined;

  const updates: Record<string, unknown> = {};

  if (fullName) {
    updates.full_name = fullName;
  }
  if (metadata) {
    updates.metadata = metadata;
  }

  if (!Object.keys(updates).length) {
    const response = NextResponse.json({ error: 'No updatable fields provided.' }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabase.auth.updateUser({ data: updates });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: error.status });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ user: data.user });
  applyCookies(response);
  return response;
}
