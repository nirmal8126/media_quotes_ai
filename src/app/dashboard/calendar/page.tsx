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
  const days = Array.from({ length: 35 }, (_, idx) => idx + 1);

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
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">Content calendar</p>
            <h1 className="text-3xl font-semibold leading-tight">Weekly plan</h1>
            <p className="text-sm text-white/80">Export the weekly 3–5 posts schedule with best times.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-white/20 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/30">
              Export
            </button>
            <button className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-md hover:bg-slate-50">
              Add to calendar
            </button>
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25)_0,_transparent_45%)]" />
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {[
          { label: 'Posts this week', value: entries.length ? entries.length : '0', hint: '+0 vs last week' },
          { label: 'Next post', value: entries[0]?.scheduled_date ? new Date(entries[0].scheduled_date).toLocaleDateString() : 'TBD', hint: entries[0]?.best_time ?? '—' },
          { label: 'Status mix', value: entries.length ? 'In progress' : 'No items', hint: entries.length ? 'Generated/Scheduled' : 'Generate to fill' },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 shadow ring-1 ring-slate-100">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{card.value}</p>
            <p className="text-xs text-slate-500">{card.hint}</p>
          </div>
        ))}
      </section>

      {isLoading && <p className="text-sm text-slate-500">Loading calendar...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section className="grid gap-4 lg:grid-cols-[2fr,1fr]">
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Planner</p>
              <p className="text-lg font-semibold text-slate-900">Monthly view</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                ‹ Prev
              </button>
              <button className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                Next ›
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {days.map((day) => {
              const entry = entries.find((e) => new Date(e.scheduled_date).getDate() === day);
              return (
                <div key={day} className="min-h-[100px] rounded-xl border border-slate-100 bg-white p-2 shadow-sm">
                  <p className="text-xs font-semibold text-slate-500">{day}</p>
                  {entry ? (
                    <div className="mt-2 rounded-lg bg-indigo-50 p-2 text-xs text-indigo-700">
                      {entry.platform} · {entry.status}
                      <div className="text-[11px] text-indigo-500">Best: {entry.best_time}</div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400">No item</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-3 rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">AI Suggestions</p>
            <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-500">Refresh</button>
          </div>
          <div className="space-y-2">
            {['3 hooks for fitness reel', 'Caption for B2B lead gen', 'Monday motivation quote'].map((item) => (
              <div key={item} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-sm text-slate-800">{item}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <button className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow hover:opacity-95">
              Auto-fill week
            </button>
            <button className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              Auto-fill month
            </button>
            <button className="w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
              Export schedule
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
