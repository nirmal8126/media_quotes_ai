import Link from 'next/link';
import type { ReactNode } from 'react';

const navItems = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/plans', label: 'Plans' },
  { href: '/admin/reels', label: 'Reels' },
  { href: '/admin/quotes', label: 'Quotes' },
  { href: '/admin/meta', label: 'Defaults' },
  { href: '/admin/calendar', label: 'Calendar' },
  { href: '/admin/automations', label: 'Automations' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/users', label: 'Users' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f2f4ff] text-slate-900">
      <div className="mx-auto flex max-w-6xl gap-6 px-4 py-6 md:px-6">
        <aside className="hidden w-64 shrink-0 rounded-3xl border border-slate-200/70 bg-white/95 p-4 shadow-lg md:block">
          <div className="flex items-center gap-3 px-3 py-2">
            <img src="/mediaquotes-logo.svg" alt="MediaQuotes AI" className="h-8 w-auto" />
            <span className="rounded-full bg-[#eef2ff] px-2 py-1 text-xs font-semibold text-[#2287ff]">Admin</span>
          </div>
          <nav className="mt-6 space-y-1 text-sm font-medium text-slate-700">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-[#eef2ff] hover:text-slate-900"
              >
                <span className="h-2 w-2 rounded-full bg-[#2287ff]" />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-8 rounded-2xl border border-slate-200 bg-gradient-to-br from-[#eef2ff] to-white p-4 text-sm text-slate-700 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Superadmin</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">Control center</p>
            <p className="text-slate-500">Audit payments, quotas, and generation runs.</p>
          </div>
        </aside>
        <div className="flex-1 space-y-4">
          <header className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-lg">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#2287ff]">Superadmin console</p>
              <p className="text-lg font-semibold text-slate-900">MediaQuotes AI</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 md:inline-flex">
                Secure
              </span>
              <div className="h-10 w-10 rounded-full bg-[#e8edff] text-center text-sm font-semibold text-[#2287ff] leading-10">
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
