import Link from 'next/link';

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-white px-6 py-10">
      <section className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.4em] text-orange-400">Creator dashboard</p>
          <h1 className="text-4xl font-semibold">MediaQuotes AI – Creator Edition</h1>
          <p className="text-slate-300">
            Generate 30 reels per month with scripts, thumbnails, captions, hashtags, hooks, and a weekly posting schedule.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { href: '/dashboard/generate', title: 'Generate reels', desc: 'Pick tone + platform, trigger AI APIs, and build your batch.' },
            { href: '/dashboard/downloads', title: 'Download assets', desc: 'Export scripts, prompts, thumbnails, and hashtag packs.' },
            { href: '/dashboard/calendar', title: 'Content calendar', desc: 'Export the weekly 3–5 posts schedule with best times.' },
          ].map((card) => (
            <Link key={card.href} href={card.href} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:border-orange-400">
              <p className="text-lg font-semibold">{card.title}</p>
              <p className="text-sm text-slate-400">{card.desc}</p>
            </Link>
          ))}
        </div>
        <div className="rounded-2xl border border-orange-400/40 bg-gradient-to-r from-orange-500/10 to-amber-500/5 p-5 text-slate-200">
          <p className="text-sm">Plan status: Standard (30 reels/mo)</p>
          <p className="text-3xl font-semibold text-white">Quota used: 12 / 30</p>
          <p className="text-sm text-slate-300">Next auto-generation in 5 days (Phase 3 automation agent)</p>
        </div>
      </section>
    </main>
  );
}
