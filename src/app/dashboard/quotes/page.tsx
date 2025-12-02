"use client";

import { useEffect, useMemo, useState } from 'react';

type Persona = {
  id: string;
  name: string;
  description?: string | null;
  tone?: string | null;
  language?: string | null;
  tags?: string[] | null;
};

type QuotePack = {
  id: string;
  persona?: string | null;
  tone?: string | null;
  language?: string | null;
  quotes?: string[] | null;
  created_at?: string | null;
};

const defaultPersonas: Persona[] = [
  { id: 'persona-1', name: 'Motivation Guru', tone: 'Inspirational', tags: ['fitness', 'mindset'], language: 'en' },
  { id: 'persona-2', name: 'Business Coach', tone: 'Professional', tags: ['b2b', 'growth'], language: 'en' },
  { id: 'persona-3', name: 'Aesthetic Writer', tone: 'Aesthetic', tags: ['design', 'minimal'], language: 'en' },
];

export default function QuotesPage() {
  const [personas, setPersonas] = useState<Persona[]>(defaultPersonas);
  const [quotePacks, setQuotePacks] = useState<QuotePack[]>([]);
  const [loading, setLoading] = useState({ personas: false, quotes: false, generating: false, creating: false });
  const [form, setForm] = useState({ personaId: '', topic: '', language: 'en', count: '30' });
  const [newPersona, setNewPersona] = useState({ name: '', description: '', tone: '', language: 'en', tags: '' });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchPersonas = async () => {
      setLoading((s) => ({ ...s, personas: true }));
      try {
        const res = await fetch('/api/personas', { credentials: 'include' });
        const payload = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(payload.personas)) {
          setPersonas(payload.personas);
          if (payload.personas[0]) {
            setForm((f) => ({ ...f, personaId: payload.personas[0].id }));
          }
        }
      } finally {
        setLoading((s) => ({ ...s, personas: false }));
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
    fetchPersonas();
    fetchQuotes();
  }, []);

  const selectedPersona = useMemo(() => personas.find((p) => p.id === form.personaId) ?? personas[0] ?? null, [personas, form.personaId]);

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
          topic: form.topic,
          tone: selectedPersona?.tone,
          persona: selectedPersona?.description || selectedPersona?.name,
          language: form.language,
          count: Number(form.count),
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
          persona: selectedPersona?.name,
          language: form.language,
          tone: selectedPersona?.tone,
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

  const handleCreatePersona = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading.creating) return;
    setLoading((s) => ({ ...s, creating: true }));
    setStatus(null);
    try {
      const res = await fetch('/api/personas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newPersona.name,
          description: newPersona.description,
          tone: newPersona.tone,
          language: newPersona.language,
          tags: newPersona.tags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Unable to create persona');
      }
      // refresh personas
      const listRes = await fetch('/api/personas', { credentials: 'include' });
      const listPayload = await listRes.json().catch(() => ({}));
      if (listRes.ok && Array.isArray(listPayload.personas)) {
        setPersonas(listPayload.personas);
      }
      setNewPersona({ name: '', description: '', tone: '', language: 'en', tags: '' });
      setStatus('Persona created');
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setLoading((s) => ({ ...s, creating: false }));
    }
  };

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-6 text-white shadow-lg">
        <div className="relative z-10 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-white/70">Quote studio</p>
            <h1 className="text-3xl font-semibold leading-tight">Create persona-based quote packs</h1>
            <p className="text-sm text-white/80">Generate 30–100 quotes aligned to your brand voice.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href="#personas"
              className="rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/30 hover:bg-white/20"
            >
              View personas
            </a>
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

      <section id="generate" className="space-y-3 rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Generate</p>
            <p className="text-lg font-semibold text-slate-900">New quote pack</p>
            <p className="text-sm text-slate-500">Select persona, language, and pack size.</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 ring-1 ring-indigo-100">
            {loading.generating ? 'Working…' : 'Ready'}
          </span>
        </div>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleGenerate}>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            Persona
            <select
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
              value={form.personaId || selectedPersona?.id || ''}
              onChange={(e) => setForm((f) => ({ ...f, personaId: e.target.value }))}
            >
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.tone}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            Topic
            <input
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
              placeholder="e.g., Self-discipline, Growth"
              value={form.topic}
              onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            Language
            <select
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="es">Spanish</option>
              <option value="ar">Arabic</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-600">
            Pack size
            <select
              className="rounded-2xl border border-slate-200 bg-white p-3 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
              value={form.count}
              onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
            >
              {[10, 30, 50, 100].map((count) => (
                <option key={count} value={count}>
                  {count} quotes
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <button
              className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-500 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
              disabled={loading.generating}
              type="submit"
            >
              {loading.generating ? 'Generating...' : 'Generate quote pack'}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
        <div className="space-y-3 rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Recent packs</p>
              <p className="text-lg font-semibold text-slate-900">History</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
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

        <div id="personas" className="space-y-4 rounded-3xl bg-white/80 p-5 shadow ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Personas</p>
              <p className="text-lg font-semibold text-slate-900">Saved voices</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {loading.personas ? 'Loading...' : `${personas.length} total`}
            </span>
          </div>
          <div className="space-y-2">
            {personas.map((persona) => (
              <div key={persona.id} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between text-sm text-slate-900">
                  <span className="font-semibold">{persona.name}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{persona.language ?? 'en'}</span>
                </div>
                <p className="text-xs text-slate-500">Tone: {persona.tone || 'default'}</p>
                <p className="text-xs text-slate-500">
                  Tags: {(persona.tags ?? []).length ? persona.tags?.join(', ') : '—'}
                </p>
              </div>
            ))}
            {!loading.personas && !personas.length && <p className="text-sm text-slate-500">No personas yet.</p>}
          </div>
          <form className="space-y-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm" onSubmit={handleCreatePersona}>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">New persona</p>
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
              placeholder="Name"
              value={newPersona.name}
              onChange={(e) => setNewPersona((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
              placeholder="Description"
              value={newPersona.description}
              onChange={(e) => setNewPersona((p) => ({ ...p, description: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
              placeholder="Tone"
              value={newPersona.tone}
              onChange={(e) => setNewPersona((p) => ({ ...p, tone: e.target.value }))}
            />
            <input
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
              placeholder="Tags (comma separated)"
              value={newPersona.tags}
              onChange={(e) => setNewPersona((p) => ({ ...p, tags: e.target.value }))}
            />
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
              value={newPersona.language}
              onChange={(e) => setNewPersona((p) => ({ ...p, language: e.target.value }))}
            >
              <option value="en">English</option>
              <option value="hi">Hindi</option>
              <option value="es">Spanish</option>
              <option value="ar">Arabic</option>
            </select>
            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-600 ring-1 ring-indigo-100 disabled:opacity-60"
              disabled={loading.creating}
            >
              {loading.creating ? 'Creating...' : 'Save persona'}
            </button>
          </form>
          {status && <p className="text-xs text-slate-500">{status}</p>}
        </div>
      </section>
    </div>
  );
}
