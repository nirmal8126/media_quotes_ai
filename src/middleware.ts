import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase-client';

const PUBLIC_ROUTES = ['/', '/auth', '/auth/signup', '/auth/signin', '/api'];

function extractToken(request: NextRequest) {
  const header = request.headers.get('Authorization') ?? '';
  if (header.startsWith('Bearer ')) {
    return header.slice(7);
  }
  const cookieToken = request.cookies.get('sb:token')?.value;
  return cookieToken ?? null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  const token = extractToken(request);
  if (!token) {
    const signInUrl = new URL('/auth/signin', request.url);
    return NextResponse.redirect(signInUrl);
  }

  const supabase = createSupabaseClient(token);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    const signInUrl = new URL('/auth/signin', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/auth/profile', '/auth/logout', '/auth/password'],
};
