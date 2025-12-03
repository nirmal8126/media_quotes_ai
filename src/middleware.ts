import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPEN_PATH_PREFIXES = ["/api", "/_next", "/images", "/favicon.ico"];
const AUTH_PATHS = ["/auth/sign-in", "/auth/sign-up", "/auth/forgot-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (OPEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let session: Session | null = null;
  const pendingCookies: { name: string; value?: string; options?: Record<string, unknown> }[] = [];

  const applyCookies = (res: NextResponse) => {
    pendingCookies.forEach(({ name, value, options }) => {
      if (value) {
        res.cookies.set(name, value, options ?? {});
      } else {
        res.cookies.delete(name);
      }
    });
  };

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () =>
        request.cookies.getAll().map(({ name, value }) => ({
          name,
          value,
        })),
      setAll(cookies) {
        pendingCookies.push(...cookies);
      },
    },
  });

  async function getSession() {
    if (session !== null) return session;
    const {
      data: { session: supabaseSession },
    } = await supabase.auth.getSession();
    session = supabaseSession;
    return session;
  }

  if (AUTH_PATHS.some((authPath) => pathname.startsWith(authPath))) {
    const current = await getSession();
    if (current) {
      const redirectResponse = NextResponse.redirect(new URL("/", request.url));
      applyCookies(redirectResponse);
      return redirectResponse;
    }
    const nextResponse = NextResponse.next();
    applyCookies(nextResponse);
    return nextResponse;
  }

  const current = await getSession();
  if (!current) {
    const signInUrl = new URL("/auth/sign-in", request.url);
    signInUrl.searchParams.set("redirectedFrom", pathname);
    const redirectResponse = NextResponse.redirect(signInUrl);
    applyCookies(redirectResponse);
    return redirectResponse;
  }

  const nextResponse = NextResponse.next();
  applyCookies(nextResponse);
  return nextResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|images/).*)"],
};
