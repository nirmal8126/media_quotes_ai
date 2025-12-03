"use client";

import { useEffect, useState } from 'react';

type QuotePack = {
  id: string;
  persona?: string | null;
  tone?: string | null;
  language?: string | null;
  quotes?: string[] | null;
  created_at?: string | null;
};

type MetaDefaults = {
  platforms: string[];
  niches: string[];
  formats: string[];
  tones: string[];
};

export default function QuotesPage() {
  const [quotePacks, setQuotePacks] = useState<QuotePack[]>([]);
  const [loading, setLoading] = useState({ quotes: false, generating: false, creating: false });
  const [form, setForm] = useState({
    persona: '',
    topic: '',
    language: 'en',
    count: '30',
    tone: '',
    tags: '',
    niche: '',
    format: '',
  });
  const [status, setStatus] = useState<string | null>(null);
  const [count, setCount] = useState(30);
  const [meta, setMeta] = useState<MetaDefaults>({ platforms: [], niches: [], formats: [], tones: [] });

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await fetch('/api/meta');
        const payload = await res.json().catch(() => ({}));
        if (res.ok) {
          setMeta({
            platforms: payload.platforms ?? [],
            niches: payload.niches ?? [],
            formats: payload.formats ?? [],
            tones: payload.tones ?? [],
          });
          if (!form.tone && payload.tones?.length) {
            setForm((f) => ({ ...f, tone: payload.tones[0] }));
          }
          if (!form.niche && payload.niches?.length) {
            setForm((f) => ({ ...f, niche: payload.niches[0] }));
          }
          if (!form.format && payload.formats?.length) {
            setForm((f) => ({ ...f, format: payload.formats[0] }));
          }
        }
      } catch (error) {
        console.error('Unable to load defaults', error);
      }
    };
    const fetchQuotes = async () => {
      setLoading((s) => ({ ...s, quotes: true }));
      try {
        const res = await fetch('/api/quotes/history', { credentials: 'include' });
        const payload = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(payload.quotes)) {
          setQuotePacks(payload.quotes);
        }
      } finally {
        setLoading((s) => ({ ...s, quotes: false }));
      }
    };
    fetchMeta();
    fetchQuotes();
  }, [form.format, form.niche, form.tone]);

  const handleGenerate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading.generating) return;
    setLoading((s) => ({ ...s, generating: true }));
    setStatus(null);
    try {
      const res = await fetch('/api/quotes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topic: form.topic || form.niche,
          tone: form.tone,
          persona: form.persona,
          language: form.language,
          count,
          tags: form.tags,
          niche: form.niche,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to generate quotes');
      }
      setStatus('Quote pack generated');
      setQuotePacks((prev) => [
        {
          id: payload.packId ?? `local-${Date.now()}`,
          persona: form.persona,
          language: form.language,
          tone: form.tone,
          quotes: payload.quotes ?? [],
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading((s) => ({ ...s, generating: false }));
    }
  };

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-400 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
              <p className="text-xs uppercase tracking-[0.4em] text-white/70">Quote studio</p>
              <h1 className="text-3xl font-semibold leading-tight">Create custom quote packs</h1>
              <p className="text-sm text-white/80">Set tone, niche, format every time you generate.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href="#generate"
                className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-indigo-600 shadow-md hover:bg-slate-50"
              >
                Generate pack
            </a>
          </div>
        </div>
        <div className="absolute inset-y-0 right-0 w-1/3 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.25)_0,_transparent_45%)]" />
      </section>

      <section id="generate" className="grid gap-4 rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100 md:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Input</p>
              <p className="text-lg font-semibold text-slate-900">Quote generator</p>
              <p className="text-sm text-slate-500">Pick persona, niche, tags, and pack size.</p>
            </div>
            <span className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-100">
              {loading.generating ? 'Working…' : 'Ready'}
            </span>
          </div>
          <form className="space-y-3" onSubmit={handleGenerate}>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-sm text-slate-600">Persona(s)</span>
                  <span>e.g., Calm Coach, Startup Mentor</span>
                </div>
                <input
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  placeholder="Enter one or more personas (comma-separated)"
                  value={form.persona}
                  onChange={(e) => setForm((f) => ({ ...f, persona: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-sm text-slate-600">Niche</span>
                  <span>e.g., fitness, saas marketing</span>
                </div>
                <input
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  placeholder="fitness, business, travel..."
                  value={form.niche}
                  onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-sm text-slate-600">Tone</span>
                  <span>e.g., motivational, playful, direct</span>
                </div>
                <input
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  placeholder="Motivational, Dark, Funny..."
                  value={form.tone}
                  onChange={(e) => setForm((f) => ({ ...f, tone: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-sm text-slate-600">Language</span>
                  <span>e.g., en, hi, es</span>
                </div>
                <input
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  placeholder="en, hi, es..."
                  value={form.language}
                  onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="text-sm text-slate-600">Format</span>
                  <span>e.g., quote, caption, hook</span>
                </div>
                <input
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  placeholder="quote, caption, hook..."
                  value={form.format}
                  onChange={(e) => setForm((f) => ({ ...f, format: e.target.value }))}
                />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm text-slate-600">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="text-sm text-slate-600">Tags</span>
                <span>e.g., morning routine, mindset, founders</span>
              </div>
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                placeholder="comma-separated keywords"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
              />
            </label>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600"># of quotes: {count}</span>
              <input
                type="range"
                min={1}
                max={100}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="h-2 w-64 rounded-full bg-slate-200 accent-indigo-500"
              />
            </div>
            <button
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
              disabled={loading.generating}
              type="submit"
            >
              {loading.generating ? 'Generating...' : 'Generate quote pack'}
            </button>
          </form>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Results</p>
              <p className="text-lg font-semibold text-slate-900">Quotes</p>
            </div>
          </div>
          <div className="grid max-h-[520px] gap-3 overflow-auto">
            {quotePacks.length === 0 && <p className="text-sm text-slate-500">No quote packs yet.</p>}
            {quotePacks[0]?.quotes?.map((quote: string, idx: number) => (
              <div key={idx} className="flex items-start justify-between rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-sm text-slate-800">{quote}</p>
                <div className="ml-3 flex flex-col gap-2 text-xs">
                  <button className="rounded-full bg-indigo-50 px-3 py-1 font-semibold text-indigo-600 ring-1 ring-indigo-100">
                    Copy
                  </button>
                  <button className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200">
                    Create post
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-3 rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Recent packs</p>
              <p className="text-lg font-semibold text-slate-900">History</p>
            </div>
            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200">
              {loading.quotes ? 'Loading...' : `${quotePacks.length} shown`}
            </span>
          </div>
          <div className="space-y-3">
            {quotePacks.map((pack) => (
              <div key={pack.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{pack.persona || 'Generic persona'}</span>
                  <span>{pack.created_at ? new Date(pack.created_at).toLocaleString() : ''}</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-900">{pack.tone || 'Custom tone'}</p>
                <p className="text-xs text-slate-500">{(pack.quotes ?? []).length} quotes</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-700">
                  {(pack.quotes ?? []).slice(0, 3).map((quote, idx) => (
                    <li key={idx}>• {quote}</li>
                  ))}
                </ul>
              </div>
            ))}
            {!loading.quotes && quotePacks.length === 0 && <p className="text-sm text-slate-500">No quote packs yet.</p>}
          </div>
        </div>

      </section>
    </div>
  );
}
