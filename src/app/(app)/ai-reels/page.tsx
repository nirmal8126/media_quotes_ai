"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { DEFAULT_LANGUAGE, languageOptions, resolveLanguageCode } from "@/lib/languages";
import { useRouter } from "next/navigation";

type ReelHistoryItem = {
  id: string;
  status?: string | null;
  platform?: string | null;
  tone?: string | null;
  language?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  rendererJobId?: string | null;
  createdAt?: string | null;
  scriptId?: string | null;
  scriptText?: string | null;
  inputPrompt?: string | null;
  channelId?: string | null;
  durationSec?: number | null;
};

type Channel = {
  id: string;
  name: string;
  platform?: string | null;
  tone?: string | null;
  style?: string | null;
  language?: string | null;
  durationDefault?: number | null;
  personaId?: string | null;
  defaults?: Record<string, unknown> | null;
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const platforms = [
  { value: "YOUTUBE_SHORTS", label: "YouTube Shorts" },
  { value: "YOUTUBE", label: "YouTube" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "LINKEDIN", label: "LinkedIn" },
];
const tones = ["motivational", "educational", "funny", "dramatic", "emotional"];
const styles = ["cinematic", "minimal", "aesthetic", "bold", "fast-cut", "cartoon"];
const templates = ["cinematic", "cartoon", "meme", "talking_head", "minimal"];

const defaultForm = {
  idea: "",
  scriptText: "",
  channelId: "",
  platform: "YOUTUBE_SHORTS",
  tone: "motivational",
  template: "cinematic",
  style: "cinematic",
  durationSec: 15,
  withVoiceover: true,
  language: DEFAULT_LANGUAGE,
  personaId: "",
};

function isEmptyField(value?: string | null) {
  if (value === undefined || value === null) return true;
  const trimmed = String(value).trim();
  if (!trimmed) return true;
  const normalized = trimmed.toLowerCase();
  return normalized === "select" || normalized === "choose" || normalized === "default";
}

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export default function AiReelsPage() {
  const router = useRouter();
  const [form, setForm] = useState({ ...defaultForm });
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [history, setHistory] = useState<ReelHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelLoading, setChannelLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const sortedHistory = useMemo(
    () =>
      [...history].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      }),
    [history],
  );

  const resetFormState = useCallback(() => {
    setStatus({ type: "idle" });
    setForm({ ...defaultForm });
  }, []);

  const loadHistory = useCallback(async () => {
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
  }, []);

  const loadChannels = useCallback(async () => {
    setChannelLoading(true);
    try {
      const res = await fetch("/api/channels", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setChannels(Array.isArray(body.channels) ? body.channels : []);
      }
    } catch {
      // ignore
    } finally {
      setChannelLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadChannels();
  }, [loadChannels]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleGenerate = async () => {
    if (status.type === "loading") return;
    if (!form.idea.trim() && !form.scriptText.trim()) {
      setStatus({
        type: "error",
        message: "Provide either an idea or a script.",
      });
      return;
    }

    setStatus({
      type: "loading",
      message: "Generating script and starting render...",
    });
    const normalizedLanguage = resolveLanguageCode(form.language);
    const payloadDuration = Number(form.durationSec) || 15;
    try {
      const res = await fetch("/api/reels/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: form.idea,
          scriptText: form.scriptText,
          channelId: form.channelId || null,
          platform: form.platform,
          language: normalizedLanguage,
          template: form.template,
          tone: form.tone,
          style: form.style,
          personaId: form.personaId || null,
          durationSec: payloadDuration,
          withVoiceover: form.withVoiceover,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to start reel generation.");
      }
      setStatus({
        type: "success",
        message: "Reel created.",
      });
      setShowModal(false);
      await loadHistory();
      if (body?.reelId) {
        router.push(`/ai-reels/${body.reelId}`);
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: (err as Error).message || "Unable to start reel render.",
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
            resetFormState();
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          + Generate Reel
        </button>
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
            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                <tr>
                  <th className="px-4 py-3">Thumbnail</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Tone</th>
                  <th className="px-4 py-3">Duration</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {sortedHistory.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-gray-6 dark:text-dark-6"
                    >
                      No reels found.
                    </td>
                  </tr>
                ) : (
                  sortedHistory.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-1/60 align-top dark:hover:bg-dark-3/70"
                    >
                      <td className="px-4 py-3 text-sm text-gray-7 dark:text-dark-7">
                        {item.thumbnailUrl ? (
                          <img
                            src={item.thumbnailUrl}
                            alt="Reel thumbnail"
                            className="h-16 w-12 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-16 w-12 items-center justify-center rounded-md bg-gray-2 text-xs text-gray-6 dark:bg-dark-3 dark:text-dark-6">
                            —
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                        {item.platform || "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                        {item.tone || "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                        {item.durationSec ? `${item.durationSec}s` : "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            item.status === "READY" || item.status === "PUBLISHED"
                              ? "bg-green-100 text-green-700"
                              : item.status === "FAILED"
                                ? "bg-red-100 text-red-700"
                                : item.status === "RENDERING"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-2 text-gray-7 dark:bg-dark-3 dark:text-dark-7",
                          )}
                        >
                          {item.status || "unknown"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                        {item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-right">
                        <button
                          className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-2"
                          onClick={() =>
                            router.push(
                              item.status?.toUpperCase() === "PUBLISHED"
                                ? `/ai-reels/${item.id}/publish`
                                : `/ai-reels/${item.id}`,
                            )
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
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
                    resetFormState();
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
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(what the reel should cover)</span>
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
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(pick if needed)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.channelId}
                    onChange={(e) => {
                      const nextId = e.target.value;
                      const selected = channels.find((c) => c.id === nextId);
                      setForm((prev) => {
                        const next = { ...prev, channelId: nextId };
                        if (selected) {
                          if (isEmptyField(next.platform) && selected.platform) next.platform = selected.platform;
                          if (isEmptyField(next.tone) && selected.tone) next.tone = selected.tone;
                          if (isEmptyField(next.style) && selected.style) next.style = selected.style;
                          if (isEmptyField(next.language) && selected.language) next.language = selected.language;
                          if (!next.durationSec && selected.durationDefault) {
                            next.durationSec = selected.durationDefault;
                          }
                          if (isEmptyField(next.personaId) && selected.personaId) next.personaId = selected.personaId;
                          const templateDefault =
                            typeof selected.defaults?.template === "string"
                              ? (selected.defaults.template as string)
                              : null;
                          if (isEmptyField(next.template) && templateDefault) next.template = templateDefault;
                        }
                        return next;
                      });
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
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Language</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(English, Hindi, etc.)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.language}
                    onChange={(e) => setForm((prev) => ({ ...prev, language: e.target.value }))}
                  >
                    {languageOptions.map((lang) => (
                      <option key={lang.code} value={lang.code}>
                        {lang.label}
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
                    onChange={(e) => setForm((prev) => ({ ...prev, style: e.target.value }))}
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
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(if you have one)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="persona_123"
                    value={form.personaId}
                    onChange={(e) => setForm((prev) => ({ ...prev, personaId: e.target.value }))}
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

    </div>
  );
}
