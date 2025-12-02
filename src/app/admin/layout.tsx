import Link from 'next/link';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/reels', label: 'Reels' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/automations', label: 'Automations' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/users', label: 'Users' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-white text-slate-900">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-64 shrink-0 rounded-3xl bg-white/80 p-4 shadow-[0_20px_50px_-30px_rgba(59,85,246,0.35)] ring-1 ring-slate-100 backdrop-blur md:block">
          <div className="flex items-center gap-3 px-3 py-2">
            <img src="/mediaquotes-logo.svg" alt="MediaQuotes AI" className="h-8 w-auto" />
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600">Admin</span>
          </div>
          <nav className="mt-6 space-y-1 text-sm font-medium text-slate-600">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-indigo-50 hover:text-slate-900"
              >
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-700 p-4 text-sm text-white shadow-lg">
            <p className="text-xs uppercase tracking-[0.3em] text-white/80">Superadmin</p>
            <p className="mt-1 text-lg font-semibold">Control center</p>
            <p className="text-white/80">Audit payments, quotas, and generation runs.</p>
          </div>
        </aside>
        <div className="flex-1 space-y-4">
          <header className="flex items-center justify-between rounded-3xl bg-white/70 p-4 shadow-[0_15px_40px_-30px_rgba(59,85,246,0.35)] ring-1 ring-slate-100 backdrop-blur">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Superadmin console</p>
              <p className="text-lg font-semibold text-slate-900">MediaQuotes AI</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 md:inline-flex">
                Secure
              </span>
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 text-center text-sm font-semibold text-white leading-10">
                MQ
              </div>
            </div>
          </header>
          <main className="space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
