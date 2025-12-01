import { NextResponse } from 'next/server';
import { parse } from 'cookie';

type CookieItem = {
  name: string;
  value?: string;
  options?: Record<string, unknown>;
};

export type SupabaseCookies = {
  getAll: () => Array<{ name: string; value?: string }>;
  setAll: (items: CookieItem[]) => Promise<void>;
};

export type SupabaseCookieAdapter = {
  cookies: SupabaseCookies;
  applyToResponse: (response: NextResponse) => void;
};

export function buildSupabaseCookies(request: Request): SupabaseCookieAdapter {
  const cookieHeader = request.headers.get('cookie') ?? '';
  const parsedCookies = parse(cookieHeader);
  const pending: CookieItem[] = [];

  return {
    cookies: {
      getAll: () =>
        Object.entries(parsedCookies).map(([name, value]) => ({
          name,
          value,
        })),
      setAll: async (items) => {
        pending.push(...items);
      },
    },
    applyToResponse(response: NextResponse) {
      pending.forEach((item) => {
        if (item.value) {
          response.cookies.set(item.name, item.value, item.options ?? {});
        } else {
          response.cookies.delete(item.name);
        }
      });
    },
  };
}
