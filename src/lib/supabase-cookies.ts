import { NextResponse } from 'next/server';
import { parse } from 'cookie';

type CookieItem = {
  name: string;
  value?: string;
  options?: Record<string, unknown>;
};

export type SupabaseCookies = {
  get: (name: string) => string | undefined;
  getAll: () => Array<{ name: string; value?: string }>;
  set: (name: string, value: string, options?: Record<string, unknown>) => void;
  remove: (name: string, options?: Record<string, unknown>) => void;
  setAll: (items: CookieItem[]) => void;
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
      get: (name: string) => parsedCookies[name],
      getAll: () =>
        Object.entries(parsedCookies).map(([name, value]) => ({
          name,
          value,
        })),
      set: async (name, value, options) => {
        pending.push({ name, value, options });
      },
      remove: (name, options) => {
        pending.push({ name, value: '', options: { ...(options ?? {}), maxAge: 0 } });
      },
      setAll: (items) => {
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
