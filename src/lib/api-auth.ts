import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { buildSupabaseCookies } from '@/lib/supabase-cookies';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type UserResult =
  | { user: User; applyCookies: (response: NextResponse) => void; supabase: SupabaseClient }
  | { errorResponse: NextResponse };

export async function requireUser(request: Request): Promise<UserResult> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      errorResponse: NextResponse.json({ error: 'Supabase credentials are missing.' }, { status: 500 }),
    };
  }

  const supabaseCookies = buildSupabaseCookies(request);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: supabaseCookies.cookies,
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    supabaseCookies.applyToResponse(response);
    return { errorResponse: response };
  }

  return {
    user: data.user,
    supabase,
    applyCookies: (response: NextResponse) => supabaseCookies.applyToResponse(response),
  };
}

export function isSuperAdmin(user: User): boolean {
  const role =
    (user.app_metadata?.role as string | undefined) ??
    (user.user_metadata?.role as string | undefined);
  const flag = user.user_metadata?.is_admin ?? user.user_metadata?.admin;
  return role === 'superadmin' || flag === true;
}

export async function requireSuperAdmin(request: Request): Promise<UserResult> {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session;
  }

  if (!isSuperAdmin(session.user)) {
    const response = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    session.applyCookies(response);
    return { errorResponse: response };
  }

  return session;
}
