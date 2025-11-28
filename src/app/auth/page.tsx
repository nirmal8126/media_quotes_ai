import Link from 'next/link';

export default function AuthPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 text-white px-6 py-12">
      <div className="text-center space-y-3 max-w-xl">
        <p className="text-sm uppercase tracking-[0.3em] text-orange-400">MediaQuotes AI</p>
        <h1 className="text-4xl font-semibold">Creator access</h1>
        <p className="text-slate-300">
          Sign in with Supabase Auth (email + magic link) to unlock your monthly reel bundle, thumbnails, captions, and
          posting schedule.
        </p>
      </div>
      <div className="flex flex-col gap-3 text-sm text-slate-200">
        <button className="rounded-full border border-slate-700 px-8 py-3 text-base font-medium text-slate-50">
          Launch Supabase login flow
        </button>
        <button className="rounded-full border border-orange-400 px-8 py-3 text-base font-semibold text-orange-400">
          Magic link email (placeholder)
        </button>
        <Link
          className="text-center text-sm text-slate-400 hover:text-orange-300"
          href="/dashboard"
        >
          Continue to dashboard (stub)
        </Link>
      </div>
    </main>
  );
}
