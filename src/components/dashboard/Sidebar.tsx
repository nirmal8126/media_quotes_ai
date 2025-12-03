"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import LogoutButton from '@/app/dashboard/LogoutButton';

type NavItem = { label: string; href: string; icon: string };
type UserInfo = { email: string | null; name?: string | null; avatarUrl?: string | null };

type SidebarProps = {
  navItems: NavItem[];
  user: UserInfo;
};

const profileLinks = [
  { label: 'Profile Settings', href: '/dashboard/settings' },
  { label: 'Billing', href: '/dashboard/billing' },
  { label: 'Support', href: '/dashboard/support' },
];

export default function Sidebar({ navItems, user }: SidebarProps) {
  const pathname = usePathname();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <aside className="hidden h-[calc(100vh-48px)] w-64 shrink-0 rounded-3xl border border-slate-200/70 bg-white/95 p-4 shadow-lg md:sticky md:top-6 md:block">
      <div className="flex items-center gap-3 px-2 py-2">
        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#2287ff] to-[#7cc3ff] text-center text-lg font-semibold text-white leading-9">
          MQ
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900">MediaQuotes AI</p>
          <p className="text-xs text-slate-500">Creator workspace</p>
        </div>
      </div>
      <nav className="mt-6 space-y-1 text-sm font-medium text-slate-700">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                active ? 'bg-[#eaf1ff] text-[#2287ff]' : 'hover:bg-[#eef2ff] hover:text-slate-900'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-gradient-to-br from-[#eef2ff] to-white p-4 text-sm text-slate-700 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Plan</p>
        <p className="mt-2 text-lg font-semibold text-slate-900">Pro trial</p>
        <p className="text-slate-500">60 reels/month + strategy</p>
        <Link
          href="/dashboard/generate"
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#2287ff] px-3 py-2 text-xs font-semibold text-white shadow hover:bg-[#1b74d7]"
        >
          Start creating
        </Link>
      </div>

      <div className="relative mt-10">
        <button
          type="button"
          onClick={() => setShowProfile((prev) => !prev)}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3 text-left shadow-sm hover:border-[#d8e5ff]"
        >
          <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-200 ring-2 ring-[#d8e5ff]">
            <img
              src={user.avatarUrl || 'https://api.dicebear.com/9.x/initials/svg?seed=User'}
              alt="avatar"
              className="h-full w-full object-cover"
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{user.name || 'User'}</p>
            <p className="text-xs text-slate-500">{user.email ?? 'Signed in'}</p>
          </div>
          <span className="ml-auto text-slate-400">›</span>
        </button>

        {showProfile && (
          <div className="absolute left-full top-0 z-20 ml-3 w-72 rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
              <div className="h-12 w-12 overflow-hidden rounded-full bg-slate-200 ring-2 ring-[#d8e5ff]">
                <img
                  src={user.avatarUrl || 'https://api.dicebear.com/9.x/initials/svg?seed=User'}
                  alt="avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <div>
                <p className="text-base font-semibold text-slate-900">{user.name || 'User'}</p>
                <p className="text-xs text-slate-500">{user.email ?? ''}</p>
              </div>
            </div>
            <div className="space-y-1 px-4 py-3 text-sm text-slate-700">
              {profileLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center justify-between rounded-xl px-3 py-2 hover:bg-[#eef2ff]"
                >
                  <span>{link.label}</span>
                  <span className="text-slate-400">›</span>
                </Link>
              ))}
            </div>
            <div className="border-t border-slate-100 px-4 py-3">
              <LogoutButton />
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
