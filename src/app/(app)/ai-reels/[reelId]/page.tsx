"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { labelForLanguage } from "@/lib/languages";
import { normalizeStatusBadge } from "@/lib/reels/status";

type ReelDetail = {
  id: string;
  status?: string | null;
  platform?: string | null;
  tone?: string | null;
  style?: string | null;
  template?: string | null;
  language?: string | null;
  durationSec?: number | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  scriptText?: string | null;
  inputPrompt?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  thumbnailPrompt?: string | null;
};

type PublishPayload = {
  reelId: string;
  videoUrl: string | null;
  caption: string;
  hashtags: string[];
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

function isSafari() {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

async function copyToClipboard(text: string) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export default function ReelDetailPage() {
  const params = useParams<{ reelId?: string }>();
  const reelId = useMemo(() => (params?.reelId ? params.reelId.toString() : ""), [params]);
  const [reel, setReel] = useState<ReelDetail | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [loading, setLoading] = useState(true);
  const [publishPayload, setPublishPayload] = useState<PublishPayload | null>(null);
  const [activityEvents, setActivityEvents] = useState<
    Array<{ id: string; type: string; message: string; status?: string | null; timestamp: string; metadata?: Record<string, unknown> | null }>
  >([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const statusBadge = useMemo(() => normalizeStatusBadge(reel?.status), [reel?.status]);

  const loadDetail = useCallback(async () => {
    if (!reelId) return;
    setLoading(true);
    setStatus({ type: "loading", message: "Loading reel..." });
    try {
      const res = await fetch(`/api/reels/${encodeURIComponent(reelId)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to load reel.");
      }
      setReel(body.reel ?? null);
      setStatus({ type: "success", message: "Reel loaded." });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to load reel." });
    } finally {
      setLoading(false);
    }
  }, [reelId]);

  const loadActivity = useCallback(async () => {
    if (!reelId) return;
    setActivityLoading(true);
    try {
      const res = await fetch(`/api/reels/activity?reelId=${encodeURIComponent(reelId)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(body.events)) {
        setActivityEvents(body.events);
      }
    } catch {
      // ignore
    } finally {
      setActivityLoading(false);
    }
  }, [reelId]);

  const loadPublishPayload = useCallback(async () => {
    if (!reelId) return;
    try {
      const res = await fetch(`/api/reels/${encodeURIComponent(reelId)}/publish`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to load publish payload.");
      }
      setPublishPayload({
        reelId: body.reelId ?? reelId,
        videoUrl: body.videoUrl ?? null,
        caption: body.caption ?? "",
        hashtags: Array.isArray(body.hashtags) ? body.hashtags : [],
      });
    } catch {
      // ignore
    }
  }, [reelId]);

  useEffect(() => {
    void loadDetail();
    void loadActivity();
    void loadPublishPayload();
  }, [loadDetail, loadActivity, loadPublishPayload]);

  const handleDownload = useCallback(async () => {
    const videoUrl = publishPayload?.videoUrl || reel?.videoUrl || "";
    if (!videoUrl) {
      setStatus({ type: "error", message: "No video URL available." });
      return;
    }
    try {
      if (isSafari()) {
        const res = await fetch(videoUrl);
        if (!res.ok) throw new Error("Failed to download video.");
        const blob = await res.blob();
        const objectUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = "mediaquotes-reel.mp4";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(objectUrl);
      } else {
        const link = document.createElement("a");
        link.href = videoUrl;
        link.download = "mediaquotes-reel.mp4";
        link.rel = "noopener";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setStatus({ type: "success", message: "Download started." });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to download video." });
    }
  }, [publishPayload?.videoUrl, reel?.videoUrl]);

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 px-4 pb-12 pt-6 text-dark dark:bg-gray-950 dark:text-white md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">AI Reels</p>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Reel details</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              void loadDetail();
              void loadActivity();
              void loadPublishPayload();
            }}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
          >
            Refresh
          </button>
          <Link
            href="/ai-reels"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
          >
            Back to AI Reels
          </Link>
        </div>
      </div>

      {status.message ? (
        <div
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            status.type === "error"
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
              : status.type === "loading"
                ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                : "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300",
          )}
        >
          {status.message}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm dark:border-white/10 dark:bg-gray-900 dark:text-gray-200">
          Loading reel...
        </div>
      ) : !reel ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm dark:border-white/10 dark:bg-gray-900 dark:text-gray-200">
          Reel not found.
        </div>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
            <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Video preview</p>

              {reel.status === "FAILED" ? (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {reel.errorMessage || "Render failed."}
                </div>
              ) : null}

              <div className="aspect-[9/16] w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-100 dark:border-white/10 dark:bg-gray-950">
                {reel.videoUrl ? (
                  <video
                    key={reel.videoUrl}
                    src={reel.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full rounded-lg bg-black"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                    {String(reel.status || "").toUpperCase() === "GENERATING" ? "Generating..." : "No video yet."}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleDownload()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                  disabled={!publishPayload?.videoUrl && !reel.videoUrl}
                >
                  Download MP4
                </button>
                {(publishPayload?.videoUrl || reel.videoUrl) && (
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(publishPayload?.videoUrl || reel.videoUrl || "")}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                  >
                    Copy Video URL
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Summary</p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-7 dark:text-dark-7">
                  <div>
                    <div className="text-xs uppercase text-gray-5 dark:text-dark-6">Platform</div>
                    <div className="font-semibold">{reel.platform || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-5 dark:text-dark-6">Tone</div>
                    <div className="font-semibold">{reel.tone || "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-5 dark:text-dark-6">Language</div>
                    <div className="font-semibold">{reel.language ? labelForLanguage(reel.language) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-5 dark:text-dark-6">Duration</div>
                    <div className="font-semibold">{reel.durationSec ? `${reel.durationSec}s` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-5 dark:text-dark-6">Status</div>
                    <div
                      className={cn(
                        "mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                        statusBadge.className,
                        "dark:text-dark-7",
                      )}
                    >
                      {statusBadge.label}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase text-gray-5 dark:text-dark-6">Created</div>
                    <div className="font-semibold">
                      {reel.createdAt ? new Date(reel.createdAt).toLocaleString() : "—"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Caption</p>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(publishPayload?.caption || reel.caption || "")}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                    disabled={!publishPayload?.caption && !reel.caption}
                  >
                    Copy Caption
                  </button>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-gray-7 dark:text-dark-7">
                  {publishPayload?.caption || reel.caption || "No caption stored yet."}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Hashtags</p>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard((publishPayload?.hashtags ?? reel.hashtags ?? []).join(" "))}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                    disabled={!(publishPayload?.hashtags?.length || reel.hashtags?.length)}
                  >
                    Copy Hashtags
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-gray-7 dark:text-dark-7">
                  {(publishPayload?.hashtags ?? reel.hashtags ?? []).length > 0
                    ? (publishPayload?.hashtags ?? reel.hashtags ?? []).map((tag) => (
                        <span key={tag} className="rounded-full border border-gray-200 px-2 py-1 text-xs">
                          {tag}
                        </span>
                      ))
                    : "No hashtags stored yet."}
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Script</p>
                  <button
                    type="button"
                    onClick={() => void copyToClipboard(reel.scriptText || "")}
                    className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                    disabled={!reel.scriptText}
                  >
                    Copy Script
                  </button>
                </div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-gray-7 dark:text-dark-7">
                  {reel.scriptText || "No script stored yet."}
                </div>
              </div>

              {reel.thumbnailUrl ? (
                <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Thumbnail</p>
                  <img
                    src={reel.thumbnailUrl}
                    alt="Reel thumbnail"
                    className="mt-3 w-full rounded-xl border border-gray-100 object-cover dark:border-white/10"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Timeline</p>
            <div className="mt-3 space-y-3 text-sm text-gray-7 dark:text-dark-7">
              {activityLoading ? (
                <div className="text-gray-6 dark:text-dark-6">Loading activity...</div>
              ) : activityEvents.length === 0 ? (
                <div className="text-gray-6 dark:text-dark-6">No activity yet.</div>
              ) : (
                activityEvents.map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-dark dark:text-dark-8">{event.message}</div>
                      {event.status ? (
                        <div className="text-xs text-gray-5 dark:text-dark-6">Status: {event.status}</div>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-5 dark:text-dark-6">
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
