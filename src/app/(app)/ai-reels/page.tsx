"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { BackgroundType, FontStyle, ReelRenderJob, ReelType, TextAnimation, VideoStyle } from "@/types/generation";

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const reelTypes: ReelType[] = ["text_only", "ai_character", "stock_plus_captions", "black_text", "aesthetic"];
const videoStyles: VideoStyle[] = ["minimal", "aesthetic", "dark", "neon", "cinematic"];
const backgrounds: BackgroundType[] = ["stock", "ai_generated", "gradient", "blur", "black"];
const fonts: FontStyle[] = ["bold", "minimal", "soft", "cursive"];
const textAnimations: TextAnimation[] = ["typewriter", "fade", "zoom", "slide"];

const defaultForm = {
  scriptSource: { type: "new", text: "" } as { type: "new" | "uploaded" | "existing"; text?: string; scriptId?: string },
  reelType: "text_only" as ReelType,
  videoStyle: "minimal" as VideoStyle,
  background: "stock" as BackgroundType,
  font: "bold" as FontStyle,
  textAnimation: "fade" as TextAnimation,
  aiVoiceId: "",
  trendingAudioId: "",
  resolution: { width: 1080, height: 1920 },
};

export default function AiReelsPage() {
  const [form, setForm] = useState({ ...defaultForm });
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [job, setJob] = useState<ReelRenderJob | null>(null);
  const [polling, setPolling] = useState(false);

  const handleGenerate = async () => {
    if (status.type === "loading") return;
    if (form.scriptSource.type === "new" && !form.scriptSource.text?.trim()) {
      setStatus({ type: "error", message: "Provide a script or pick an existing one." });
      return;
    }
    setStatus({ type: "loading", message: "Starting reel render..." });
    try {
      const res = await fetch("/api/reels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: form.scriptSource,
          reelType: form.reelType,
          visual: {
            videoStyle: form.videoStyle,
            background: form.background,
            font: form.font,
            textAnimation: form.textAnimation,
          },
          audio: {
            aiVoiceId: form.aiVoiceId || undefined,
            trendingAudioId: form.trendingAudioId || undefined,
          },
          resolution: form.resolution,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to start reel render.");
      }
      setJob(body.job ?? null);
      setStatus({ type: "success", message: body.message || "Reel job created." });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to start reel render." });
    }
  };

  const pollStatus = async () => {
    if (!job || polling) return;
    setPolling(true);
    try {
      const res = await fetch(`/api/reels/status?jobId=${encodeURIComponent(job.id)}`);
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.job) {
        setJob(body.job);
        setStatus({ type: "success", message: `Job status: ${body.job.status}` });
      } else {
        throw new Error(body?.error || "Failed to fetch status");
      }
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to fetch status." });
    } finally {
      setPolling(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">AI Reels</p>
            <h1 className="text-2xl font-bold text-dark">Generate video reels</h1>
            <p className="text-sm text-gray-6">Turn scripts into full MP4s with backgrounds, animations, and audio.</p>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
            onClick={handleGenerate}
            disabled={status.type === "loading"}
          >
            {status.type === "loading" ? "Generating..." : "Generate AI Reel"}
          </button>
          {job && (
            <button
              className="flex items-center gap-2 rounded-lg border border-gray-3 px-4 py-2.5 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 disabled:opacity-60"
              onClick={pollStatus}
              disabled={polling}
            >
              {polling ? "Checking..." : "Check Status"}
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-3 bg-white p-4 shadow-card-2">
            <h3 className="text-sm font-semibold text-dark">Script source</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {["new", "uploaded", "existing"].map((type) => (
                <button
                  key={type}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm font-semibold transition",
                    form.scriptSource.type === type ? "border-primary bg-primary/10 text-primary" : "border-gray-3 text-gray-7 hover:bg-gray-1",
                  )}
                  onClick={() => {
                    setForm((prev) => ({
                      ...prev,
                      scriptSource: { type: type as "new" | "uploaded" | "existing", text: "", scriptId: "" },
                    }));
                  }}
                >
                  {type === "new" ? "New script" : type === "uploaded" ? "Upload text" : "Existing script"}
                </button>
              ))}
            </div>
            {form.scriptSource.type === "new" && (
              <textarea
                className="mt-3 h-32 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                placeholder="Paste or write your script here..."
                value={form.scriptSource.text ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, scriptSource: { ...prev.scriptSource, text: e.target.value } }))}
              />
            )}
            {form.scriptSource.type === "uploaded" && (
              <textarea
                className="mt-3 h-24 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                placeholder="Paste uploaded text here..."
                value={form.scriptSource.text ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, scriptSource: { ...prev.scriptSource, text: e.target.value } }))}
              />
            )}
            {form.scriptSource.type === "existing" && (
              <input
                className="mt-3 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                placeholder="Enter existing script ID"
                value={form.scriptSource.scriptId ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, scriptSource: { ...prev.scriptSource, scriptId: e.target.value } }))}
              />
            )}
          </div>

          <div className="rounded-xl border border-gray-3 bg-white p-4 shadow-card-2">
            <h3 className="text-sm font-semibold text-dark">Reel type & visuals</h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-7">
                Reel type
                <select
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  value={form.reelType}
                  onChange={(e) => setForm((prev) => ({ ...prev, reelType: e.target.value as ReelType }))}
                >
                  {reelTypes.map((r) => (
                    <option key={r} value={r}>
                      {r.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-7">
                Video style
                <select
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  value={form.videoStyle}
                  onChange={(e) => setForm((prev) => ({ ...prev, videoStyle: e.target.value as VideoStyle }))}
                >
                  {videoStyles.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-7">
                Background
                <select
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  value={form.background}
                  onChange={(e) => setForm((prev) => ({ ...prev, background: e.target.value as BackgroundType }))}
                >
                  {backgrounds.map((b) => (
                    <option key={b} value={b}>
                      {b.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-7">
                Font
                <select
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  value={form.font}
                  onChange={(e) => setForm((prev) => ({ ...prev, font: e.target.value as FontStyle }))}
                >
                  {fonts.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-gray-7">
                Text animation
                <select
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  value={form.textAnimation}
                  onChange={(e) => setForm((prev) => ({ ...prev, textAnimation: e.target.value as TextAnimation }))}
                >
                  {textAnimations.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-gray-3 bg-white p-4 shadow-card-2">
            <h3 className="text-sm font-semibold text-dark">Audio</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-sm font-semibold text-gray-7">
                AI Voice ID (optional)
                <input
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  value={form.aiVoiceId}
                  onChange={(e) => setForm((prev) => ({ ...prev, aiVoiceId: e.target.value }))}
                  placeholder="voice_123"
                />
              </label>
              <label className="text-sm font-semibold text-gray-7">
                Trending Audio ID (optional)
                <input
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  value={form.trendingAudioId}
                  onChange={(e) => setForm((prev) => ({ ...prev, trendingAudioId: e.target.value }))}
                  placeholder="audio_123"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-6">Attach either AI voice or trending audio; fallback to silent if none.</p>
          </div>

          <div className="rounded-xl border border-gray-3 bg-white p-4 shadow-card-2">
            <h3 className="text-sm font-semibold text-dark">Resolution</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-semibold text-gray-7">
                Width
                <input
                  type="number"
                  min={320}
                  max={2160}
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  value={form.resolution.width}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, resolution: { ...prev.resolution, width: Number(e.target.value) || 1080 } }))
                  }
                />
              </label>
              <label className="text-sm font-semibold text-gray-7">
                Height
                <input
                  type="number"
                  min={320}
                  max={3840}
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary"
                  value={form.resolution.height}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, resolution: { ...prev.resolution, height: Number(e.target.value) || 1920 } }))
                  }
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-6">Default: 1080×1920 (Reels/TikTok). Adjust if needed.</p>
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
                  : "border-stroke bg-gray-1 text-dark",
            )}
          >
            {status.message}
          </div>
        )}
        {job && (
          <div className="mt-2 rounded-lg border border-gray-3 bg-gray-1 px-4 py-3 text-sm text-gray-7">
            <div>
              Job ID: <span className="font-semibold text-dark">{job.id}</span> · Status:{" "}
              <span className="font-semibold text-dark">{job.status}</span>
            </div>
            {job.videoUrl && (
              <div className="mt-2 flex items-center gap-2">
                <a href={job.videoUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                  View video
                </a>
                {job.thumbnailUrl && (
                  <a href={job.thumbnailUrl} className="text-primary underline" target="_blank" rel="noreferrer">
                    Thumbnail
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
