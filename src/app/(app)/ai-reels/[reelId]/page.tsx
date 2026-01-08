"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { labelForLanguage } from "@/lib/languages";

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

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export default function ReelDetailPage() {
  const params = useParams<{ reelId?: string }>();
  const reelId = useMemo(() => (params?.reelId ? params.reelId.toString() : ""), [params]);
  const [reel, setReel] = useState<ReelDetail | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [loading, setLoading] = useState(true);

  const loadDetail = async () => {
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
  };

  useEffect(() => {
    void loadDetail();
  }, [reelId]);

  return (
    <div className="min-h-screen space-y-6 bg-gray-50 px-4 pb-12 pt-6 text-dark dark:bg-gray-950 dark:text-white md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">AI Reels</p>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Reel details</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadDetail()}
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
                  {reel.status === "RENDERING" ? "Rendering..." : "No video yet."}
                </div>
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
                  <div className="font-semibold">{reel.status || "—"}</div>
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Script</p>
              <div className="mt-2 whitespace-pre-wrap text-sm text-gray-7 dark:text-dark-7">
                {reel.scriptText || "No script stored yet."}
              </div>
            </div>

            {reel.caption ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Caption</p>
                <div className="mt-2 whitespace-pre-wrap text-sm text-gray-7 dark:text-dark-7">
                  {reel.caption}
                </div>
              </div>
            ) : null}

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
      )}
    </div>
  );
}
