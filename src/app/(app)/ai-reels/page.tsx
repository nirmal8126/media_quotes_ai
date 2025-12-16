"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type ReelHistoryItem = {
  id: string;
  status?: string | null;
  platform?: string | null;
  tone?: string | null;
  style?: string | null;
  template?: string | null;
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
};
type ChannelIdea = {
  id: string;
  channelId: string;
  idea: string;
  source?: string | null;
};
type Insights = {
  totals?: { reels?: number };
  byPlatform?: Record<string, number>;
  byTone?: Record<string, number>;
  topHashtags?: Array<{ tag: string; count: number }>;
  sampleHooks?: string[];
};
type Trends = {
  platform: string;
  niche: string;
  trendingSounds: string[];
  trendingTopics: string[];
  trendingHashtags: string[];
  personalizedHashtags: string[];
};
type CompetitorInsight = {
  handle: string;
  platform: string;
  bestPostingTimes?: string[];
  topHooks?: string[];
  topHashtags?: string[];
  viralTopics?: string[];
};
type BulkStatus =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

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
  brandColors: "",
  brandFonts: "",
  logoUrl: "",
  endScreenTemplate: "",
};

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

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
  const [voiceId, setVoiceId] = useState<string>("");
  const [musicTrackId, setMusicTrackId] = useState<string>("");
  const [trendingAudioId, setTrendingAudioId] = useState<string>("");
  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === form.channelId),
    [channels, form.channelId]
  );
  const [channelIdeas, setChannelIdeas] = useState<ChannelIdea[]>([]);
  const [ideasLoading, setIdeasLoading] = useState(false);
  const [ideasError, setIdeasError] = useState<string | null>(null);
  const [bulkCount, setBulkCount] = useState<number>(5);
  const [bulkSpacing, setBulkSpacing] = useState<number>(1);
  const [bulkStatus, setBulkStatus] = useState<BulkStatus>({ type: "idle" });
  const [insights, setInsights] = useState<Insights | null>(null);
  const [trends, setTrends] = useState<Trends | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [competitors, setCompetitors] = useState<string>("");
  const [competitorInsights, setCompetitorInsights] = useState<CompetitorInsight[]>([]);
  const [competitorStatus, setCompetitorStatus] = useState<Status>({ type: "idle" });
  const [autoRunStatus, setAutoRunStatus] = useState<Status>({ type: "idle" });

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

  const loadChannelIdeas = async (channelId: string) => {
    if (!channelId) {
      setChannelIdeas([]);
      setIdeasError(null);
      return;
    }
    setIdeasLoading(true);
    setIdeasError(null);
    try {
      const res = await fetch(`/api/channels/ideas?channelId=${encodeURIComponent(channelId)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to load ideas.");
      }
      setChannelIdeas(Array.isArray(body.ideas) ? body.ideas : []);
    } catch (err) {
      setIdeasError((err as Error).message || "Unable to load ideas.");
    } finally {
      setIdeasLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [channelFilter, platformFilter, toneFilter, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    void loadChannelIdeas(form.channelId);
  }, [form.channelId]);

  useEffect(() => {
    const loadInsights = async () => {
      try {
        const res = await fetch("/api/meta/insights", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setInsights(body);
          setMetaError(null);
        }
      } catch {
        setMetaError("Unable to load insights.");
      }
    };
    void loadInsights();
  }, []);

  useEffect(() => {
    const loadTrends = async () => {
      const platformParam =
        platformFilter ||
        selectedChannel?.platform ||
        form.platform ||
        "instagram";
      const nicheParam = selectedChannel?.topic || selectedChannel?.name || "general";
      try {
        const res = await fetch(
          `/api/meta/trends?platform=${encodeURIComponent(platformParam)}&niche=${encodeURIComponent(nicheParam)}`,
          { cache: "no-store" }
        );
        const body = await res.json().catch(() => ({}));
        if (res.ok) {
          setTrends(body);
          setMetaError(null);
        }
      } catch {
        setMetaError("Unable to load trends.");
      }
    };
    void loadTrends();
  }, [platformFilter, selectedChannel, form.platform]);

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
    try {
      const res = await fetch("/api/reels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          multiVariants: true,
          storyboard: true,
          brand: {
            colors: form.brandColors
              .split(",")
              .map((c) => c.trim())
              .filter(Boolean),
            fonts: form.brandFonts
              .split(",")
              .map((f) => f.trim())
              .filter(Boolean),
            logoUrl: form.logoUrl || null,
            endScreenTemplate: form.endScreenTemplate || null,
          },
          audio: {
            aiVoiceId: voiceId || null,
            musicUploadId: musicTrackId || null,
            trendingAudioId: trendingAudioId || null,
          },
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
                            onClick={() => setDetailRow(item)}
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

      {(insights || trends) && (
        <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Insights & trends</p>
              <h3 className="text-lg font-bold text-dark dark:text-dark-8">Recent performance & ideas</h3>
            </div>
            {metaError && <span className="text-xs text-red-600">{metaError}</span>}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {insights ? (
              <div className="space-y-2 rounded-lg border border-gray-3 p-3 dark:border-stroke-dark">
                <div className="text-sm font-semibold text-dark dark:text-dark-8">
                  Totals: {insights.totals?.reels ?? 0} reels
                </div>
                <div className="text-xs text-gray-6 dark:text-dark-6">Top hashtags</div>
                <div className="flex flex-wrap gap-2 text-xs text-dark dark:text-dark-8">
                  {(insights.topHashtags ?? []).slice(0, 6).map((h) => (
                    <span key={h.tag} className="rounded-full bg-gray-1 px-2 py-1 dark:bg-dark-3">
                      {h.tag} ({h.count})
                    </span>
                  ))}
                  {(insights.topHashtags ?? []).length === 0 && <span className="text-gray-5">No data</span>}
                </div>
                <div className="text-xs text-gray-6 dark:text-dark-6">Sample hooks</div>
                <ul className="list-disc space-y-1 pl-4 text-sm text-dark dark:text-dark-8">
                  {(insights.sampleHooks ?? []).slice(0, 3).map((hook, idx) => (
                    <li key={`hook-sample-${idx}`} className="line-clamp-2">
                      {hook}
                    </li>
                  ))}
                  {(insights.sampleHooks ?? []).length === 0 && <li className="text-gray-5">No hooks yet</li>}
                </ul>
              </div>
            ) : null}
            {trends ? (
              <div className="space-y-2 rounded-lg border border-gray-3 p-3 dark:border-stroke-dark">
                <div className="text-sm font-semibold text-dark dark:text-dark-8">
                  Trends for {trends.platform} / {trends.niche}
                </div>
                <div className="text-xs text-gray-6 dark:text-dark-6">Trending topics</div>
                <div className="flex flex-wrap gap-2 text-xs text-dark dark:text-dark-8">
                  {trends.trendingTopics.slice(0, 5).map((topic, idx) => (
                    <span key={`topic-${idx}`} className="rounded-full bg-gray-1 px-2 py-1 dark:bg-dark-3">
                      {topic}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-6 dark:text-dark-6">Trending hashtags</div>
                <div className="flex flex-wrap gap-2 text-xs text-dark dark:text-dark-8">
                  {trends.trendingHashtags.slice(0, 6).map((tag, idx) => (
                    <span key={`htag-${idx}`} className="rounded-full bg-gray-1 px-2 py-1 dark:bg-dark-3">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-gray-6 dark:text-dark-6">Personalized hashtags</div>
                <div className="flex flex-wrap gap-2 text-xs text-dark dark:text-dark-8">
                  {trends.personalizedHashtags.slice(0, 6).map((tag, idx) => (
                    <span key={`ptag-${idx}`} className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                      {tag}
                    </span>
                  ))}
                  {trends.personalizedHashtags.length === 0 && (
                    <span className="text-gray-5">No personalized tags yet</span>
                  )}
                </div>
              </div>
            ) : null}
            <div className="space-y-2 rounded-lg border border-gray-3 p-3 dark:border-stroke-dark">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-dark dark:text-dark-8">Competitors</div>
                {competitorStatus.type === "error" && competitorStatus.message && (
                  <span className="text-xs text-red-600">{competitorStatus.message}</span>
                )}
              </div>
              <p className="text-xs text-gray-6 dark:text-dark-6">
                Enter handles (comma separated) like @channel1, @channel2. Platform follows current selection.
              </p>
              <input
                className="mt-1 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                placeholder="@handle1, @handle2"
                value={competitors}
                onChange={(e) => setCompetitors(e.target.value)}
              />
              <button
                className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                onClick={async () => {
                  const handles = competitors
                    .split(",")
                    .map((h) => h.trim())
                    .filter(Boolean);
                  if (!handles.length) return;
                  setCompetitorStatus({ type: "loading", message: "Fetching competitor insights..." });
                  try {
                    const payload = {
                      competitors: handles.map((h) => ({
                        handle: h.startsWith("@") ? h.slice(1) : h,
                        platform: platformFilter || selectedChannel?.platform || form.platform || "instagram",
                      })),
                    };
                    const res = await fetch("/api/meta/competitors", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload),
                    });
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      throw new Error(body?.error || "Failed to load competitors.");
                    }
                    setCompetitorInsights(Array.isArray(body.insights) ? body.insights : []);
                    setCompetitorStatus({ type: "success", message: "Fetched competitor suggestions." });
                  } catch (err) {
                    setCompetitorStatus({ type: "error", message: (err as Error).message || "Unable to load competitors." });
                  }
                }}
                disabled={competitorStatus.type === "loading"}
              >
                {competitorStatus.type === "loading" ? "Loading..." : "Fetch competitor tips"}
              </button>
              {competitorInsights.length > 0 ? (
                <div className="space-y-2 text-sm text-dark dark:text-dark-8">
                  {competitorInsights.map((c, idx) => (
                    <div key={`${c.handle}-${idx}`} className="rounded-lg bg-gray-1/60 p-2 dark:bg-dark-3/70">
                      <div className="text-xs font-semibold uppercase text-gray-6 dark:text-dark-6">
                        {c.handle} • {c.platform}
                      </div>
                      <div className="text-xs text-gray-6 dark:text-dark-6">Best times: {(c.bestPostingTimes || []).join(", ") || "N/A"}</div>
                      <div className="text-xs text-gray-6 dark:text-dark-6">
                        Hooks: {(c.topHooks || []).slice(0, 2).join(" | ") || "N/A"}
                      </div>
                      <div className="text-xs text-gray-6 dark:text-dark-6">
                        Hashtags: {(c.topHashtags || []).slice(0, 4).join(", ") || "N/A"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-5">No competitor data yet</div>
              )}
              {autoRunStatus.type !== "idle" && autoRunStatus.message ? (
                <div
                  className={cn(
                    "mt-3 rounded-lg border px-3 py-2 text-sm",
                    autoRunStatus.type === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700"
                  )}
                >
                  {autoRunStatus.message}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Channel idea library</p>
            <h2 className="text-lg font-bold text-dark dark:text-dark-8">
              {selectedChannel ? selectedChannel.name : "Select a channel"}
            </h2>
            <p className="text-sm text-gray-6 dark:text-dark-6">
              Save or generate ideas for the selected channel. Click “Use” to fill the idea field.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-lg border border-gray-3 px-3 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60"
              onClick={() => void loadChannelIdeas(form.channelId)}
              disabled={!form.channelId || ideasLoading}
            >
              {ideasLoading ? "Loading..." : "Refresh ideas"}
            </button>
            <button
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
              onClick={async () => {
                if (!form.channelId) return;
                setIdeasLoading(true);
                setIdeasError(null);
                try {
                  const res = await fetch("/api/channels/ideas", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ channelId: form.channelId, generate: true, count: 6 }),
                  });
                  const body = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error(body?.error || "Unable to generate ideas.");
                  }
                  setChannelIdeas(Array.isArray(body.ideas) ? body.ideas : []);
                } catch (err) {
                  setIdeasError((err as Error).message || "Unable to generate ideas.");
                } finally {
                  setIdeasLoading(false);
                }
              }}
              disabled={!form.channelId || ideasLoading}
            >
              Generate ideas
            </button>
            <button
              className="rounded-lg border border-gray-3 px-3 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60"
              onClick={async () => {
                setAutoRunStatus({ type: "loading", message: "Auto-running..." });
                try {
                  const res = await fetch("/api/automation/auto-run", { method: "POST" });
                  const body = await res.json().catch(() => ({}));
                  if (!res.ok) {
                    throw new Error(body?.error || "Auto-run failed.");
                  }
                  setAutoRunStatus({ type: "success", message: body?.message || "Auto-run complete." });
                  await loadHistory();
                } catch (err) {
                  setAutoRunStatus({ type: "error", message: (err as Error).message || "Unable to auto-run." });
                }
              }}
              disabled={autoRunStatus.type === "loading"}
            >
              {autoRunStatus.type === "loading" ? "Auto-running..." : "Run auto-generation"}
            </button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={30}
                value={bulkCount}
                onChange={(e) => setBulkCount(Math.max(1, Math.min(Number(e.target.value) || 5, 30)))}
                className="h-10 w-20 rounded-lg border border-gray-3 bg-white px-3 text-sm text-dark outline-none focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              />
              <input
                type="number"
                min={1}
                max={14}
                value={bulkSpacing}
                onChange={(e) => setBulkSpacing(Math.max(1, Math.min(Number(e.target.value) || 1, 14)))}
                className="h-10 w-20 rounded-lg border border-gray-3 bg-white px-3 text-sm text-dark outline-none focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
              />
              <button
                className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                onClick={async () => {
                  if (!form.channelId) return;
                  setBulkStatus({ type: "loading", message: "Bulk generating..." });
                  try {
                    const res = await fetch("/api/automation/bulk", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        channelId: form.channelId,
                        count: bulkCount,
                        spacingDays: bulkSpacing,
                        platform: form.platform,
                        tone: form.tone,
                      }),
                    });
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      throw new Error(body?.error || "Bulk generation failed.");
                    }
                    setBulkStatus({
                      type: "success",
                      message: `Generated ${body.generated || 0} reels.`,
                    });
                    await loadHistory();
                  } catch (err) {
                    setBulkStatus({
                      type: "error",
                      message: (err as Error).message || "Unable to bulk generate.",
                    });
                  }
                }}
                disabled={!form.channelId || bulkStatus.type === "loading"}
              >
                {bulkStatus.type === "loading" ? "Generating..." : "Bulk generate"}
              </button>
            </div>
          </div>
        </div>
        {!form.channelId ? (
          <div className="mt-4 rounded-lg border border-dashed border-gray-3 p-4 text-sm text-gray-6 dark:border-stroke-dark dark:text-dark-6">
            Select a channel to view or generate ideas.
          </div>
        ) : ideasError ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{ideasError}</div>
        ) : (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {ideasLoading && channelIdeas.length === 0 ? (
                <div className="rounded-lg border border-gray-3 p-4 text-sm text-gray-6 dark:border-stroke-dark dark:text-dark-6">
                  Loading ideas...
                </div>
              ) : channelIdeas.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-3 p-4 text-sm text-gray-6 dark:border-stroke-dark dark:text-dark-6">
                  No ideas saved yet. Generate or add one manually by typing in the Idea field and saving a reel.
                </div>
              ) : (
                channelIdeas.map((idea) => (
                  <div key={idea.id} className="flex flex-col justify-between rounded-lg border border-gray-3 p-3 shadow-sm dark:border-stroke-dark">
                    <div className="text-sm text-dark dark:text-dark-8">{idea.idea}</div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-6 dark:text-dark-6">
                      <span className="rounded-full bg-gray-1 px-2 py-1 font-semibold uppercase text-gray-7 dark:bg-dark-3 dark:text-dark-7">
                        {idea.source || "user"}
                      </span>
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setForm((prev) => ({ ...prev, idea: idea.idea }))}
                      >
                        Use
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {bulkStatus.type !== "idle" && bulkStatus.message ? (
              <div
                className={cn(
                  "mt-3 rounded-lg border px-3 py-2 text-sm",
                  bulkStatus.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700"
                )}
              >
                {bulkStatus.message}
              </div>
            ) : null}
          </>
        )}
      </div>

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
                    className="mt-2 h-28 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                    className="mt-2 h-28 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.channelId}
                    onChange={(e) => {
                      const selected = channels.find(
                        (c) => c.id === e.target.value
                      );
                      setForm((prev) => ({
                        ...prev,
                        channelId: e.target.value,
                        platform: selected?.platform
                          ? selected.platform.toUpperCase()
                          : prev.platform,
                        tone: selected?.tone || prev.tone,
                        style: selected?.style || prev.style,
                        template: selected?.template || prev.template,
                        durationSec:
                          typeof selected?.durationDefault === "number" &&
                          Number.isFinite(selected.durationDefault)
                            ? selected.durationDefault
                          : prev.durationSec,
                        idea:
                          prev.idea.trim() ||
                          (selected?.topic ? `Topic: ${selected.topic}` : ""),
                        brandColors: (selected?.brandColors || []).join(", "),
                        brandFonts: (selected?.brandFonts || []).join(", "),
                        logoUrl: selected?.logoUrl || prev.logoUrl,
                        endScreenTemplate: selected?.endScreenTemplate || prev.endScreenTemplate,
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
                  {selectedChannel && (
                    <p className="mt-2 text-xs text-gray-6 dark:text-dark-6">
                      Defaults applied: platform {selectedChannel.platform || "—"}, tone{" "}
                      {selectedChannel.tone || "—"}, style {selectedChannel.style || "—"}, duration{" "}
                      {selectedChannel.durationDefault ?? "—"}s.
                    </p>
                  )}
                </label>

                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Platform</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(instagram, youtube, etc.)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Template</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(meme, cinematic, etc.)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Brand colors</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(comma separated)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="#F97316, #7C3AED"
                    value={form.brandColors}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, brandColors: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Brand fonts</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(comma separated)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Poppins, Satoshi"
                    value={form.brandFonts}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, brandFonts: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Logo URL</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(optional)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="https://example.com/logo.png"
                    value={form.logoUrl}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, logoUrl: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>End screen template</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(optional)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="CTA + logo end card"
                    value={form.endScreenTemplate}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, endScreenTemplate: e.target.value }))
                    }
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>AI Voice ID</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(optional)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="voice_123"
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Music upload ID</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(optional)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="music_upload_123"
                    value={musicTrackId}
                    onChange={(e) => setMusicTrackId(e.target.value)}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Trending audio ID</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(optional)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="trending_audio_123"
                    value={trendingAudioId}
                    onChange={(e) => setTrendingAudioId(e.target.value)}
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

      {detailRow && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12"
            role="dialog"
            aria-modal="true"
          >
            <div className="mt-4 max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:bg-dark-2 dark:border dark:border-stroke-dark">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
                    Detail
                  </p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">
                    Reel {detailRow.id}
                  </h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-6 dark:text-dark-6">
                    {detailRow.status && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 font-semibold uppercase",
                          detailRow.status === "READY"
                            ? "bg-green-100 text-green-700"
                            : detailRow.status === "FAILED"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        )}
                      >
                        {detailRow.status}
                      </span>
                    )}
                    {detailRow.rendererJobId && (
                      <span className="text-xs text-gray-6 dark:text-dark-6">
                        Job: {detailRow.rendererJobId}
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

              <div className="mt-2 grid gap-4 md:grid-cols-[1.1fr,0.9fr]">
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
                  <div className="rounded-lg border border-gray-3 bg-white p-3 dark:border-stroke-dark dark:bg-dark-2">
                    <p className="text-xs font-semibold text-gray-6 dark:text-dark-6">
                      Script
                    </p>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-gray-8 dark:text-dark-8">
                      {detailRow.scriptText?.trim()
                        ? detailRow.scriptText
                        : "—"}
                    </div>
                  </div>
                  <p className="text-xs text-gray-6 dark:text-dark-6">
                    Created:{" "}
                    {detailRow.createdAt
                      ? new Date(detailRow.createdAt).toLocaleString()
                      : "—"}
                  </p>
                </div>
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
