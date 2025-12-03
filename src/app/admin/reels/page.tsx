"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';

type ReelRow = {
  id: string;
  user_id: string | null;
  platform: string | null;
  tone: string | null;
  caption: string | null;
  script: string | null;
  created_at: string | null;
};

type ReelDraft = {
  userId: string;
  platform: string;
  tone: string;
  caption: string;
  script: string;
};

const emptyDraft: ReelDraft = { userId: '', platform: '', tone: '', caption: '', script: '' };

export default function AdminModuleReelsPage() {
  const [rows, setRows] = useState<ReelRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, ReelDraft>>({});
  const [newReel, setNewReel] = useState<ReelDraft>({ ...emptyDraft });
  const [status, setStatus] = useState<string>('Loading...');
  const [busy, setBusy] = useState(false);

  const hydrateDrafts = (data: ReelRow[]) => {
    const next: Record<string, ReelDraft> = {};
    data.forEach((row) => {
      next[row.id] = {
        userId: row.user_id ?? '',
        platform: row.platform ?? '',
        tone: row.tone ?? '',
        caption: row.caption ?? '',
        script: row.script ?? '',
      };
    });
    setDrafts(next);
  };

  const load = async () => {
    setStatus('Loading...');
    try {
      const res = await fetch('/api/admin/reels?limit=100', { credentials: 'include' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Unable to fetch reels');
      }
      const data = (payload.data ?? []) as ReelRow[];
      setRows(data);
      hydrateDrafts(data);
      setStatus(`${data.length} records`);
    } catch (error) {
      setStatus((error as Error).message || 'Unable to fetch reels');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setDraftField = (id: string, field: keyof ReelDraft, value: string) => {
    setDrafts((prev) => ({ ...prev, [id]: { ...(prev[id] ?? emptyDraft), [field]: value } }));
  };

  const send = async (method: 'PATCH' | 'DELETE', body: Record<string, unknown>, success: string) => {
    setBusy(true);
    setStatus('Saving...');
    try {
      const res = await fetch('/api/admin/reels', {
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
        platform: draft.platform.trim(),
        tone: draft.tone.trim(),
        caption: draft.caption.trim(),
        script: draft.script.trim(),
      },
      'Saved',
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this reel? This cannot be undone.')) return;
    await send('DELETE', { id }, 'Deleted');
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setStatus('Creating...');
    try {
      const res = await fetch('/api/admin/reels', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: newReel.userId.trim(),
          platform: newReel.platform.trim(),
          tone: newReel.tone.trim(),
          caption: newReel.caption.trim(),
          script: newReel.script.trim(),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Unable to create reel');
      }
      setNewReel({ ...emptyDraft });
      setStatus('Created');
      await load();
    } catch (error) {
      setStatus((error as Error).message || 'Unable to create reel');
    } finally {
      setBusy(false);
    }
  };

  const currentState = useMemo(() => (busy ? 'Syncing...' : status), [busy, status]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="grid grid-cols-[240px,1fr]">
        <AdminSidebar title="Generated reels" subtitle="CRUD + audit" />
        <main className="px-8 py-10 space-y-6">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-slate-500">AI outputs</p>
              <h2 className="text-3xl font-semibold">Reels table</h2>
              <p className="text-sm text-slate-400">View, edit, create, or delete generated reels.</p>
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
              <span>Reels</span>
              <span>{rows.length} rows</span>
            </div>
            <div className="divide-y divide-slate-900/50">
              {rows.map((row) => {
                const draft = drafts[row.id] ?? emptyDraft;
                return (
                  <div key={row.id} className="grid gap-3 border-b border-slate-900/40 bg-slate-950/40 px-4 py-3 md:grid-cols-[1.2fr,1.2fr,1fr,1fr,auto] md:items-center">
                    <div className="space-y-1 text-sm">
                      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Reel ID</p>
                      <p className="font-semibold text-white">{row.id.slice(0, 10)}</p>
                      <p className="text-[0.7rem] text-slate-400">
                        {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                      </p>
                    </div>
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
                      Platform
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                        value={draft.platform}
                        onChange={(e) => setDraftField(row.id, 'platform', e.target.value)}
                        placeholder="instagram"
                      />
                    </label>
                    <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                      Tone
                      <input
                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                        value={draft.tone}
                        onChange={(e) => setDraftField(row.id, 'tone', e.target.value)}
                        placeholder="educational"
                      />
                    </label>
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
                    <label className="md:col-span-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                      Caption (optional)
                      <textarea
                        className="mt-1 h-16 w-full rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white leading-relaxed"
                        value={draft.caption}
                        onChange={(e) => setDraftField(row.id, 'caption', e.target.value)}
                        placeholder="Edit caption or CTA"
                      />
                    </label>
                    <label className="md:col-span-3 text-xs uppercase tracking-[0.3em] text-slate-500">
                      Script
                      <textarea
                        className="mt-1 h-24 w-full rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white leading-relaxed"
                        value={draft.script}
                        onChange={(e) => setDraftField(row.id, 'script', e.target.value)}
                        placeholder="Long-form script text"
                      />
                    </label>
                  </div>
                );
              })}
              {!rows.length && (
                <div className="px-4 py-6 text-sm text-slate-400">No reels yet.</div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Create</p>
                <h3 className="text-lg font-semibold text-white">Add reel manually</h3>
              </div>
              <span className="text-xs text-slate-400">Creates directly in generated_reels</span>
            </div>
            <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                User ID (optional)
                <input
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                  value={newReel.userId}
                  onChange={(e) => setNewReel((prev) => ({ ...prev, userId: e.target.value }))}
                  placeholder="uuid"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Platform
                <input
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                  value={newReel.platform}
                  onChange={(e) => setNewReel((prev) => ({ ...prev, platform: e.target.value }))}
                  placeholder="instagram"
                  required
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Tone
                <input
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                  value={newReel.tone}
                  onChange={(e) => setNewReel((prev) => ({ ...prev, tone: e.target.value }))}
                  placeholder="educational"
                  required
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Caption
                <input
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white"
                  value={newReel.caption}
                  onChange={(e) => setNewReel((prev) => ({ ...prev, caption: e.target.value }))}
                  placeholder="CTA or caption"
                />
              </label>
              <label className="md:col-span-2 text-xs uppercase tracking-[0.3em] text-slate-500">
                Script
                <textarea
                  className="mt-1 h-24 w-full rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm text-white leading-relaxed"
                  value={newReel.script}
                  onChange={(e) => setNewReel((prev) => ({ ...prev, script: e.target.value }))}
                  placeholder="Paste generated script"
                />
              </label>
              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  className="rounded-full border border-orange-500/60 px-4 py-2 text-xs font-semibold text-orange-300 hover:border-orange-400 disabled:opacity-60"
                  disabled={busy}
                >
                  Create reel
                </button>
                <span className="text-xs text-slate-400">Required: platform & tone</span>
              </div>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}
