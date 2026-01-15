"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

type ShareMenuPosition = { top: number; left: number; placement: "top" | "bottom" };

function isSafari() {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
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
  const [shareLoading, setShareLoading] = useState(false);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [shareMenuPos, setShareMenuPos] = useState<ShareMenuPosition | null>(null);
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<string, boolean>>({});
  const [fbSharePickerOpen, setFbSharePickerOpen] = useState(false);
  const [fbSharePages, setFbSharePages] = useState<Array<{ id: string; name: string }>>([]);
  const [fbShareVideoUrl, setFbShareVideoUrl] = useState<string | null>(null);
  const [fbShareCaption, setFbShareCaption] = useState<string | null>(null);
  const [activityEvents, setActivityEvents] = useState<
    Array<{ id: string; type: string; message: string; status?: string | null; timestamp: string; metadata?: Record<string, unknown> | null }>
  >([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const statusBadge = useMemo(() => normalizeStatusBadge(reel?.status), [reel?.status]);
  const shareCaption = useMemo(() => {
    const caption = publishPayload?.caption || reel?.caption || "New reel ready to share.";
    const tags = (publishPayload?.hashtags ?? reel?.hashtags ?? []).filter(Boolean).join(" ");
    return [caption, tags].filter(Boolean).join("\n\n");
  }, [publishPayload?.caption, publishPayload?.hashtags, reel?.caption, reel?.hashtags]);
  const facebookEnabled = Boolean(enabledPlatforms.facebook);
  const instagramEnabled = Boolean(enabledPlatforms.instagram);
  const linkedinEnabled = Boolean(enabledPlatforms.linkedin);

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

  useEffect(() => {
    const loadPlatforms = async () => {
      try {
        const res = await fetch("/api/social/platforms", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(body?.platforms)) return;
        const map: Record<string, boolean> = {};
        for (const platform of body.platforms) {
          if (platform?.platform) {
            map[String(platform.platform)] = Boolean(platform.enabled);
          }
        }
        setEnabledPlatforms(map);
      } catch {
        // ignore
      }
    };
    void loadPlatforms();
  }, []);

  useEffect(() => {
    if (!shareMenuId) return;
    const handleClick = () => setShareMenuId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [shareMenuId]);

  const setShareMenuPosition = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 150;
    const padding = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const placeAbove = rect.bottom + menuHeight + padding > viewportHeight && rect.top - menuHeight - padding > 0;
    const top = placeAbove ? Math.max(padding, rect.top - menuHeight - 8) : rect.bottom + 8;
    const left = Math.min(
      Math.max(padding, rect.right - menuWidth),
      Math.max(padding, viewportWidth - menuWidth - padding),
    );
    setShareMenuPos({ top, left, placement: placeAbove ? "top" : "bottom" });
  };

  const handleDeviceShare = async () => {
    const shareUrl = publishPayload?.videoUrl || reel?.videoUrl || window.location.href;
    if (!shareUrl) {
      setStatus({ type: "error", message: "No reel URL available to share." });
      return;
    }
    setShareLoading(true);
    try {
      if (navigator?.share) {
        await navigator.share({ text: shareCaption, url: shareUrl });
        setStatus({ type: "success", message: "Share sheet opened." });
        return;
      }
      await copyToClipboard([shareCaption, shareUrl].filter(Boolean).join("\n\n"));
      setStatus({ type: "success", message: "Copied for sharing." });
    } catch (err) {
      const error = err as Error;
      if (error?.name === "AbortError" || /share canceled/i.test(error?.message || "")) {
        return;
      }
      setStatus({ type: "error", message: "Share failed." });
    } finally {
      setShareLoading(false);
    }
  };

  const markFacebookPageActive = async (pageId: string) => {
    const res = await fetch("/api/social/facebook/select-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: pageId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || "Unable to set Facebook page.");
    }
    return body;
  };

  const publishReelToFacebook = async (videoUrl: string, caption: string, pageId?: string) => {
    const res = await fetch("/api/social/facebook/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: caption, videoUrl, pageId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || "Unable to publish to Facebook.");
    }
    return body;
  };

  const handleFacebookShare = async () => {
    if (!facebookEnabled) {
      setStatus({ type: "error", message: "Facebook sharing is disabled." });
      return;
    }
    const shareUrl = publishPayload?.videoUrl || reel?.videoUrl || "";
    if (!shareUrl) {
      setStatus({ type: "error", message: "No reel URL available to share." });
      return;
    }
    setShareLoading(true);
    try {
      const pagesRes = await fetch("/api/social/facebook/connected-pages", { cache: "no-store" });
      const pagesBody = await pagesRes.json().catch(() => ({}));
      if (!pagesRes.ok) {
        throw new Error(pagesBody?.error || "Connect Facebook first.");
      }
      const pages: Array<{ id: string; name: string }> = Array.isArray(pagesBody.pages)
        ? pagesBody.pages
            .map((page: { page_id?: string; page_name?: string | null }) => ({
              id: String(page.page_id ?? ""),
              name: page.page_name ?? "Untitled Page",
            }))
            .filter((page) => page.id)
        : [];
      if (pages.length === 0) {
        window.location.href = "/settings/social";
        return;
      }
      if (pages.length === 1) {
        await markFacebookPageActive(pages[0].id);
        await publishReelToFacebook(shareUrl, shareCaption, pages[0].id);
        setStatus({ type: "success", message: `Published to ${pages[0].name}.` });
        return;
      }
      setFbShareVideoUrl(shareUrl);
      setFbShareCaption(shareCaption);
      setFbSharePages(pages);
      setFbSharePickerOpen(true);
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to publish to Facebook." });
    } finally {
      setShareLoading(false);
    }
  };

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
          <div className="relative">
            <button
              type="button"
              aria-label="Share reel"
              onClick={(event) => {
                event.stopPropagation();
                setShareMenuPosition(event.currentTarget);
                setShareMenuId((prev) => (prev === "reel" ? null : "reel"));
              }}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
              disabled={shareLoading}
            >
              {shareLoading ? "Sharing..." : "Share"}
            </button>
            {shareMenuId === "reel" && shareMenuPos && (
              <ModalPortal>
                <div
                  onClick={(event) => event.stopPropagation()}
                  className="fixed z-[20001] w-44 rounded-lg border border-gray-3 bg-white p-2 text-xs font-semibold text-gray-7 shadow-lg dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-7"
                  style={{ top: shareMenuPos.top, left: shareMenuPos.left }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setShareMenuId(null);
                      void handleDeviceShare();
                    }}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:bg-gray-1 dark:hover:bg-dark-3"
                  >
                    Device share
                  </button>
                  {facebookEnabled && (
                    <button
                      type="button"
                      onClick={() => {
                        setShareMenuId(null);
                        void handleFacebookShare();
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:bg-gray-1 dark:hover:bg-dark-3"
                    >
                      Facebook
                    </button>
                  )}
                  {instagramEnabled && (
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-left opacity-60"
                    >
                      Instagram
                    </button>
                  )}
                  {linkedinEnabled && (
                    <button
                      type="button"
                      disabled
                      className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-left opacity-60"
                    >
                      LinkedIn
                    </button>
                  )}
                </div>
              </ModalPortal>
            )}
          </div>
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

      {fbSharePickerOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 px-4 py-12"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card-2 dark:border dark:border-white/10 dark:bg-gray-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Facebook</p>
                  <h2 className="text-lg font-bold text-dark dark:text-dark-8">Choose a Page</h2>
                  <p className="text-sm text-gray-6 dark:text-dark-6">Select the page to publish this reel.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFbSharePickerOpen(false);
                    setFbSharePages([]);
                    setFbShareVideoUrl(null);
                    setFbShareCaption(null);
                  }}
                  className="rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Close
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {fbSharePages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={async () => {
                      if (!fbShareVideoUrl || !fbShareCaption) {
                        setStatus({ type: "error", message: "No reel URL available to share." });
                        return;
                      }
                      setShareLoading(true);
                      try {
                        await markFacebookPageActive(page.id);
                        await publishReelToFacebook(fbShareVideoUrl, fbShareCaption, page.id);
                        setStatus({ type: "success", message: `Published to ${page.name}.` });
                        setFbSharePickerOpen(false);
                        setFbSharePages([]);
                        setFbShareVideoUrl(null);
                        setFbShareCaption(null);
                      } catch (err) {
                        setStatus({ type: "error", message: (err as Error).message || "Unable to publish to Facebook." });
                      } finally {
                        setShareLoading(false);
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-white/10 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <span>{page.name}</span>
                    <span className="text-xs text-gray-500">{page.id}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
