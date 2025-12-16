"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { AdminTableSkeleton } from "@/components/admin-table-skeleton";

type Channel = {
  id: string;
  name: string;
  platform?: string | null;
  handle?: string | null;
  tone?: string | null;
  style?: string | null;
  persona_id?: string | null;
  topic?: string | null;
  audience?: string | null;
  content_type?: string | null;
  duration_default?: number | null;
  cta_default?: string | null;
  base_hashtags?: string[] | null;
  character_name?: string | null;
  character_images?: string[] | null;
  logo_url?: string | null;
  created_at?: string | null;
  user_id?: string | null;
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export default function AdminChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<Channel | null>(null);
  const [deleteRow, setDeleteRow] = useState<Channel | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<Status>({ type: "idle" });
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return channels;
    return channels.filter((c) => {
      const text = [
        c.name,
        c.platform,
        c.handle,
        c.tone,
        c.style,
        c.topic,
        c.audience,
        c.content_type,
        c.user_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [channels, search]);

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
        const res = await fetch("/api/admin/channels", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Unable to load channels");
        setChannels(Array.isArray(body.channels) ? body.channels : []);
      } catch (err) {
        setError((err as Error).message || "Unable to load channels");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleteStatus({ type: "loading", message: "Deleting..." });
    try {
      const res = await fetch(`/api/admin/channels?id=${encodeURIComponent(deleteRow.id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to delete channel");
      setChannels((prev) => prev.filter((c) => c.id !== deleteRow.id));
      setDeleteStatus({ type: "success", message: "Deleted" });
      setDeleteRow(null);
    } catch (err) {
      setDeleteStatus({ type: "error", message: (err as Error).message || "Unable to delete channel" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Admin</p>
          <h1 className="text-2xl font-bold text-dark dark:text-dark-8">Channels</h1>
          <p className="text-sm text-gray-6 dark:text-dark-6">View and manage all channels.</p>
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

              <div className="flex flex-col gap-1">
                <div className="text-xs font-semibold text-gray-6 dark:text-dark-6">
                  Search <span className="font-normal">(name, platform, user)</span>
                </div>
                <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search channels"
                    className="h-10 w-64 rounded-lg border border-gray-3 bg-white px-3 pl-9 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    aria-label="Search channels"
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-5">🔍</span>
                </div>
              </div>
            </div>

            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                <tr>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Tone / Style</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {paged.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-6 dark:text-dark-6">
                      No channels found.
                    </td>
                  </tr>
                ) : (
                  paged.map((channel) => (
                    <tr key={channel.id} className="align-top hover:bg-gray-1/60 dark:hover:bg-dark-3/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {channel.logo_url ? (
                            <img
                              src={channel.logo_url}
                              alt={channel.name}
                              className="h-10 w-10 rounded-lg border border-gray-3 object-cover dark:border-stroke-dark"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-gray-3 text-[11px] text-gray-5 dark:border-stroke-dark dark:text-dark-6">
                              Logo
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-dark dark:text-dark-8">{channel.name}</div>
                            <div className="text-xs text-gray-6 dark:text-dark-6">
                              {channel.handle ? `@${channel.handle.replace("@", "")}` : "No handle set"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {channel.platform ? (
                          <span className="rounded-full bg-gray-1 px-2 py-1 text-[11px] font-semibold uppercase text-gray-7 dark:bg-dark-3 dark:text-dark-7">
                            {channel.platform}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-7 dark:text-dark-7">
                        {channel.tone || "—"} {channel.style ? `· ${channel.style}` : ""}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-7 dark:text-dark-7">{channel.user_id || "—"}</td>
                      <td className="px-4 py-3 align-top text-xs text-gray-7 dark:text-dark-7">
                        {channel.created_at ? new Date(channel.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-2"
                            onClick={() => setDetailRow(channel)}
                          >
                            Detail
                          </button>
                          <button
                            className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            onClick={() => setDeleteRow(channel)}
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
            <div className="mt-4 max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:bg-dark-2 dark:border dark:border-stroke-dark">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Detail</p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">{detailRow.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-6 dark:text-dark-6">
                    {detailRow.platform && (
                      <span className="rounded-full bg-gray-1 px-2 py-1 font-semibold uppercase text-gray-7 dark:bg-dark-2 dark:text-dark-7">
                        {detailRow.platform}
                      </span>
                    )}
                    {detailRow.handle && <span>@{detailRow.handle.replace("@", "")}</span>}
                    {detailRow.user_id && (
                      <span className="rounded-full bg-gray-2 px-2.5 py-1 font-semibold text-gray-7 dark:bg-dark-3 dark:text-dark-7">
                        User: {detailRow.user_id}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 text-sm text-gray-7 dark:text-dark-7">
                  <p>
                    <strong>Audience:</strong> {detailRow.audience || "—"}
                  </p>
                  <p>
                    <strong>Content type:</strong> {detailRow.content_type || "—"}
                  </p>
                  <p>
                    <strong>Topic:</strong> {detailRow.topic || "—"}
                  </p>
                  <p>
                    <strong>Persona:</strong> {detailRow.persona_id || "—"}
                  </p>
                  <p>
                    <strong>Tone:</strong> {detailRow.tone || "—"}
                  </p>
                  <p>
                    <strong>Style:</strong> {detailRow.style || "—"}
                  </p>
                  <p>
                    <strong>Default duration:</strong> {detailRow.duration_default ?? "—"} sec
                  </p>
                </div>
                <div className="space-y-2 text-sm text-gray-7 dark:text-dark-7">
                  <p>
                    <strong>CTA:</strong> {detailRow.cta_default || "—"}
                  </p>
                  <p>
                    <strong>Base hashtags:</strong>{" "}
                    {detailRow.base_hashtags && detailRow.base_hashtags.length ? detailRow.base_hashtags.join(", ") : "—"}
                  </p>
                  <p>
                    <strong>Character:</strong> {detailRow.character_name || "—"}
                  </p>
                  {detailRow.character_images && detailRow.character_images.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {detailRow.character_images.map((url, idx) => (
                        <img
                          key={`${detailRow.id}-detail-char-${idx}`}
                          src={url}
                          alt="Character"
                          className="h-12 w-12 rounded-md border border-gray-3 object-cover dark:border-stroke-dark"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {deleteRow && (
        <ModalPortal>
          <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Delete</p>
                  <h3 className="text-lg font-bold text-dark dark:text-dark-8">Delete channel?</h3>
                  <p className="mt-2 text-sm text-gray-6 dark:text-dark-6">
                    This will remove <strong>{deleteRow.name}</strong>. Existing reels remain but will no longer be linked.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteRow(null)}
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                >
                  Close
                </button>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex w-full items-center justify-center rounded-xl border border-gray-3 px-4 py-3 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60 sm:w-1/2"
                  onClick={() => setDeleteRow(null)}
                  disabled={deleteStatus.type === "loading"}
                >
                  Cancel
                </button>
                <button
                  className="flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60 sm:w-1/2"
                  onClick={confirmDelete}
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
