"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AdminTableSkeleton } from "@/components/admin-table-skeleton";

type UserRow = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<UserRow | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) => {
      const text = [u.id, u.email, JSON.stringify(u.app_metadata), JSON.stringify(u.user_metadata)]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [search, users]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, search, filtered.length]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/users", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Unable to load users");
        setUsers(Array.isArray(body.users) ? body.users : []);
      } catch (err) {
        setError((err as Error).message || "Unable to load users");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Admin</p>
          <h1 className="text-2xl font-bold text-dark dark:text-dark-8">Users</h1>
          <p className="text-sm text-gray-6 dark:text-dark-6">View all users. (Superadmin only)</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        {loading ? (
          <AdminTableSkeleton rows={5} columns={5} />
        ) : error ? (
          <div className="py-10 text-center text-red-600">{error}</div>
        ) : (
          <div className="space-y-4 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-7 dark:text-dark-7">
                <span className="text-gray-6 dark:text-dark-6">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                  className="h-10 rounded-lg border border-gray-3 bg-white px-3 text-sm font-semibold text-dark focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-gray-6 dark:text-dark-6">entries</span>
              </div>

              <div className="relative">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users (id, email)"
                  className="h-10 w-64 rounded-lg border border-gray-3 bg-white px-3 pl-9 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                  aria-label="Search users"
                />
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-5">🔍</span>
              </div>
            </div>

            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Last Sign-in</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-6 dark:text-dark-6">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  paged.map((row) => {
                    const role =
                      (row.app_metadata as any)?.role ||
                      (row.user_metadata as any)?.role ||
                      ((row.user_metadata as any)?.is_admin ? "superadmin" : "user");

                    return (
                      <tr key={row.id} className="align-top hover:bg-gray-1/60 dark:hover:bg-dark-3/70">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-dark dark:text-dark-8">{row.email || "—"}</div>
                          <div className="text-xs text-gray-6 dark:text-dark-6">{row.id}</div>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                          <span className="rounded-full bg-gray-2 px-2.5 py-1 text-xs font-semibold uppercase text-gray-7 dark:bg-dark-3 dark:text-dark-7">
                            {role || "user"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                          {row.last_sign_in_at ? new Date(row.last_sign_in_at).toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-3 align-top">
                          <div className="flex justify-end gap-2">
                            <button
                              className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-2"
                              onClick={() => setDetailRow(row)}
                            >
                              Detail
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-7 dark:text-dark-7">
              <div>
                Showing {paged.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                {paged.length === 0 ? 0 : Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-gray-3 px-3 py-1 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 disabled:opacity-60 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-6 dark:text-dark-6">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  className="rounded-md border border-gray-3 px-3 py-1 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 disabled:opacity-60 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage >= pageCount}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {detailRow && (
        <ModalPortal>
          <div className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12" role="dialog" aria-modal="true">
            <div className="mt-4 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:border dark:border-stroke-dark dark:bg-dark-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Detail</p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">{detailRow.email || "User"}</h2>
                  <p className="text-xs text-gray-6 dark:text-dark-6">{detailRow.id}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 text-sm text-gray-7 dark:text-dark-7">
                <div className="space-y-1">
                  <p>
                    <strong>Created:</strong>{" "}
                    {detailRow.created_at ? new Date(detailRow.created_at).toLocaleString() : "—"}
                  </p>
                  <p>
                    <strong>Last sign-in:</strong>{" "}
                    {detailRow.last_sign_in_at ? new Date(detailRow.last_sign_in_at).toLocaleString() : "—"}
                  </p>
                  <p>
                    <strong>Role:</strong>{" "}
                    {(detailRow.app_metadata as any)?.role ||
                      (detailRow.user_metadata as any)?.role ||
                      ((detailRow.user_metadata as any)?.is_admin ? "superadmin" : "user")}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">App metadata</p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-gray-1 p-2 text-xs text-gray-7 dark:bg-dark-3 dark:text-dark-7">
                    {JSON.stringify(detailRow.app_metadata ?? {}, null, 2)}
                  </pre>
                  <p className="font-semibold">User metadata</p>
                  <pre className="whitespace-pre-wrap rounded-lg bg-gray-1 p-2 text-xs text-gray-7 dark:bg-dark-3 dark:text-dark-7">
                    {JSON.stringify(detailRow.user_metadata ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
