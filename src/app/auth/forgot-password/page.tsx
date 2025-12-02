"use client";

import Link from 'next/link';
import { FormEvent, useState } from 'react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body?.error || 'Unable to send reset email');
      }

      setStatus({ type: 'success', message: 'Password reset email sent.' });
    } catch (error) {
      setStatus({ type: 'error', message: (error as Error).message || 'Something went wrong' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-6 py-12 text-slate-900">
      <div className="space-y-2 text-center">
        <p className="text-xs uppercase tracking-[0.5em] text-orange-400">MediaQuotes AI</p>
        <h1 className="text-3xl font-semibold">Reset your password</h1>
        <p className="text-sm text-slate-600">Enter your account email and we'll send a reset link.</p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.35)]"
      >
        <label className="flex flex-col gap-1 text-slate-600 text-sm">
          Email
          <input
            className="rounded-2xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-orange-400"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@mediaquotes.ai"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-2xl bg-orange-400 px-4 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
          disabled={!email.trim() || isSubmitting}
        >
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </button>
        {status && (
          <p className={`text-center text-xs ${status.type === 'success' ? 'text-green-500' : 'text-rose-500'}`}>
            {status.message}
          </p>
        )}
      </form>
      <div className="text-xs text-slate-500">
        <Link className="underline" href="/auth/signin">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
