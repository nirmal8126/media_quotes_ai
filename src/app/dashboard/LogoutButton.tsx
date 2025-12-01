"use client";

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      router.replace('/auth');
      return;
    }

    setIsLoggingOut(false);
    console.error('Failed to log out', await response.text().catch(() => '')); 
  };

  return (
    <button
      type="button"
      className="rounded-full border border-white/30 bg-white/10 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-white transition hover:border-white/40 disabled:opacity-50"
      onClick={handleLogout}
      disabled={isLoggingOut}
    >
      {isLoggingOut ? 'Logging out…' : 'Log out'}
    </button>
  );
}
