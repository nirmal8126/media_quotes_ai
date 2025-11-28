"use client";

import { useEffect, useState } from 'react';

type CalendarEntry = {
  id: string;
  scheduled_date: string;
  best_time: string;
  status: string;
  platform?: string;
};

export default function CalendarPage() {
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/calendar', { signal: controller.signal })
      .then((res) => res.json())
      .then((payload) => {
        setEntries(payload?.schedule ?? []);
        setIsLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError('Unable to load content calendar');
        setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl space-y-6">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-orange-400">Content calendar</p>
          <h1 className="text-3xl font-semibold">Weekly plan</h1>
        </header>
        {isLoading && <p className="text-sm text-slate-400">Loading calendar...</p>}
        {error && <p className="text-sm text-red-300">{error}</p>}
        <div className="grid gap-4">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-xs text-slate-400">{new Date(entry.scheduled_date).toLocaleDateString()}</p>
              <p className="text-lg font-semibold">{entry.platform ?? 'Reel'} · {entry.status}</p>
              <p className="text-sm text-slate-300">Best time: {entry.best_time}</p>
            </div>
          ))}
          {!isLoading && entries.length === 0 && <p className="text-sm text-slate-500">No scheduled posts yet.</p>}
        </div>
      </div>
    </main>
  );
}
