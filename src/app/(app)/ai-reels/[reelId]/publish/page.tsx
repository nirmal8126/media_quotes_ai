"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type PublishPayload = {
  reelId: string;
  videoUrl: string | null;
  caption: string;
  hashtags: string[];
  platformCaptions: {
    instagram: string;
    youtube: string;
    facebook: string;
  };
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const platformOptions = [
  { id: "instagram", label: "Instagram" },
  { id: "youtube", label: "YouTube" },
  { id: "facebook", label: "Facebook" },
] as const;

type PlatformId = (typeof platformOptions)[number]["id"];

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

export default function ReelPublishPage() {
  const params = useParams<{ reelId?: string }>();
  const reelId = useMemo(() => (params?.reelId ? params.reelId.toString() : ""), [params]);
  const [payload, setPayload] = useState<PublishPayload | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [platform, setPlatform] = useState<PlatformId>("instagram");

  const loadPayload = async () => {
    if (!reelId) return;
    setStatus({ type: "loading", message: "Loading publish data..." });
    try {
      const res = await fetch(`/api/reels/${encodeURIComponent(reelId)}/publish`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to load publish data.");
      }
      setPayload(body);
      setStatus({ type: "success", message: "Publish data ready." });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to load publish data." });
    }
  };

  useEffect(() => {
    void loadPayload();
  }, [reelId]);

  const platformCaption = payload?.platformCaptions?.[platform] || payload?.caption || "";
  const hashtagsText = payload?.hashtags?.join(" ") || "";

  const handleCopyCaption = async () => {
    try {
      await copyToClipboard(platformCaption);
      setStatus({ type: "success", message: "Caption copied to clipboard." });
    } catch {
      setStatus({ type: "error", message: "Unable to copy caption." });
    }
  };

  const handleCopyHashtags = async () => {
    try {
      await copyToClipboard(hashtagsText);
      setStatus({ type: "success", message: "Hashtags copied to clipboard." });
    } catch {
      setStatus({ type: "error", message: "Unable to copy hashtags." });
    }
  };

  const downloadViaLink = (url: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = "mediaquotes-reel.mp4";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadViaBlob = async (url: string) => {
    const res = await fetch(url);
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
  };

  const handleDownload = async () => {
    if (!payload?.videoUrl) {
      setStatus({ type: "error", message: "No video URL available." });
      return;
    }
    try {
      if (isSafari()) {
        await downloadViaBlob(payload.videoUrl);
      } else {
        downloadViaLink(payload.videoUrl);
      }
      setStatus({ type: "success", message: "Download started." });
    } catch (err) {
      try {
        await downloadViaBlob(payload.videoUrl);
        setStatus({ type: "success", message: "Download started." });
      } catch {
        setStatus({ type: "error", message: (err as Error).message || "Unable to download video." });
      }
    }
  };

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 px-4 pb-12 pt-6 text-dark dark:bg-gray-950 dark:text-white md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">AI Reels</p>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Publish</h1>
          <p className="text-sm text-gray-6 dark:text-dark-6">Prepare your reel for manual posting.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadPayload()}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
          >
            Refresh
          </button>
          <Link
            href={`/ai-reels/${reelId}`}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
          >
            Back to Reel
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

      {!payload ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm dark:border-white/10 dark:bg-gray-900 dark:text-gray-200">
          Loading publish data...
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Video preview</p>
                <div className="text-sm text-gray-6 dark:text-dark-6">Reel ID: {payload.reelId}</div>
              </div>
            </div>

            <div className="aspect-[9/16] w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-100 dark:border-white/10 dark:bg-gray-950">
              {payload.videoUrl ? (
                <video controls className="h-full w-full object-cover" src={payload.videoUrl} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                  Video not available yet.
                </div>
              )}
            </div>

            <button
              onClick={() => void handleDownload()}
              className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
            >
              Download MP4
            </button>
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Platform</p>
              <div className="mt-2">
                <select
                  value={platform}
                  onChange={(event) => setPlatform(event.target.value as PlatformId)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm focus:border-primary focus:outline-none dark:border-white/10 dark:bg-gray-950 dark:text-gray-200"
                >
                  {platformOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-gray-6 dark:text-dark-6">
                  Formatting changes for platform only. No re-generation.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Caption</p>
                <button
                  onClick={() => void handleCopyCaption()}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                >
                  Copy Caption
                </button>
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm text-gray-7 dark:text-dark-7">
                {platformCaption || "No caption available."}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Hashtags</p>
                <button
                  onClick={() => void handleCopyHashtags()}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                >
                  Copy Hashtags
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-6 dark:text-dark-6">
                {payload.hashtags?.length
                  ? payload.hashtags.map((tag) => (
                      <span key={tag} className="rounded-full bg-gray-1 px-2 py-1 dark:bg-dark-3">
                        {tag}
                      </span>
                    ))
                  : "No hashtags available."}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
