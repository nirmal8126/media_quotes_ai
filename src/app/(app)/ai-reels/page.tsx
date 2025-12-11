"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

function ModalPortal({ children }: { children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

type ReelState = {
  reel?: {
    id: string;
    status: string;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    rendererJobId?: string | null;
    durationSec?: number | null;
    errorMessage?: string | null;
  };
  script?: {
    id: string;
    text: string;
    inputPrompt?: string | null;
  };
};

type ReelHistoryItem = {
  id: string;
  status?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  rendererJobId?: string | null;
  createdAt?: string | null;
  scriptId?: string | null;
  scriptText?: string | null;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function truncateScript(text?: string | null) {
  if (!text) return "—";
  const clean = text.trim();
  if (clean.length <= 120) return clean;
  return `${clean.slice(0, 117)}...`;
}

const platforms = ["INSTAGRAM", "TIKTOK", "YOUTUBE", "FACEBOOK", "LINKEDIN"];
const tones = ["motivational", "educational", "funny", "dramatic", "emotional"];
const styles = ["cinematic", "minimal", "aesthetic", "bold", "fast-cut"];

const defaultForm = {
  idea: "",
  scriptText: "",
  platform: "INSTAGRAM",
  tone: "motivational",
  style: "cinematic",
  personaId: "",
  durationSec: 15,
  withVoiceover: true,
};

export default function AiReelsPage() {
  const [form, setForm] = useState({ ...defaultForm });
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [result, setResult] = useState<ReelState | null>(null);
  const [polling, setPolling] = useState(false);
  const [history, setHistory] = useState<ReelHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [detailRow, setDetailRow] = useState<ReelHistoryItem | null>(null);
  const [deleteRow, setDeleteRow] = useState<ReelHistoryItem | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<Status>({ type: "idle" });
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(6);
  const [page, setPage] = useState(1);

  const handleGenerate = async () => {
    if (status.type === "loading") return;
    if (!form.idea.trim() && !form.scriptText.trim()) {
      setStatus({ type: "error", message: "Provide either an idea or a script." });
      return;
    }

    setStatus({ type: "loading", message: "Generating script and starting render..." });
    try {
      const res = await fetch("/api/reels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to start reel generation.");
      }
      setResult({ reel: body.reel, script: body.script });
      setStatus({ type: "success", message: body.message || "Reel created. If rendering, poll for updates." });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to start reel render." });
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch("/api/reels/history", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to load reel history.");
      }
      setHistory(Array.isArray(body.reels) ? body.reels : []);
    } catch (err) {
      const message = (err as Error).message || "Unable to load history.";
      setHistoryError(message);
      setStatus({ type: "error", message });
    } finally {
      setHistoryLoading(false);
    }
  };

  const handlePoll = async (reelId?: string) => {
    const idToPoll = reelId ?? result?.reel?.id;
    if (!idToPoll || polling) return;
    setPolling(true);
    try {
      const res = await fetch(`/api/reels/status?reelId=${encodeURIComponent(idToPoll)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to load status.");
      }
      setResult((prev) => (prev?.reel?.id === idToPoll ? { ...(prev ?? {}), reel: body.reel } : prev));
      setHistory((prev) => prev.map((item) => (item.id === idToPoll ? { ...item, ...body.reel } : item)));
      setStatus({ type: "success", message: `Status: ${body.reel?.status || "unknown"}` });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to fetch status." });
    } finally {
      setPolling(false);
    }
  };

  const handleOpenDelete = (item: ReelHistoryItem) => {
    setDeleteStatus({ type: "idle" });
    setDeleteRow(item);
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleteStatus({ type: "loading", message: "Deleting reel..." });
    try {
      const res = await fetch(`/api/reels/delete?id=${encodeURIComponent(deleteRow.id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to delete reel.");
      }
      setHistory((prev) => prev.filter((item) => item.id !== deleteRow.id));
      setDeleteStatus({ type: "success", message: "Reel deleted" });
      setDeleteRow(null);
    } catch (err) {
      setDeleteStatus({ type: "error", message: (err as Error).message || "Unable to delete reel." });
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, history.length]);

  const filteredHistory = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return history;
    return history.filter((item) => {
      const text = [
        item.id,
        item.status,
        item.rendererJobId,
        item.scriptText,
        item.videoUrl,
        item.thumbnailUrl,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [history, search]);

  const pageCount = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedHistory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, currentPage, pageSize]);
  const startIndex = filteredHistory.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(filteredHistory.length, currentPage * pageSize);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">AI Reels</p>
            <h1 className="text-2xl font-bold text-dark dark:text-dark-8">Generate full reels from an idea or script</h1>
            <p className="text-sm text-gray-6 dark:text-dark-6">
              We’ll write the script (if needed), trigger rendering, and return the video + thumbnail.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-70"
              onClick={handleGenerate}
              disabled={status.type === "loading"}
            >
              {status.type === "loading" ? "Working..." : "Generate AI Reel"}
            </button>
            {result?.reel?.id && (
              <button
                className="flex items-center gap-2 rounded-lg border border-gray-3 px-4 py-2.5 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 disabled:opacity-60 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                onClick={handlePoll}
                disabled={polling}
              >
                {polling ? "Checking..." : "Check Status"}
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
          <div className="rounded-xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
            <h3 className="text-sm font-semibold text-dark dark:text-dark-8">Idea or Script</h3>
            <p className="text-xs text-gray-6 dark:text-dark-6">Share an idea to auto-generate a script, or paste your own script.</p>
            <label className="mt-3 block text-sm font-semibold text-gray-7 dark:text-dark-7">
              Idea
              <textarea
                className="mt-2 h-24 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                placeholder="e.g., Morning discipline reel with a strong hook"
                value={form.idea}
                onChange={(e) => setForm((prev) => ({ ...prev, idea: e.target.value }))}
              />
            </label>
            <label className="mt-3 block text-sm font-semibold text-gray-7 dark:text-dark-7">
              Script (optional)
              <textarea
                className="mt-2 h-32 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                placeholder="Paste your script. Leave empty to let AI write it."
                value={form.scriptText}
                onChange={(e) => setForm((prev) => ({ ...prev, scriptText: e.target.value }))}
              />
            </label>
          </div>

          <div className="rounded-xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
            <h3 className="text-sm font-semibold text-dark dark:text-dark-8">Reel Settings</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-7 dark:text-dark-7">
                Platform
                <select
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                  value={form.platform}
                  onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
                >
                  {platforms.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-7 dark:text-dark-7">
                Tone
                <select
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                  value={form.tone}
                  onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
                >
                  {tones.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-7 dark:text-dark-7">
                Style
                <select
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                  value={form.style}
                  onChange={(e) => setForm((prev) => ({ ...prev, style: e.target.value }))}
                >
                  {styles.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-7 dark:text-dark-7">
                Persona ID (optional)
                <input
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                  placeholder="persona UUID"
                  value={form.personaId}
                  onChange={(e) => setForm((prev) => ({ ...prev, personaId: e.target.value }))}
                />
              </label>
              <label className="text-sm font-semibold text-gray-7 dark:text-dark-7">
                Duration (sec)
                <input
                  type="number"
                  min={10}
                  max={180}
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                  value={form.durationSec}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, durationSec: Number(e.target.value) || defaultForm.durationSec }))
                  }
                />
              </label>
              <label className="mt-1 flex items-center gap-2 text-sm font-semibold text-gray-7 dark:text-dark-7">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={form.withVoiceover}
                  onChange={(e) => setForm((prev) => ({ ...prev, withVoiceover: e.target.checked }))}
                />
                Include voiceover
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-6 dark:text-dark-6">
              Rendering is stubbed locally. Swap in your renderer API to return real video + thumbnail URLs.
            </p>
          </div>
        </div>

        {status.type !== "idle" && (
          <div
            className={cn(
              "mt-4 rounded-lg border px-4 py-3 text-sm",
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

        {result?.reel && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm text-gray-7 dark:text-dark-7">
                  <span className="font-semibold text-dark dark:text-dark-8">Reel ID:</span> {result.reel.id}
                  <span className="ml-2 rounded-full bg-gray-2 px-2 py-1 text-xs font-semibold text-dark dark:bg-dark-3 dark:text-dark-8">
                    {result.reel.status}
                  </span>
                </div>
                {result.reel.rendererJobId && (
                  <span className="text-xs text-gray-6 dark:text-dark-6">Job: {result.reel.rendererJobId}</span>
                )}
              </div>
              {result.reel.videoUrl ? (
                <div className="mt-3 overflow-hidden rounded-lg border border-gray-3 bg-black dark:border-stroke-dark">
                  <video
                    controls
                    src={result.reel.videoUrl}
                    poster={result.reel.thumbnailUrl ?? undefined}
                    className="h-[360px] w-full object-cover"
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-6 dark:text-dark-6">Waiting for renderer to provide a video URL...</p>
              )}
              {result.reel.videoUrl && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={result.reel.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                  >
                    Download / View
                  </a>
                  {result.reel.thumbnailUrl && (
                    <a
                      href={result.reel.thumbnailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-gray-3 px-4 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                    >
                      Thumbnail
                    </a>
                  )}
                  <button
                    className="rounded-lg border border-gray-3 px-4 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 disabled:opacity-60 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                    onClick={handlePoll}
                    disabled={polling}
                  >
                    {polling ? "Checking..." : "Refresh status"}
                  </button>
                </div>
              )}
              {result.reel.errorMessage && (
                <p className="mt-2 text-sm text-red-600">Error: {result.reel.errorMessage}</p>
              )}
            </div>

            <div className="rounded-xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="text-sm font-semibold text-dark dark:text-dark-8">Script</h3>
              {result.script ? (
                <>
                  {result.script.inputPrompt && (
                    <p className="mb-2 text-xs text-gray-6 dark:text-dark-6">Idea: {result.script.inputPrompt}</p>
                  )}
                  <div className="whitespace-pre-wrap rounded-lg border border-gray-3 bg-gray-1 px-3 py-3 text-sm text-gray-8 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8">
                    {result.script.text}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-6 dark:text-dark-6">Script will appear here once generated.</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-6 dark:text-dark-6">
                <span>Platform: {form.platform}</span>
                <span>· Tone: {form.tone}</span>
                <span>· Style: {form.style}</span>
                <span>· Duration: {form.durationSec}s</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Reel History</p>
            <h2 className="text-lg font-bold text-dark dark:text-dark-8">Your generated reels</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-gray-3 bg-white px-3 py-2 dark:border-stroke-dark dark:bg-dark-3">
              <svg className="h-4 w-4 text-gray-5 dark:text-dark-6" viewBox="0 0 24 24" fill="none">
                <path
                  d="M15.5 15.5 20 20"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.5" />
              </svg>
              <input
                className="w-40 bg-transparent text-sm text-dark outline-none dark:text-dark-8"
                placeholder="Search reels..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm font-semibold text-gray-7 outline-none transition hover:bg-gray-1 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value) || 5)}
            >
              {[5, 10, 20].map((size) => (
                <option key={size} value={size}>
                  Show {size}
                </option>
              ))}
            </select>
            <button
              className="rounded-md border border-gray-3 px-3 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60"
              onClick={loadHistory}
              disabled={historyLoading}
            >
              {historyLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {historyError && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {historyError}
          </div>
        )}

        {historyLoading ? (
          <p className="text-sm text-gray-6 dark:text-dark-6">Loading reels...</p>
        ) : filteredHistory.length === 0 ? (
          <p className="text-sm text-gray-6 dark:text-dark-6">
            {search ? "No reels match your search." : "No reels yet. Generate one to see it here."}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-3 dark:border-stroke-dark">
              <table className="min-w-full divide-y divide-gray-2 text-left text-sm dark:divide-stroke-dark">
                <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-6">
                  <tr>
                    <th className="px-4 py-3">Script / ID</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-2 dark:divide-stroke-dark">
                  {pagedHistory.map((item) => (
                    <tr key={item.id} className="bg-white text-sm text-gray-8 dark:bg-dark-2 dark:text-dark-8">
                      <td className="w-[45%] px-4 py-3 align-top">
                        <div className="font-semibold text-dark dark:text-dark-8">{truncateScript(item.scriptText)}</div>
                        <div className="text-xs text-gray-6 dark:text-dark-6">ID: {item.id}</div>
                        {item.rendererJobId && (
                          <div className="text-[11px] text-gray-5 dark:text-dark-6">Job: {item.rendererJobId}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            item.status === "READY"
                              ? "bg-green-100 text-green-700"
                              : item.status === "FAILED"
                                ? "bg-red-100 text-red-700"
                                : item.status === "RENDERING" || item.status === "PENDING"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-2 text-gray-7 dark:bg-dark-3 dark:text-dark-7",
                          )}
                        >
                          {item.status || "unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                        {formatDateTime(item.createdAt)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          {item.videoUrl && (
                            <a
                              href={item.videoUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/90"
                            >
                              View
                            </a>
                          )}
                          <button
                            className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                            onClick={() => setDetailRow(item)}
                          >
                            Detail
                          </button>
                          <button
                            className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60"
                            onClick={() => handlePoll(item.id)}
                            disabled={polling}
                          >
                            {polling ? "Checking..." : "Refresh"}
                          </button>
                          <button
                            className="rounded-md border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-300/50 dark:text-red-300 dark:hover:bg-red-500/10"
                            onClick={() => handleOpenDelete(item)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-6 dark:text-dark-6">
                Showing {startIndex}-{endIndex} of {filteredHistory.length} reels
              </p>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 disabled:opacity-50 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="text-xs font-semibold text-gray-6 dark:text-dark-6">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 disabled:opacity-50 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
                  disabled={currentPage >= pageCount}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detailRow && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-10">
            <div className="absolute inset-0" onClick={() => setDetailRow(null)} />
            <div className="relative w-full max-w-5xl rounded-2xl border border-gray-3 bg-white p-6 shadow-2xl dark:border-stroke-dark dark:bg-dark-1 dark:text-dark-8">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Script & Reel</p>
                  <h3 className="text-xl font-bold text-dark dark:text-dark-8">
                    {detailRow.scriptText && detailRow.scriptText.trim().length > 0
                      ? truncateScript(detailRow.scriptText)
                      : "Reel detail"}
                  </h3>
                  <p className="text-xs text-gray-6 dark:text-dark-6">ID: {detailRow.id}</p>
                </div>
                <button
                  className="rounded-md border border-gray-3 px-3 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setDetailRow(null)}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
                <div className="rounded-xl border border-gray-3 bg-black/5 p-3 dark:border-stroke-dark dark:bg-dark-2">
                  {detailRow.videoUrl ? (
                    <video
                      controls
                      className="h-[320px] w-full overflow-hidden rounded-lg border border-gray-3 object-cover dark:border-stroke-dark"
                      src={detailRow.videoUrl ?? undefined}
                      poster={detailRow.thumbnailUrl ?? undefined}
                    />
                  ) : detailRow.thumbnailUrl ? (
                    <img
                      src={detailRow.thumbnailUrl}
                      alt="Reel thumbnail"
                      className="h-[320px] w-full rounded-lg border border-gray-3 object-cover dark:border-stroke-dark"
                    />
                  ) : (
                    <div className="flex h-[320px] items-center justify-center rounded-lg border border-dashed border-gray-3 text-sm text-gray-6 dark:border-stroke-dark dark:text-dark-6">
                      No preview yet
                    </div>
                  )}
                  {detailRow.videoUrl && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <a
                        href={detailRow.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                      >
                        Open video
                      </a>
                      {detailRow.thumbnailUrl && (
                        <a
                          href={detailRow.thumbnailUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md border border-gray-3 px-4 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                        >
                          Thumbnail
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                        detailRow.status === "READY"
                          ? "bg-green-100 text-green-700"
                          : detailRow.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : detailRow.status === "RENDERING" || detailRow.status === "PENDING"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-2 text-gray-7 dark:bg-dark-3 dark:text-dark-7",
                      )}
                    >
                      {detailRow.status || "unknown"}
                    </span>
                    {detailRow.rendererJobId && (
                      <span className="text-xs text-gray-6 dark:text-dark-6">Job: {detailRow.rendererJobId}</span>
                    )}
                    <span className="text-xs text-gray-6 dark:text-dark-6">Created: {formatDateTime(detailRow.createdAt)}</span>
                  </div>
                  <div className="rounded-lg border border-gray-3 bg-white p-3 dark:border-stroke-dark dark:bg-dark-2">
                    <p className="text-xs font-semibold text-gray-6 dark:text-dark-6">Script</p>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-gray-8 dark:text-dark-8">
                      {detailRow.scriptText?.trim() ? detailRow.scriptText : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {deleteRow && (
        <ModalPortal>
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="absolute inset-0" onClick={() => setDeleteRow(null)} />
            <div className="relative w-full max-w-md rounded-2xl border border-gray-3 bg-white p-5 shadow-2xl dark:border-stroke-dark dark:bg-dark-1 dark:text-dark-8">
              <h3 className="text-lg font-semibold text-dark dark:text-dark-8">Delete reel?</h3>
              <p className="mt-2 text-sm text-gray-6 dark:text-dark-6">
                This will remove the reel from your history. Reel ID: {deleteRow.id}
              </p>
              {deleteStatus.type === "error" && (
                <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {deleteStatus.message}
                </div>
              )}
              <div className="mt-4 flex justify-end gap-2">
                <button
                  className="rounded-md border border-gray-3 px-3 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60"
                  onClick={() => setDeleteRow(null)}
                  disabled={deleteStatus.type === "loading"}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  onClick={confirmDelete}
                  disabled={deleteStatus.type === "loading"}
                >
                  {deleteStatus.type === "loading" ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
