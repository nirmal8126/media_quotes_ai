"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { labelForLanguage, languageOptions, resolveLanguageCode } from "@/lib/languages";
import { useRouter } from "next/navigation";

type ReelHistoryItem = {
  id: string;
  status?: string | null;
  platform?: string | null;
  tone?: string | null;
  style?: string | null;
  template?: string | null;
  language?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  rendererJobId?: string | null;
  createdAt?: string | null;
  scriptId?: string | null;
  scriptText?: string | null;
  inputPrompt?: string | null;
  channelId?: string | null;
};

type ReelState = {
  reel?: ReelHistoryItem;
  script?: {
    id: string;
    text: string;
    inputPrompt?: string | null;
  };
  variants?: {
    hooks?: string[];
    titles?: string[];
    scripts?: string[];
    hashtags?: string[][];
  };
  storyboard?: Array<{ label?: string; text: string; durationMs?: number; visualSuggestion?: string }>;
};

type Channel = {
  id: string;
  name: string;
  platform?: string | null;
  handle?: string | null;
  tone?: string | null;
  style?: string | null;
  template?: string | null;
  brandColors?: string[] | null;
  brandFonts?: string[] | null;
  logoUrl?: string | null;
  endScreenTemplate?: string | null;
  durationDefault?: number | null;
  topic?: string | null;
  language?: string | null;
};
type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const platforms = [
  "INSTAGRAM",
  "TIKTOK",
  "YOUTUBE",
  "YOUTUBE_SHORTS",
  "FACEBOOK",
  "LINKEDIN",
];
const tones = ["motivational", "educational", "funny", "dramatic", "emotional"];
const styles = [
  "cinematic",
  "minimal",
  "aesthetic",
  "bold",
  "fast-cut",
  "cartoon",
  "meme",
  "talking_head",
];
const templates = ["cinematic", "cartoon", "meme", "talking_head", "minimal"];

