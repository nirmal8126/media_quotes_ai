import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { ReactNode } from 'react';
import LogoutButton from '@/app/dashboard/LogoutButton';
import Sidebar from '@/components/dashboard/Sidebar';

type DashboardUserInfo = {
  email: string | null;
  plan: string | null;
  isSuperAdmin: boolean;
};

const navItems = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/dashboard/quotes', label: 'Quote Generator', icon: '✍️' },
  { href: '/dashboard/generate', label: 'Caption / Script', icon: '📝' },
  { href: '/dashboard/calendar', label: 'Planner', icon: '📅' },
  { href: '/dashboard/downloads', label: 'Gallery', icon: '🖼️' },
  { href: '/dashboard/settings', label: 'Persona', icon: '⚙️' },
  { href: '/dashboard/billing', label: 'Billing', icon: '💳' },
];

async function getUserInfo(): Promise<DashboardUserInfo> {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { email: null, plan: null, isSuperAdmin: false };
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
  const user = session?.user;
  const role = (user?.app_metadata?.role as string | undefined) ?? (user?.user_metadata?.role as string | undefined);
  const flag = (user?.user_metadata as { is_admin?: boolean; admin?: boolean } | undefined)?.is_admin;
  const isSuperAdmin = role === 'superadmin' || flag === true || (user?.user_metadata as { admin?: boolean } | undefined)?.admin === true;
  const plan = (user?.user_metadata as { plan_tier?: string } | undefined)?.plan_tier ?? null;
  return { email: user?.email ?? null, plan, isSuperAdmin };
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getUserInfo();

  return (
    <div className="min-h-screen bg-[#f2f4ff] text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-6">
        <Sidebar navItems={navItems} user={{ email: user.email, name: user.email || 'User' }} />

        <div className="flex-1 space-y-4">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="hidden h-10 w-10 items-center justify-center rounded-2xl bg-[#e8edff] text-sm font-semibold text-[#2287ff] md:flex">
                MQ
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#2287ff]">Creator workspace</p>
                <p className="text-lg font-semibold">MediaQuotes AI</p>
              </div>
            </div>
            <div className="flex flex-1 items-center justify-end gap-3 md:justify-between">
              <div className="hidden max-w-md flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 md:flex">
                <span className="text-slate-400">🔍</span>
                <input className="flex-1 bg-transparent outline-none" placeholder="Search scripts, captions, calendars..." />
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="hidden rounded-full bg-slate-100 px-3 py-1 md:inline-flex">Pro</span>
                <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200 ring-2 ring-[#d8e5ff]">
                  <img src="https://api.dicebear.com/9.x/initials/svg?seed=M" alt="avatar" className="h-full w-full object-cover" />
                </div>
                <div className="hidden text-right md:block">
                  <p className="text-sm font-semibold text-slate-900">{user.email ?? 'Creator'}</p>
                  <p className="text-xs text-slate-500">{user.plan ? `${user.plan} plan` : 'Standard plan'}</p>
                </div>
                {user.isSuperAdmin && (
                  <Link
                    href="/admin"
                    className="rounded-full border border-slate-200 bg-[#eef2ff] px-3 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-[#2287ff] shadow-sm hover:border-[#d8e5ff]"
                  >
                    Admin
                  </Link>
                )}
                <LogoutButton />
              </div>
            </div>
          </header>
          <main className="space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
