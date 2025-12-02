"use client";

import { useEffect, useState } from "react";

type MetaType = 'platform' | 'niche' | 'format' | 'tone';
type MetaKey = 'platforms' | 'niches' | 'formats' | 'tones';

type MetaItem = { id: string; name: string };
type MetaGroup = Record<MetaKey, MetaItem[]>;

const groups: Array<{ key: MetaKey; label: string; type: MetaType }> = [
  { key: 'platforms', label: 'Platforms', type: 'platform' },
  { key: 'niches', label: 'Niches / Topics', type: 'niche' },
  { key: 'formats', label: 'Formats', type: 'format' },
  { key: 'tones', label: 'Tones / Styles', type: 'tone' },
];

const emptyState: MetaGroup = { platforms: [], niches: [], formats: [], tones: [] };
const initialNewValues: Record<MetaType, string> = { platform: '', niche: '', format: '', tone: '' };

const buildDraftKey = (type: MetaType, id: string) => `${type}:${id}`;

export default function AdminMetaPage() {
  const [data, setData] = useState<MetaGroup>(emptyState);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newValues, setNewValues] = useState<Record<MetaType, string>>(initialNewValues);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const syncDrafts = (payload: MetaGroup) => {
    const next: Record<string, string> = {};
    groups.forEach((group) => {
      (payload[group.key] ?? []).forEach((item) => {
        next[buildDraftKey(group.type, item.id)] = item.name;
      });
    });
    setDrafts(next);
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/meta', { credentials: 'include' });
      const payload = await res.json().catch(() => ({}));
      if (res.ok) {
        const normalized: MetaGroup = {
          platforms: payload.platforms ?? [],
          niches: payload.niches ?? [],
          formats: payload.formats ?? [],
          tones: payload.tones ?? [],
        };
        setData(normalized);
        syncDrafts(normalized);
        setStatus(null);
      } else {
        setStatus(payload?.error || 'Unable to load defaults');
      }
    } catch (error) {
      setStatus((error as Error).message || 'Unable to load defaults');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runMutation = async (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>, successMessage: string) => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/admin/meta', {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || 'Unable to save changes');
      }
      await load();
      setStatus(successMessage);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async (type: MetaType) => {
    const name = (newValues[type] || '').trim();
    if (!name) {
      setStatus('Enter a value before adding.');
      return;
    }
    await runMutation('POST', { type, name }, 'Saved');
    setNewValues((prev) => ({ ...prev, [type]: '' }));
  };

  const handleUpdate = async (type: MetaType, id: string) => {
    const key = buildDraftKey(type, id);
    const name = (drafts[key] || '').trim();
    if (!name) {
      setStatus('Name cannot be empty.');
      return;
    }
    await runMutation('PATCH', { type, id, name }, 'Updated entry');
  };

  const handleDelete = async (type: MetaType, id: string) => {
    if (!confirm('Delete this entry? This cannot be undone.')) {
      return;
    }
    await runMutation('DELETE', { type, id }, 'Deleted entry');
  };

  const currentState = saving ? 'Syncing with Supabase...' : loading ? 'Loading...' : status ?? 'Ready';

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">Admin</p>
            <h1 className="text-2xl font-semibold text-slate-900">Defaults library</h1>
            <p className="text-sm text-slate-500">Manage default platforms, niches, formats, and tones used in generators.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {currentState}
          </span>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => {
          const items = data[group.key] ?? [];
          return (
            <div key={group.key} className="space-y-3 rounded-3xl bg-white p-5 shadow ring-1 ring-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-indigo-500">{group.label}</p>
                  <p className="text-sm text-slate-500">Add or edit entries used across the app.</p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                  {items.length} items
                </span>
              </div>
              <div className="space-y-2">
                {items.map((item) => {
                  const key = buildDraftKey(group.type, item.id);
                  const value = drafts[key] ?? item.name;
                  return (
                    <div key={item.id} className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2">
                      <input
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
                        value={value}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                      />
                      <button
                        className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-semibold text-white shadow hover:bg-indigo-400 disabled:opacity-60"
                        onClick={() => handleUpdate(group.type, item.id)}
                        disabled={saving}
                        type="button"
                      >
                        Save
                      </button>
                      <button
                        className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
                        onClick={() => handleDelete(group.type, item.id)}
                        disabled={saving}
                        type="button"
                      >
                        Delete
                      </button>
                    </div>
                  );
                })}
                {items.length === 0 && <p className="text-sm text-slate-500">No items yet.</p>}
              </div>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-inner focus:border-indigo-400 focus:outline-none"
                  placeholder={`Add ${group.label.slice(0, -1).toLowerCase()}`}
                  value={newValues[group.type]}
                  onChange={(e) => setNewValues((prev) => ({ ...prev, [group.type]: e.target.value }))}
                />
                <button
                  className="rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-400 disabled:opacity-60"
                  onClick={() => handleAdd(group.type)}
                  disabled={saving}
                  type="button"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {status && !loading && !saving && <p className="text-xs text-slate-500">{status}</p>}
    </div>
  );
}
