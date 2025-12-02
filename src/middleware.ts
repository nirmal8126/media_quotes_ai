import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Session } from '@supabase/supabase-js';

const API_OPEN_PREFIXES = ['/api/auth', '/api/payments/webhook'];
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes (each API handles its own auth) but allow unauthenticated auth/webhook paths.
  if (pathname.startsWith('/api')) {
    if (API_OPEN_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return NextResponse.next();
    }
    return NextResponse.next();
  }

  const response = NextResponse.next();
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return response;
  }

  let session: Session | null = null;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          if (!value) {
            response.cookies.delete(name);
            return;
          }
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  async function getSession() {
    if (session !== null) return session;
    const {
      data: { session: gotSession },
    } = await supabase.auth.getSession();
    session = gotSession;
    return session;
  }

  // Redirect authenticated users away from auth pages or the landing page.
  if (pathname.startsWith('/auth') || pathname === '/') {
    const current = await getSession();
    if (current) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return response;
  }

  const current = await getSession();
  if (!current) {
    const signInUrl = new URL('/auth/signin', request.url);
    return NextResponse.redirect(signInUrl);
  }

  return response;
}

export const config = {
  matcher: ['/', '/auth/:path*', '/dashboard/:path*', '/admin/:path*'],
};
