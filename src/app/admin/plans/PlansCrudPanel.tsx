'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type PlanRecord = {
  id: string;
  name: string | null;
  reels_per_month: number | null;
  price: number | null;
  perks: string[] | null;
};

type EditablePlanRow = {
  id: string;
  name: string;
  reelsPerMonth: string;
  price: string;
  perksText: string;
};

type PlansCrudPanelProps = {
  plans: PlanRecord[];
};

const perksFromText = (text: string) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

const editRowsFromPlans = (plans: PlanRecord[]): EditablePlanRow[] =>
  plans.map((plan) => ({
    id: plan.id,
    name: plan.name ?? '',
    reelsPerMonth: String(plan.reels_per_month ?? ''),
    price: String(plan.price ?? ''),
    perksText: (plan.perks ?? []).join('\n'),
  }));

export default function PlansCrudPanel({ plans }: PlansCrudPanelProps) {
  const router = useRouter();
  const [rows, setRows] = useState<EditablePlanRow[]>(() => editRowsFromPlans(plans));
  const [notification, setNotification] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newPlan, setNewPlan] = useState({
    name: '',
    reelsPerMonth: '',
    price: '',
    perksText: '',
  });

  useEffect(() => {
    setRows(editRowsFromPlans(plans));
  }, [plans]);

  const status = useMemo(() => (busy ? 'Syncing with Supabase…' : notification), [busy, notification]);

  const sendRequest = async (method: 'POST' | 'PATCH' | 'DELETE', body: Record<string, unknown>) => {
    setBusy(true);
    setNotification(null);

    try {
      const response = await fetch('/api/admin/plans', {
        method,
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(payload.error ?? 'Something went wrong');
      }

      setNotification('Plan synced — refreshing…');
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setNotification(error.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleUpdate = async (row: EditablePlanRow) => {
    await sendRequest('PATCH', {
      id: row.id,
      name: row.name,
      price: Number(row.price) || 0,
      reelsPerMonth: Number(row.reelsPerMonth) || 0,
      perks: perksFromText(row.perksText),
    });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this plan permanently?')) {
      return;
    }

    await sendRequest('DELETE', { id });
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newPlan.name.trim()) {
      setNotification('Provide a name for the new plan before saving.');
      return;
    }

    await sendRequest('POST', {
      name: newPlan.name.trim(),
      price: Number(newPlan.price) || 0,
      reelsPerMonth: Number(newPlan.reelsPerMonth) || 0,
      perks: perksFromText(newPlan.perksText),
    });

    setNewPlan({ name: '', reelsPerMonth: '', price: '', perksText: '' });
  };

  const updateRowField = (id: string, field: keyof EditablePlanRow, value: string) => {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-lg font-semibold">{row.name || 'Untitled plan'}</h3>
              <p className="text-xs text-slate-400">ID · {row.id.slice(0, 8)}</p>
            </div>
            <label className="mt-4 block text-xs uppercase tracking-[0.3em] text-slate-500">Name</label>
            <input
              value={row.name}
              onChange={(event) => updateRowField(row.id, 'name', event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
            />
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Reels / month
                <input
                  value={row.reelsPerMonth}
                  onChange={(event) => updateRowField(row.id, 'reelsPerMonth', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
                  type="number"
                />
              </label>
              <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
                Price (₹)
                <input
                  value={row.price}
                  onChange={(event) => updateRowField(row.id, 'price', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
                  type="number"
                />
              </label>
            </div>
            <label className="mt-3 block text-xs uppercase tracking-[0.3em] text-slate-500">Perks (one per line)</label>
            <textarea
              value={row.perksText}
              onChange={(event) => updateRowField(row.id, 'perksText', event.target.value)}
              className="mt-1 h-24 w-full rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm leading-relaxed"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleUpdate(row)}
                className="rounded-full border border-orange-500/60 px-4 py-2 text-xs font-semibold text-orange-300"
                disabled={busy}
              >
                Save edits
              </button>
              <button
                type="button"
                onClick={() => handleDelete(row.id)}
                className="rounded-full border border-red-500/60 px-4 py-2 text-xs font-semibold text-red-300"
                disabled={busy}
              >
                Delete plan
              </button>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleCreate} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">Create new plan</h3>
          <span className="text-xs text-slate-500">Autosaves to Supabase</span>
        </div>
        <label className="mt-4 block text-xs uppercase tracking-[0.3em] text-slate-500">Name</label>
        <input
          value={newPlan.name}
          onChange={(event) => setNewPlan((prev) => ({ ...prev, name: event.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Reels / month
            <input
              value={newPlan.reelsPerMonth}
              onChange={(event) => setNewPlan((prev) => ({ ...prev, reelsPerMonth: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
              type="number"
            />
          </label>
          <label className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Price (₹)
            <input
              value={newPlan.price}
              onChange={(event) => setNewPlan((prev) => ({ ...prev, price: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm"
              type="number"
            />
          </label>
        </div>
        <label className="mt-3 block text-xs uppercase tracking-[0.3em] text-slate-500">Perks (one per line)</label>
        <textarea
          value={newPlan.perksText}
          onChange={(event) => setNewPlan((prev) => ({ ...prev, perksText: event.target.value }))}
          className="mt-1 h-24 w-full rounded-2xl border border-slate-800 bg-slate-900/50 px-3 py-2 text-sm leading-relaxed"
        />
        <div className="mt-4 flex items-center gap-2">
          <button
            type="submit"
            className="rounded-full border border-orange-500/60 px-4 py-2 text-xs font-semibold text-orange-300"
            disabled={busy}
          >
            Create plan
          </button>
          {status && <p className="text-xs text-slate-400">{status}</p>}
        </div>
      </form>
    </div>
  );
}