const defaultForm = {
  idea: "",
  scriptText: "",
  platform: "INSTAGRAM",
  tone: "motivational",
  style: "cinematic",
  template: "cinematic",
  personaId: "",
  durationSec: 15,
  withVoiceover: true,
  channelId: "",
  language: "",
};

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export default function AiReelsPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ...defaultForm });
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [result, setResult] = useState<ReelState | null>(null);
  const [polling, setPolling] = useState(false);
  const [history, setHistory] = useState<ReelHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [deleteRow, setDeleteRow] = useState<ReelHistoryItem | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<Status>({ type: "idle" });
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [platformFilter, setPlatformFilter] = useState<string>("");
  const [toneFilter, setToneFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [languageQuery, setLanguageQuery] = useState(labelForLanguage(defaultForm.language));
  const [showLanguageList, setShowLanguageList] = useState(false);
  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === form.channelId),
    [channels, form.channelId]
  );
  const filteredHistory = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filteredByChannel =
      channelFilter === ""
        ? history
        : channelFilter === "none"
        ? history.filter((h) => !h.channelId)
        : history.filter((h) => h.channelId === channelFilter);

    const filteredByMeta = filteredByChannel.filter((item) => {
      const matchesPlatform = !platformFilter
        ? true
        : (item.platform ?? "").toLowerCase().includes(platformFilter.toLowerCase());
      const matchesTone = !toneFilter
        ? true
        : (item.tone ?? "").toLowerCase().includes(toneFilter.toLowerCase());
      const matchesStatus = !statusFilter
        ? true
        : (item.status ?? "").toLowerCase() === statusFilter.toLowerCase();
      const created = item.createdAt ? new Date(item.createdAt) : null;
      const matchesFrom = !dateFrom || !created ? true : created >= new Date(dateFrom);
      const matchesTo = !dateTo || !created ? true : created <= new Date(dateTo);
      return matchesPlatform && matchesTone && matchesStatus && matchesFrom && matchesTo;
    });

    if (!term) return filteredByMeta;

    return filteredByMeta.filter((item) => {
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
  }, [history, search, channelFilter, platformFilter, toneFilter, statusFilter, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedHistory = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredHistory.slice(start, start + pageSize);
  }, [filteredHistory, currentPage, pageSize]);

  const filteredLanguages = useMemo(() => {
    if (!showLanguageList) return [];
    const term = (languageQuery || "").trim().toLowerCase();
    if (!term || term === "choose a language...") return languageOptions;

    const exactMatch = languageOptions.some(
      (lang) => lang.label.toLowerCase() === term || lang.code.toLowerCase() === term
    );
    if (exactMatch) return languageOptions;

    return languageOptions.filter(
      (lang) => lang.label.toLowerCase().includes(term) || lang.code.toLowerCase().includes(term)
    );
  }, [languageQuery, showLanguageList]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, history.length, channelFilter, platformFilter, toneFilter, statusFilter, dateFrom, dateTo]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const params = new URLSearchParams();
      if (channelFilter && channelFilter !== "none") params.set("channelId", channelFilter);
      if (platformFilter) params.set("platform", platformFilter);
      if (toneFilter) params.set("tone", toneFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const url = params.toString() ? `/api/reels/history?${params.toString()}` : "/api/reels/history";
      const res = await fetch(url, { cache: "no-store" });
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

  const loadChannels = async () => {
    setChannelLoading(true);
    try {
      const res = await fetch("/api/channels", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setChannels(Array.isArray(body.channels) ? body.channels : []);
      }
    } catch {
      // silent
    } finally {
      setChannelLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [channelFilter, platformFilter, toneFilter, statusFilter, dateFrom, dateTo]);

  const handleGenerate = async () => {
    if (status.type === "loading") return;
    if (!form.idea.trim() && !form.scriptText.trim()) {
      setStatus({
        type: "error",
        message: selectedChannel?.topic
          ? "Provide an idea or leave it blank to rely on channel topic."
          : "Provide either an idea or a script.",
      });
      return;
    }

    setStatus({
      type: "loading",
      message: "Generating script and starting render...",
    });
    const channelDefaults = selectedChannel
      ? {
          platform: selectedChannel.platform || form.platform,
          tone: selectedChannel.tone || form.tone,
          style: selectedChannel.style || form.style,
          template: selectedChannel.template || form.template,
          durationSec: selectedChannel.durationDefault ?? form.durationSec,
          language: selectedChannel.language || form.language,
          topic: selectedChannel.topic || form.idea,
        }
      : null;

    const languageValue = (
      channelDefaults?.language ||
      form.language ||
      languageQuery ||
      ""
    ).trim();
    const normalizedLanguage = languageValue ? resolveLanguageCode(languageValue) : undefined;

    const payloadDuration = Number(channelDefaults?.durationSec ?? form.durationSec) || 15;
    const brand = selectedChannel
      ? {
          colors: (selectedChannel.brandColors || []).filter(Boolean),
          fonts: (selectedChannel.brandFonts || []).filter(Boolean),
          logoUrl: selectedChannel.logoUrl || null,
          endScreenTemplate: selectedChannel.endScreenTemplate || null,
        }
      : null;
    const hasBrand =
      !!brand &&
      ((brand.colors && brand.colors.length > 0) ||
        (brand.fonts && brand.fonts.length > 0) ||
        brand.logoUrl ||
        brand.endScreenTemplate);

    try {
      const res = await fetch("/api/reels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...(channelDefaults ? channelDefaults : {}),
          idea: channelDefaults?.topic || form.idea,
          language: normalizedLanguage,
          tone: channelDefaults?.tone || form.tone,
          style: channelDefaults?.style || form.style,
          template: channelDefaults?.template || form.template,
          durationSec: payloadDuration,
          multiVariants: true,
          storyboard: true,
          ...(hasBrand ? { brand } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to start reel generation.");
      }
      setResult({
        reel: body.reel,
        script: body.script,
        variants: body.variants,
        storyboard: body.storyboard,
      });
      setStatus({
        type: "success",
        message:
          body.message || "Reel created. If rendering, poll for updates.",
      });
      setShowModal(false);
      await loadHistory();
      if (body.reel?.id) {
        router.push(`/ai-reels/${body.reel.id}/customize`);
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: (err as Error).message || "Unable to start reel render.",
      });
    }
  };

  const handlePoll = async (reelId?: string) => {
    const idToPoll = reelId ?? result?.reel?.id;
    if (!idToPoll || polling) return;
    setPolling(true);
    try {
      const res = await fetch(
        `/api/reels/status?reelId=${encodeURIComponent(idToPoll)}`
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to load status.");
      }
      setResult((prev) =>
        prev?.reel?.id === idToPoll
          ? { ...(prev ?? {}), reel: body.reel }
          : prev
      );
      setHistory((prev) =>
        prev.map((item) =>
          item.id === idToPoll ? { ...item, ...body.reel } : item
        )
      );
      setStatus({
        type: "success",
        message: `Status: ${body.reel?.status || "unknown"}`,
      });
    } catch (err) {
      setStatus({
        type: "error",
        message: (err as Error).message || "Unable to fetch status.",
      });
    } finally {
      setPolling(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleteStatus({ type: "loading", message: "Deleting reel..." });
    try {
      const res = await fetch(
        `/api/reels/delete?id=${encodeURIComponent(deleteRow.id)}`,
        { method: "DELETE" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to delete reel.");
      }
      setHistory((prev) => prev.filter((item) => item.id !== deleteRow.id));
      setDeleteStatus({ type: "success", message: "Reel deleted" });
      setDeleteRow(null);
    } catch (err) {
      setDeleteStatus({
        type: "error",
        message: (err as Error).message || "Unable to delete reel.",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            AI Reels
          </p>
          <h1 className="text-2xl font-bold text-dark dark:text-dark-8">
            Generated reels
          </h1>
          <p className="text-sm text-gray-6 dark:text-dark-6">
            View recent reels and create new ones.
          </p>
        </div>
        <button
          onClick={() => {
            setResult(null);
            setStatus({ type: "idle" });
            setForm({ ...defaultForm });
            setLanguageQuery(labelForLanguage(defaultForm.language));
            setShowLanguageList(false);
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          + Generate Reel
        </button>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-6 dark:text-dark-6">
            Channel
            <select
              className="h-10 rounded-lg border border-gray-3 bg-white px-3 text-sm font-semibold text-dark focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              disabled={channelLoading}
            >
              <option value="">All</option>
              <option value="none">No channel</option>
              {channels.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.platform ? `• ${c.platform}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-6 dark:text-dark-6">
            Platform
            <select
              className="h-10 rounded-lg border border-gray-3 bg-white px-3 text-sm font-semibold text-dark focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              value={platformFilter}
              onChange={(e) => setPlatformFilter(e.target.value)}
            >
              <option value="">All</option>
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-6 dark:text-dark-6">
            Tone
            <select
              className="h-10 rounded-lg border border-gray-3 bg-white px-3 text-sm font-semibold text-dark focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              value={toneFilter}
              onChange={(e) => setToneFilter(e.target.value)}
            >
              <option value="">All</option>
              {tones.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-gray-6 dark:text-dark-6">
            Status
            <select
              className="h-10 rounded-lg border border-gray-3 bg-white px-3 text-sm font-semibold text-dark focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All</option>
              {["READY", "RENDERING", "SCHEDULED", "PUBLISHED", "FAILED", "PENDING"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-xs font-semibold text-gray-6 dark:text-dark-6">
            Date range
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-3 bg-white px-3 text-sm text-dark outline-none focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              />
              <span className="text-xs text-gray-6 dark:text-dark-6">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-3 bg-white px-3 text-sm text-dark outline-none focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
      {historyLoading ? (
        <div className="py-10 text-center text-gray-6 dark:text-dark-6">
          Loading reels...
        </div>
      ) : historyError ? (
          <div className="py-10 text-center text-red-600">{historyError}</div>
        ) : (
          <div className="space-y-4 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-7 dark:text-dark-7">
                <span className="text-gray-6 dark:text-dark-6">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) || 5)}
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
              <div className="flex flex-col gap-1 text-xs font-semibold text-gray-6 dark:text-dark-6">
                Search <span className="font-normal">(script, id, status)</span>
                <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search reels"
                    className="h-10 w-56 rounded-lg border border-gray-3 bg-white px-3 pl-9 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    aria-label="Search reels"
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-5">
                    🔍
                  </span>
                </div>
              </div>
            </div>
            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                <tr>
                  <th className="px-4 py-3">Script / ID</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {pagedHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-gray-6 dark:text-dark-6"
                    >
                      No reels found.
                    </td>
                  </tr>
                ) : (
                  pagedHistory.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-1/60 align-top dark:hover:bg-dark-3/70"
                    >
                      <td className="px-4 py-3 text-sm text-gray-7 dark:text-dark-7">
                        <div className="line-clamp-2 font-medium text-dark dark:text-dark-8">
                          {item.scriptText?.trim()
                            ? item.scriptText.slice(0, 120) +
                              (item.scriptText.length > 120 ? "..." : "")
                            : "—"}
                        </div>
                        <div className="text-xs text-gray-6 dark:text-dark-6">
                          ID: {item.id}
                        </div>
                        {(item.platform || item.tone) && (
                          <div className="text-[11px] text-gray-5 dark:text-dark-6">
                            {[item.platform, item.tone].filter(Boolean).join(" • ")}
                          </div>
                        )}
                        {item.rendererJobId && (
                          <div className="text-[11px] text-gray-5 dark:text-dark-6">
                            Job: {item.rendererJobId}
                          </div>
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
                              : item.status === "RENDERING" ||
                                item.status === "PENDING"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-gray-2 text-gray-7 dark:bg-dark-3 dark:text-dark-7"
                          )}
                        >
                          {item.status || "unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                        {item.createdAt
                          ? new Date(item.createdAt).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-2"
                            onClick={() => router.push(`/ai-reels/${item.id}/customize`)}
                          >
                            Detail
                          </button>
                          <button
                            className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-2"
                            onClick={() => handlePoll(item.id)}
                            disabled={polling}
                          >
                            {polling ? "Checking..." : "Refresh"}
                          </button>
                          <button
                            className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            onClick={() => setDeleteRow(item)}
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
                Showing{" "}
                {pagedHistory.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1}{" "}
                to{" "}
                {pagedHistory.length === 0
                  ? 0
                  : Math.min(
                      currentPage * pageSize,
                      filteredHistory.length
                    )}{" "}
                of {filteredHistory.length} entries
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

      {result?.variants || (result?.storyboard && result.storyboard.length > 0) ? (
        <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                Generated extras
              </p>
              <h3 className="text-lg font-bold text-dark dark:text-dark-8">Variants & storyboard</h3>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {result?.variants && (result.variants.hooks?.length || result.variants.scripts?.length) ? (
              <div className="space-y-2 rounded-lg border border-gray-3 p-3 dark:border-stroke-dark">
                <div className="text-sm font-semibold text-dark dark:text-dark-8">Variants</div>
                <div className="space-y-1 text-sm text-gray-7 dark:text-dark-7">
                  {result.variants.hooks?.length ? (
                    <div>
                      <div className="text-xs font-semibold uppercase text-gray-6 dark:text-dark-6">Hooks</div>
                      <ul className="list-disc pl-5">
                        {result.variants.hooks.slice(0, 3).map((hook, idx) => (
                          <li key={`hook-${idx}`}>{hook}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.variants.scripts?.length ? (
                    <div>
                      <div className="text-xs font-semibold uppercase text-gray-6 dark:text-dark-6">Scripts (preview)</div>
                      <ul className="list-disc pl-5">
                        {result.variants.scripts.slice(0, 2).map((script, idx) => (
                          <li key={`script-${idx}`} className="line-clamp-2">
                            {script}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {result.variants.titles?.length ? (
                    <div>
                      <div className="text-xs font-semibold uppercase text-gray-6 dark:text-dark-6">Titles</div>
                      <ul className="list-disc pl-5">
                        {result.variants.titles.slice(0, 3).map((title, idx) => (
                          <li key={`title-${idx}`}>{title}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {result?.storyboard && result.storyboard.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-gray-3 p-3 dark:border-stroke-dark">
                <div className="text-sm font-semibold text-dark dark:text-dark-8">Storyboard (up to 5 scenes)</div>
                <ol className="space-y-2 text-sm text-gray-7 dark:text-dark-7">
                  {result.storyboard
                    .filter((scene) => scene.text && scene.text.length > 6)
                    .slice(0, 5)
                    .map((scene, idx) => (
                    <li key={`scene-${idx}`} className="rounded-lg bg-gray-1/60 p-2 dark:bg-dark-3/70">
                      <div className="text-xs font-semibold uppercase text-gray-6 dark:text-dark-6">
                        {scene.label || `Scene ${idx + 1}`} {scene.durationMs ? `• ${Math.round(scene.durationMs / 1000)}s` : ""}
                      </div>
                      <div>{scene.text}</div>
                      {scene.visualSuggestion ? (
                        <div className="text-[11px] text-gray-5 dark:text-dark-6">Visual: {scene.visualSuggestion}</div>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {showModal && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12"
            role="dialog"
            aria-modal="true"
          >
            <div className="mt-4 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:bg-dark-2 dark:border dark:border-stroke-dark">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                    Generate
                  </p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">
                    New reel
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setStatus({ type: "idle" });
                    setForm({ ...defaultForm });
                    setLanguageQuery(labelForLanguage(defaultForm.language));
                    setShowLanguageList(false);
                  }}
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                >
                  Close
                </button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Idea</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">
                      (what the reel should cover) {selectedChannel?.topic ? `Channel: ${selectedChannel.topic}` : ""}
                    </span>
                  </div>
                  <textarea
                    className="mt-2 h-28 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="e.g., Morning discipline reel with a strong hook"
                    value={form.idea}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, idea: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Script (optional)</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(paste if you have one)</span>
                  </div>
                  <textarea
                    className="mt-2 h-28 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Paste your script. Leave empty to let AI write it."
                    value={form.scriptText}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        scriptText: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Channel (optional)</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(pick to auto-fill defaults)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.channelId}
                    onChange={(e) => {
                      const selected = channels.find(
                        (c) => c.id === e.target.value
                      );
                      const nextLanguage = selected?.language || form.language || "";
                      setLanguageQuery(labelForLanguage(nextLanguage));
                      setForm((prev) => ({
                        ...prev,
                        channelId: e.target.value,
                        platform: selected?.platform
                          ? selected.platform.toUpperCase()
                          : prev.platform,
                        tone: selected?.tone || prev.tone,
                        style: selected?.style || prev.style,
                        template: selected?.template || prev.template,
                        language: selected?.language || prev.language,
                        durationSec:
                          typeof selected?.durationDefault === "number" &&
                          Number.isFinite(selected.durationDefault)
                            ? selected.durationDefault
                          : prev.durationSec,
                        idea:
                          prev.idea.trim() ||
                          (selected?.topic ? `Topic: ${selected.topic}` : ""),
                      }));
                    }}
                    disabled={channelLoading}
                  >
                    <option value="">No channel (one-off)</option>
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.platform ? `• ${c.platform}` : ""}
                      </option>
                    ))}
                    </select>
                </label>

                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Platform</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(instagram, youtube, etc.)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.platform}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, platform: e.target.value }))
                    }
                  >
                    {platforms.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="relative block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Language</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(English, Hindi, etc.)</span>
                  </div>
                  <div className="relative mt-2">
                    <input
                      className="w-full rounded-lg border border-gray-3 bg-white px-4 pr-10 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      name="language"
                      value={languageQuery}
                      onFocus={() => setShowLanguageList(true)}
                      onClick={() => setShowLanguageList(true)}
                      onChange={(e) => {
                        const next = e.target.value;
                        setLanguageQuery(next);
                        setForm((prev) => ({ ...prev, language: next }));
                        setShowLanguageList(true);
                      }}
                      placeholder="Choose a language..."
                      autoComplete="off"
                      onBlur={() => {
                        setTimeout(() => setShowLanguageList(false), 120);
                      }}
                    />
                    <button
                      type="button"
                      aria-label="Show languages"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        setShowLanguageList((prev) => !prev);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-gray-6 transition hover:bg-gray-2 dark:text-dark-6 dark:hover:bg-dark-4"
                    >
                      ▼
                    </button>
                  </div>
                  {showLanguageList && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-3 bg-white shadow-card-2 dark:border-stroke-dark dark:bg-dark-3">
                      {filteredLanguages.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-6 dark:text-dark-6">No matches</div>
                      )}
                      {filteredLanguages.map((lang) => (
                        <button
                          type="button"
                          key={`${lang.code}-${lang.label}`}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-dark hover:bg-gray-1 dark:text-dark-8 dark:hover:bg-dark-4"
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            setLanguageQuery(lang.label);
                            setForm((prev) => ({ ...prev, language: lang.label }));
                            setShowLanguageList(false);
                          }}
                        >
                          <span>{lang.label}</span>
                          <span className="text-xs text-gray-5 dark:text-dark-6">{lang.code.toUpperCase()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Template</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(meme, cinematic, etc.)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.template}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, template: e.target.value }))
                    }
                  >
                    {templates.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Tone</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(motivational, funny, etc.)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.tone}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, tone: e.target.value }))
                    }
                  >
                    {tones.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Style</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(cinematic, minimal, etc.)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.style}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, style: e.target.value }))
                    }
                  >
                    {styles.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Persona ID (optional)</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(persona UUID)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="persona UUID"
                    value={form.personaId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        personaId: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Duration (sec)</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(clip length)</span>
                  </div>
                  <input
                    type="number"
                    min={10}
                    max={180}
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.durationSec}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        durationSec:
                          Number(e.target.value) || defaultForm.durationSec,
                      }))
                    }
                  />
                </label>
                <label className="mt-1 mb-1 flex items-center gap-2 text-sm font-semibold text-dark dark:text-dark-7">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={form.withVoiceover}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        withVoiceover: e.target.checked,
                      }))
                    }
                  />
                  Include voiceover
                </label>
              </div>

              {status.type !== "idle" && status.message && (
                <div
                  className={cn(
                    "mt-4 rounded-lg border px-3 py-2 text-sm",
                    status.type === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : status.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-stroke bg-gray-1 text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                    setStatus({ type: "idle" });
                    setForm({ ...defaultForm });
                    setLanguageQuery(labelForLanguage(defaultForm.language));
                    setShowLanguageList(false);
                  }}
                  disabled={status.type === "loading"}
                >
                  Cancel
                </button>
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-1/2"
                  onClick={handleGenerate}
                  disabled={status.type === "loading"}
                >
                  {status.type === "loading" ? "Working..." : "Generate Reel"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {deleteRow && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 px-4"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="text-lg font-semibold text-dark dark:text-dark-8">
                Delete reel?
              </h3>
              <p className="mt-2 text-sm text-gray-6 dark:text-dark-6">
                This will remove the reel from your history. Reel ID:{" "}
                {deleteRow.id}
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
