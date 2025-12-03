"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';

type QuoteRow = {
  id: string;
  user_id: string | null;
  persona: string | null;
  tone: string | null;
  language: string | null;
  quotes: string[] | null;
  created_at: string | null;
};

type QuoteDraft = {
  userId: string;
  persona: string;
  tone: string;
  language: string;
  quotesText: string;
};

const emptyDraft: QuoteDraft = { userId: '', persona: '', tone: '', language: '', quotesText: '' };

export default function AdminQuotesPage() {
  const [rows, setRows] = useState<QuoteRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, QuoteDraft>>({});
  const [newPack, setNewPack] = useState<QuoteDraft>({ ...emptyDraft });
  const [status, setStatus] = useState<string>('Loading...');
  const [busy, setBusy] = useState(false);

  const hydrateDrafts = (data: QuoteRow[]) => {
    const next: Record<string, QuoteDraft> = {};
    data.forEach((row) => {
      next[row.id] = {
        userId: row.user_id ?? '',
        persona: row.persona ?? '',
        tone: row.tone ?? '',
        language: row.language ?? '',
        quotesText: (row.quotes ?? []).join('\n'),
      };
    });
    setDrafts(next);
  };

  const load = async () => {
    setStatus('Loading...');
    try {
      const res = await fetch('/api/admin/quotes?limit=100', { credentials: 'include' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Unable to fetch quotes');
      }
      const data = (payload.data ?? []) as QuoteRow[];
      setRows(data);
      hydrateDrafts(data);
      setStatus(`${data.length} records`);
    } catch (error) {
      setStatus((error as Error).message || 'Unable to fetch quotes');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setDraftField = (id: string, field: keyof QuoteDraft, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyDraft), [field]: value } }));
  };

  const send = async (method: 'PATCH' | 'DELETE', body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setStatus('Saving...');
    try {
      const res = await fetch('/api/admin/quotes', {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Unable to save changes');
      }
      setStatus(success);
      await load();
    } catch (error) {
      setStatus((error as Error).message || 'Unable to save changes');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (id: string) => {
    const draft = drafts[id] ?? emptyDraft;
    await send(
      'PATCH',
      {
        id,
        userId: draft.userId.trim(),
        persona: draft.persona.trim(),
        tone: draft.tone.trim(),
        language: draft.language.trim(),
        quotes: draft.quotesText,
      },
      'Saved',
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this quote pack? This cannot be undone.')) return;
    await send('DELETE', { id }, 'Deleted');
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus('Creating...');
    try {
      const res = await fetch('/api/admin/quotes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newPack.userId.trim(),
          persona: newPack.persona.trim(),
          tone: newPack.tone.trim(),
          language: newPack.language.trim(),
          quotes: newPack.quotesText,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Unable to create quote pack');
      }
      setNewPack({ ...emptyDraft });
      setStatus('Created');
      await load();
    } catch (error) {
      setStatus((error as Error).message || 'Unable to create quote pack');
    } finally {
      setBusy(false);
    }
  };

  const currentState = useMemo(() => (busy ? 'Syncing...' : status), [busy, status]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Quotes" subtitle="CRUD + audit" />
        <main className="px-8 py-10 space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">Quotes</p>
              <h1 className="text-3xl font-semibold">Quote packs table</h1>
              <p className="text-sm text-slate-400">View, edit, create, or delete generated quote packs.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">{currentState}</span>
              <button
                className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-200 hover:border-orange-400"
                type="button"
                onClick={load}
                disabled={busy}
              >
                Refresh
              </button>
            </div>
          </header>

          <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-[0.3em] text-slate-500">
              <span>Quote packs</span>
              <span>{rows.length} rows</span>
            </div>
            <div className="divide-y divide-slate-900/50">
              {rows.map((row) => {
                const draft = drafts[row.id] ?? emptyDraft;
                return (
                  <div key={row.id} className="grid gap-3 border-b border-slate-900/40 bg-slate-950/40 px-4 py-3 md:grid-cols-[1.2fr,1.2fr,1fr,auto] md:items-center">
                    <div className="space-y-1 text-sm">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Quote ID</p>
                      <p className="font-semibold text-white">{row.id.slice(0, 10)}</p>
                      <p className="text-[0.7rem] text-slate-400">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                      </p>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        User ID
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                          value={draft.userId}
                          onChange={(e) => setDraftField(row.id, 'userId', e.target.value)}
                          placeholder="uuid"
                        />
                      </label>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Persona
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                          value={draft.persona}
                          onChange={(e) => setDraftField(row.id, 'persona', e.target.value)}
                          placeholder="Product marketer"
                        />
                      </label>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Tone
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                          value={draft.tone}
                          onChange={(e) => setDraftField(row.id, 'tone', e.target.value)}
                          placeholder="Inspirational"
                        />
                      </label>
                      <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                        Language
                        <input
                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                          value={draft.language}
                          onChange={(e) => setDraftField(row.id, 'language', e.target.value)}
                          placeholder="en"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <button
                        className="rounded-full border border-orange-500/60 px-4 py-2 font-semibold text-orange-300 hover:border-orange-400"
                        type="button"
                        onClick={() => handleUpdate(row.id)}
                        disabled={busy}
                      >
                        Save
                      </button>
                      <button
                        className="rounded-full border border-red-500/60 px-4 py-2 font-semibold text-red-300 hover:border-red-400"
                        type="button"
                        onClick={() => handleDelete(row.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                    <label className="md:col-span-4 text-xs uppercase tracking-[0.3em] text-slate-500">
                      Quotes (one per line)
                      <textarea
                        className="mt-1 h-24 w-full rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white leading-relaxed"
                        value={draft.quotesText}
                        onChange={(e) => setDraftField(row.id, 'quotesText', e.target.value)}
                        placeholder="Add or edit quotes"
                      />
                    </label>
                  </div>
                );
              })}
              {!rows.length && <div className="px-4 py-6 text-sm text-slate-400">No quotes yet.</div>}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Create</p>
                <h3 className="text-lg font-semibold text-white">Add quote pack manually</h3>
              </div>
              <span className="text-xs text-slate-400">Writes to quotes table</span>
            </div>
            <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                User ID (optional)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                  value={newPack.userId}
                  onChange={(e) => setNewPack((prev) => ({ ...prev, userId: e.target.value }))}
                  placeholder="uuid"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Persona
                <input
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                  value={newPack.persona}
                  onChange={(e) => setNewPack((prev) => ({ ...prev, persona: e.target.value }))}
                  placeholder="Brand voice"
                  required
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Tone
                <input
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                  value={newPack.tone}
                  onChange={(e) => setNewPack((prev) => ({ ...prev, tone: e.target.value }))}
                  placeholder="Playful"
                  required
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Language
                <input
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                  value={newPack.language}
                  onChange={(e) => setNewPack((prev) => ({ ...prev, language: e.target.value }))}
                  placeholder="en"
                  required
                />
              </label>
              <label className="md:col-span-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                Quotes (one per line)
                <textarea
                  className="mt-1 h-24 w-full rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white leading-relaxed"
                  value={newPack.quotesText}
                  onChange={(e) => setNewPack((prev) => ({ ...prev, quotesText: e.target.value }))}
                  placeholder="Enter quotes, one per line"
                  required
                />
              </label>
              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-full border border-orange-500/60 px-4 py-2 text-xs font-semibold text-orange-300 hover:border-orange-400 disabled:opacity-60"
                  disabled={busy}
                >
                  Create quote pack
                </button>
                <span className="text-xs text-slate-400">Required: persona, tone, language, and at least one quote</span>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}
