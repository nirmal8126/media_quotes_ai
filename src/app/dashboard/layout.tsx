import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/generate', label: 'Generate' },
  { href: '/dashboard/downloads', label: 'Downloads' },
  { href: '/dashboard/calendar', label: 'Calendar' },
];

async function getUserEmail() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const cookieStore = await cookies();
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll().map(({ name, value }) => ({ name, value })),
      setAll: () => {},
    },
  });
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.email ?? null;
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const email = await getUserEmail();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-white text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-60 shrink-0 rounded-3xl bg-white/80 p-4 shadow-[0_20px_50px_-30px_rgba(59,85,246,0.35)] ring-1 ring-slate-100 backdrop-blur md:block">
          <div className="flex items-center gap-3 px-3 py-2">
            <img src="/mediaquotes-logo.svg" alt="MediaQuotes AI" className="h-8 w-auto" />
          </div>
          <nav className="mt-6 space-y-1 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-indigo-50 hover:text-slate-900"
              >
                <span className="h-2 w-2 rounded-full bg-indigo-400" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-500 p-4 text-sm text-white shadow-lg">
            <p className="text-xs uppercase tracking-[0.3em] text-white/80">Plan</p>
            <p className="mt-2 text-lg font-semibold">Pro trial</p>
            <p className="text-white/80">60 reels/month + strategy</p>
            <Link
              href="/dashboard/generate"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 text-xs font-semibold text-indigo-600 shadow"
            >
              Start creating
            </Link>
          </div>
        </aside>

        <div className="flex-1 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white/70 p-4 shadow-[0_15px_40px_-30px_rgba(59,85,246,0.35)] ring-1 ring-slate-100 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 text-sm font-semibold text-white md:flex">
                MQ
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Creator workspace</p>
                <p className="text-lg font-semibold">MediaQuotes AI</p>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-end gap-3 md:justify-between">
              <div className="hidden max-w-md flex-1 items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-500 ring-1 ring-slate-200 md:flex">
                <span className="text-slate-400">🔍</span>
                <input className="flex-1 bg-transparent outline-none" placeholder="Search scripts, captions, calendars..." />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="hidden rounded-full bg-slate-100 px-3 py-1 md:inline-flex">Pro</span>
                <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200 ring-2 ring-indigo-200">
                  <img src="https://api.dicebear.com/9.x/initials/svg?seed=M" alt="avatar" className="h-full w-full object-cover" />
                </div>
                <div className="hidden text-right md:block">
                  <p className="text-sm font-semibold text-slate-900">{email ?? 'Creator'}</p>
                  <p className="text-xs text-slate-500">Standard plan</p>
                </div>
              </div>
            </div>
          </header>
          <main className="space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
