"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { AdminTableSkeleton } from "@/components/admin-table-skeleton";

type Plan = {
  id: string;
  name: string;
  price: number;
  reels_per_month?: number | null;
  perks?: string[] | null;
  created_at?: string | null;
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const defaultForm = {
  name: "",
  price: "",
  reelsPerMonth: "",
  perks: "",
};

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [editing, setEditing] = useState<Plan | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<Status>({ type: "idle" });
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return plans;
    return plans.filter((p) => {
      const text = [p.name, p.price, p.reels_per_month, ...(p.perks || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [plans, search]);

  const loadPlans = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/plans", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load plans");
      const list = Array.isArray(body.plans) ? body.plans : [];
      setPlans(list);
    } catch (err) {
      setError((err as Error).message || "Unable to load plans");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPlans();
  }, []);

  const openCreate = () => {
    setForm({ ...defaultForm });
    setEditing(null);
    setStatus({ type: "idle" });
    setShowModal(true);
  };

  const openEdit = (plan: Plan) => {
    setEditing(plan);
    setForm({
      name: plan.name || "",
      price: plan.price?.toString() ?? "",
      reelsPerMonth: plan.reels_per_month?.toString() ?? "",
      perks: (plan.perks || []).join("\n"),
    });
    setStatus({ type: "idle" });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setStatus({ type: "error", message: "Plan name is required." });
      return;
    }
    setStatus({ type: "loading", message: "Saving..." });
    const payload = {
      name: form.name.trim(),
      price: Number(form.price) || 0,
      reelsPerMonth: form.reelsPerMonth ? Number(form.reelsPerMonth) : 0,
      perks: form.perks,
    };
    try {
      const res = await fetch("/api/admin/plans", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to save plan");
      setStatus({ type: "success", message: editing ? "Plan updated." : "Plan created." });
      setShowModal(false);
      setEditing(null);
      setForm({ ...defaultForm });
      await loadPlans();
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to save plan" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteStatus({ type: "loading", message: "Deleting..." });
    try {
      const res = await fetch("/api/admin/plans", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to delete plan");
      setPlans((prev) => prev.filter((p) => p.id !== deleteId));
      setDeleteStatus({ type: "success", message: "Deleted" });
      setDeleteId(null);
    } catch (err) {
      setDeleteStatus({ type: "error", message: (err as Error).message || "Unable to delete plan" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Admin</p>
          <h1 className="text-2xl font-bold text-dark dark:text-dark-8">Pricing / Plans</h1>
          <p className="text-sm text-gray-6 dark:text-dark-6">Create, update, or remove subscription plans.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          + New Plan
        </button>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-gray-7 dark:text-dark-7">
            Total plans: <span className="font-semibold text-dark dark:text-dark-8">{plans.length}</span>
          </div>
          <div className="relative">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plans"
              className="h-10 w-56 rounded-lg border border-gray-3 bg-white px-3 pl-9 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              aria-label="Search plans"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-5">🔍</span>
          </div>
        </div>

        {loading ? (
          <AdminTableSkeleton rows={5} columns={5} />
        ) : error ? (
          <div className="py-10 text-center text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3 w-[160px]">Reels / mo</th>
                  <th className="px-4 py-3">Perks</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-6 dark:text-dark-6">
                      No plans found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((plan) => (
                    <tr key={plan.id} className="align-top hover:bg-gray-1/60 dark:hover:bg-dark-3/70">
                      <td className="px-4 py-3 text-sm font-semibold text-dark dark:text-dark-8">
                        <div>{plan.name}</div>
                      <div className="text-xs text-gray-6 dark:text-dark-6">Plan ID: {plan.id}</div>
                    </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                        ${plan.price?.toFixed(2) ?? "0.00"}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7 w-[160px]">
                        {plan.reels_per_month ?? 0}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                        <div className="flex flex-wrap gap-2">
                          {plan.perks && plan.perks.length > 0 ? (
                            plan.perks.map((perk, idx) => (
                              <span
                                key={`${plan.id}-perk-${idx}`}
                                className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary dark:bg-primary/15"
                              >
                                {perk}
                              </span>
                            ))
                          ) : (
                            <span className="text-xs text-gray-5 dark:text-dark-6">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-2"
                            onClick={() => openEdit(plan)}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            onClick={() => setDeleteId(plan.id)}
                            disabled={deleteStatus.type === "loading"}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12" role="dialog" aria-modal="true">
            <div className="mt-4 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:border dark:border-stroke-dark dark:bg-dark-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Admin</p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">{editing ? "Edit plan" : "New plan"}</h2>
                  <p className="text-sm text-gray-6 dark:text-dark-6">Manage pricing tiers and entitlements.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditing(null);
                    setForm({ ...defaultForm });
                    setStatus({ type: "idle" });
                  }}
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  Plan name
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Pro, Team, Starter"
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  Price (USD)
                  <input
                    type="number"
                    min={0}
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.price}
                    onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))}
                    placeholder="19"
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  Reels per month
                  <input
                    type="number"
                    min={0}
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.reelsPerMonth}
                    onChange={(e) => setForm((prev) => ({ ...prev, reelsPerMonth: e.target.value }))}
                    placeholder="30"
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  Perks (one per line)
                  <textarea
                    className="mt-2 h-32 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.perks}
                    onChange={(e) => setForm((prev) => ({ ...prev, perks: e.target.value }))}
                    placeholder="• Unlimited captions&#10;• Priority rendering"
                  />
                </label>
              </div>

              {status.type !== "idle" && status.message && (
                <div
                  className={cn(
                    "mt-3 rounded-lg border px-3 py-2 text-sm",
                    status.type === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : status.type === "success"
                        ? "border-green-200 bg-green-50 text-green-700"
                        : "border-stroke bg-gray-1 text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8",
                  )}
                >
                  {status.message}
                </div>
              )}

              <hr className="mt-6 mb-4 border-t border-gray-3 dark:border-stroke-dark" />

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex w-full items-center justify-center rounded-xl border border-gray-3 px-4 py-3 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60 sm:w-1/2"
                  onClick={() => {
                    setShowModal(false);
                    setEditing(null);
                    setForm({ ...defaultForm });
                    setStatus({ type: "idle" });
                  }}
                  disabled={status.type === "loading"}
                >
                  Cancel
                </button>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-1/2"
                  onClick={handleSave}
                  disabled={status.type === "loading"}
                >
                  {status.type === "loading" ? "Saving..." : editing ? "Save changes" : "Create plan"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {deleteId && (
        <ModalPortal>
          <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 px-4 py-8" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Delete</p>
                  <h3 className="text-lg font-bold text-dark dark:text-dark-8">Delete this plan?</h3>
                  <p className="text-sm text-gray-6 dark:text-dark-6">This action cannot be undone.</p>
                </div>
                <button
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                  onClick={() => {
                    setDeleteId(null);
                    setDeleteStatus({ type: "idle" });
                  }}
                >
                  Close
                </button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex w-full items-center justify-center rounded-xl border border-gray-3 px-4 py-3 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60 sm:w-1/2"
                  onClick={() => {
                    setDeleteId(null);
                    setDeleteStatus({ type: "idle" });
                  }}
                  disabled={deleteStatus.type === "loading"}
                >
                  Cancel
                </button>
                <button
                  className="flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60 sm:w-1/2"
                  onClick={handleDelete}
                  disabled={deleteStatus.type === "loading"}
                >
                  {deleteStatus.type === "loading" ? "Deleting..." : "Delete"}
                </button>
              </div>
              {deleteStatus.type !== "idle" && deleteStatus.message && (
                <div
                  className={cn(
                    "mt-2 text-sm",
                    deleteStatus.type === "error"
                      ? "text-red-600"
                      : deleteStatus.type === "success"
                        ? "text-green-600"
                        : "text-gray-6 dark:text-dark-6",
                  )}
                >
                  {deleteStatus.message}
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
