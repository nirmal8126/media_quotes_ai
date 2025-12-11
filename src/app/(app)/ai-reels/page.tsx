"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

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

  const handlePoll = async () => {
    if (!result?.reel?.id || polling) return;
    setPolling(true);
    try {
      const res = await fetch(`/api/reels/status?reelId=${encodeURIComponent(result.reel.id)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to load status.");
      }
      setResult((prev) => ({ ...(prev ?? {}), reel: body.reel }));
      setStatus({
        type: "success",
        message: `Status: ${body.reel?.status || "unknown"}`,
      });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to fetch status." });
    } finally {
      setPolling(false);
    }
  };

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
    </div>
  );
}
