"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
};

type TabId = "settings" | "music" | "media" | "captions" | "thumbnail";

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "settings", label: "Settings" },
  { id: "music", label: "Music" },
  { id: "media", label: "Media" },
  { id: "captions", label: "Captions" },
  { id: "thumbnail", label: "Thumbnail" },
];

export default function ReelCustomizePage() {
  const params = useParams<{ reelId?: string }>();
  const router = useRouter();
  const reelId = useMemo(() => (params?.reelId ? params.reelId.toString() : ""), [params]);
  const [activeTab, setActiveTab] = useState<TabId>("media");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reel, setReel] = useState<ReelDetail | null>(null);
  const [actionStatus, setActionStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message?: string }>({
    type: "idle",
  });
  const [pacing, setPacing] = useState<"slow" | "normal" | "fast">("normal");
  const [hookEmphasis, setHookEmphasis] = useState<number>(60);
  const [autoScenes, setAutoScenes] = useState(true);
  const [emphasizeEmotion, setEmphasizeEmotion] = useState(true);
  const [removeLowEngagement, setRemoveLowEngagement] = useState(false);
  const [targetDuration, setTargetDuration] = useState<number>(10);
  const [lockDuration, setLockDuration] = useState(true);
  const [autoTrim, setAutoTrim] = useState(false);
  const [seamlessLoop, setSeamlessLoop] = useState(true);
  const [fadeOutro, setFadeOutro] = useState(false);
  const [previewQuality] = useState("Medium");
  const [exportQuality] = useState("High (1080p)");
  const [musicQuery, setMusicQuery] = useState("suspense | happy | kids");
  const [recommendedTrack, setRecommendedTrack] = useState("Happy Sparkle");
  const [voiceBalance, setVoiceBalance] = useState<number>(60);
  const [autoDuck, setAutoDuck] = useState(true);
  const [beatSync, setBeatSync] = useState(true);
  const [introWhoosh, setIntroWhoosh] = useState(false);
  const [outroHit, setOutroHit] = useState(false);
  const [fadeInOut, setFadeInOut] = useState(false);
  const [activeScene, setActiveScene] = useState<number>(1);
  const [captionText, setCaptionText] = useState(
    "Hook: Stop scrolling.\nBody: This 10-second habit can reset your day.\nCTA: Follow for more.",
  );
  const [captionStyle, setCaptionStyle] = useState("Viral Bold");
  const [captionMode, setCaptionMode] = useState<"multi" | "one">("multi");
  const [captionSpeed, setCaptionSpeed] = useState<number>(55);
  const [highlightKeywords, setHighlightKeywords] = useState(true);
  const [highlightColor, setHighlightColor] = useState("#FACC15");
  const [emojiBoost, setEmojiBoost] = useState(true);
  const [thumbHeadline, setThumbHeadline] = useState("THIS ONE HABIT");
  const [thumbFont, setThumbFont] = useState("Poppins");
  const [thumbStyle, setThumbStyle] = useState("Bold");
  const [thumbFaceOutline, setThumbFaceOutline] = useState(true);
  const [thumbGlow, setThumbGlow] = useState(true);
  const [thumbContrast, setThumbContrast] = useState(true);
  const [thumbUseBrandColors, setThumbUseBrandColors] = useState(true);
  const [thumbUseBrandFont, setThumbUseBrandFont] = useState(true);
  const versionTags = ["v1", "v2", "v3"];

  useEffect(() => {
    if (!reelId) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/reels/status?reelId=${encodeURIComponent(reelId)}`);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Unable to load reel.");
        }
        setReel(body.reel ?? null);
      } catch (err) {
        setError((err as Error).message || "Failed to load reel.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [reelId]);

  const handleSave = (message = "Changes saved") => {
    setActionStatus({ type: "success", message });
  };

  const handleExport = (message = "Export queued") => {
    setActionStatus({ type: "success", message });
  };

  const handlePublish = (message = "Publish queued") => {
    setActionStatus({ type: "success", message });
  };

  function renderTabContent(tab: TabId) {
    switch (tab) {
      case "settings":
        return (
          <div className="space-y-6 text-sm text-gray-700 dark:text-gray-200">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">AI Brain + Structure</p>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-dark dark:text-white">Video Behavior</p>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">AI will analyze pacing + narration energy.</span>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Pacing</p>
                <div className="flex flex-wrap gap-2">
                  {(["slow", "normal", "fast"] as const).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPacing(speed)}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition",
                        pacing === speed
                          ? "bg-primary/10 text-primary dark:bg-white/10 dark:text-white"
                          : "border border-gray-200 text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-300",
                      )}
                    >
                      {speed === "slow" ? "Slow" : speed === "normal" ? "Normal" : "Fast"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-600 dark:text-gray-300">Hook Emphasis</span>
                  <span className="text-gray-500 dark:text-gray-400">First 2–3s impact</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={hookEmphasis}
                  onChange={(e) => setHookEmphasis(Number(e.target.value))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">AI Scene Logic</p>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={autoScenes} onChange={(e) => setAutoScenes(e.target.checked)} className="accent-primary" />
                Auto scene selection
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={emphasizeEmotion}
                  onChange={(e) => setEmphasizeEmotion(e.target.checked)}
                  className="accent-primary"
                />
                Emphasize emotional moments
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={removeLowEngagement}
                  onChange={(e) => setRemoveLowEngagement(e.target.checked)}
                  className="accent-primary"
                />
                Remove low-engagement scenes (AI)
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Duration Control</p>
              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Target duration:
                  <select
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(Number(e.target.value))}
                    className="ml-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                  >
                    {[10, 15, 20, 30, 45, 60].map((sec) => (
                      <option key={sec} value={sec}>
                        {sec}s
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={lockDuration} onChange={(e) => setLockDuration(e.target.checked)} className="accent-primary" />
                Lock duration
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={autoTrim} onChange={(e) => setAutoTrim(e.target.checked)} className="accent-primary" />
                Auto-trim to platform best length
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Loop & Export Behavior</p>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Playback & Loop</p>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={seamlessLoop}
                    onChange={(e) => setSeamlessLoop(e.target.checked)}
                    className="accent-primary"
                  />
                  Seamless loop ending
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={fadeOutro} onChange={(e) => setFadeOutro(e.target.checked)} className="accent-primary" />
                  Fade outro
                </label>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Export Quality</p>
                <div className="text-xs text-gray-600 dark:text-gray-300">Preview: {previewQuality}</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">Export: {exportQuality}</div>
              </div>
            </div>
          </div>
        );
      case "music":
        return (
          <div className="space-y-6 text-sm text-gray-700 dark:text-gray-200">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Emotion + Energy</p>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Music</p>
              <div className="flex items-center gap-2">
                <input
                  value={musicQuery}
                  onChange={(e) => setMusicQuery(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                  placeholder="Search moods or paste track"
                />
                <button className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">Search</button>
              </div>
              <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs dark:border-white/10">
                <p className="font-semibold text-gray-700 dark:text-gray-200">AI Recommended</p>
                <div className="mt-2 space-y-2">
                  {["Happy Sparkle", "Calm Uplift", "Playful Bounce"].map((track) => (
                    <label key={track} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="recommended-track"
                        checked={recommendedTrack === track}
                        onChange={() => setRecommendedTrack(track)}
                        className="accent-primary"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-200">{track}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Music Controls</p>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-300">Volume balance</span>
                <span className="text-gray-500 dark:text-gray-400">Voice | Music</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={voiceBalance}
                onChange={(e) => setVoiceBalance(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>Voice</span>
                <span>Music</span>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={autoDuck} onChange={(e) => setAutoDuck(e.target.checked)} className="accent-primary" />
                Auto-duck under voice
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={beatSync} onChange={(e) => setBeatSync(e.target.checked)} className="accent-primary" />
                Beat sync to cuts
              </label>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Advanced</p>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={introWhoosh} onChange={(e) => setIntroWhoosh(e.target.checked)} className="accent-primary" />
                Intro whoosh
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={outroHit} onChange={(e) => setOutroHit(e.target.checked)} className="accent-primary" />
                Outro hit
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={fadeInOut} onChange={(e) => setFadeInOut(e.target.checked)} className="accent-primary" />
                Fade in / out
              </label>
            </div>
          </div>
        );
      case "media":
        return (
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Scene-level control</p>
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Scenes</p>
              <div className="space-y-3">
                {[1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-lg border bg-gray-50 p-3 dark:bg-[#0f0f13]",
                      activeScene === idx ? "border-primary" : "border-gray-200 dark:border-white/5",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-dark dark:text-white">
                          Scene {idx} ({idx === 1 ? "0–2s" : idx === 2 ? "2–5s" : "5–8s"})
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Thumbnail</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setActiveScene(idx)}
                          className="rounded-md border border-primary/60 px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary"
                        >
                          Replace
                        </button>
                        <button className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200">
                          {idx === 1 ? "Lock" : "Extend"}
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Replace media
                        <input
                          type="file"
                          className="mt-1 w-full rounded-lg border border-dashed border-gray-300 bg-white px-2 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-black dark:text-gray-200"
                        />
                      </label>
                      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                        Crop / Fit
                        <select className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white">
                          <option>Fit</option>
                          <option>Fill</option>
                          <option>Center crop</option>
                        </select>
                      </label>
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Zoom style</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {["None", "Slow", "Dynamic"].map((label) => (
                          <button
                            key={label}
                            className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-300/40 dark:bg-amber-900/30 dark:text-amber-100">
                      <div className="font-semibold">AI Suggestion:</div>
                      <p>This scene could be stronger as the hook.</p>
                      <div className="mt-2 flex gap-2">
                        <button className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white">Apply</button>
                        <button className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200">
                          Ignore
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case "captions":
        return (
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Stickiest tab</p>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Captions</p>
              <textarea
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                className="mt-2 h-32 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Hook, Body, CTA — quick edits before export.</p>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Styles</p>
              <div className="grid gap-2 md:grid-cols-2">
                {["Viral Bold", "Kids Cartoon", "Minimal Clean", "Motivational Impact"].map((style) => (
                  <button
                    key={style}
                    onClick={() => setCaptionStyle(style)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm font-semibold transition",
                      captionStyle === style
                        ? "border-primary bg-primary/10 text-primary dark:border-white/20 dark:bg-white/10 dark:text-white"
                        : "border-gray-200 text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200",
                    )}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Timing & Animation</p>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Caption mode</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCaptionMode("multi")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      captionMode === "multi"
                        ? "bg-primary/10 text-primary dark:bg-white/10 dark:text-white"
                        : "border border-gray-200 text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200",
                    )}
                  >
                    Multi-word
                  </button>
                  <button
                    onClick={() => setCaptionMode("one")}
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold transition",
                      captionMode === "one"
                        ? "bg-primary/10 text-primary dark:bg-white/10 dark:text-white"
                        : "border border-gray-200 text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200",
                    )}
                  >
                    One-word
                  </button>
                </div>
                <div className="mt-1">
                  <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-300">
                    <span>Speed</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={captionSpeed}
                    onChange={(e) => setCaptionSpeed(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Highlights</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={highlightKeywords}
                  onChange={(e) => setHighlightKeywords(e.target.checked)}
                  className="accent-primary"
                />
                Highlight keywords
              </label>
              <label className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-gray-600 dark:text-gray-300">Color:</span>
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                  className="h-7 w-10 cursor-pointer rounded border border-gray-200 bg-white p-0 dark:border-white/10 dark:bg-black"
                />
                <span className="text-xs text-gray-500 dark:text-gray-400">{highlightColor}</span>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={emojiBoost} onChange={(e) => setEmojiBoost(e.target.checked)} className="accent-primary" />
                Emoji boost (AI)
              </label>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">AI Tools</p>
              <div className="flex flex-wrap gap-2">
                {["Shorter", "More emotional", "Kids-friendly", "Viral tone"].map((tool) => (
                  <button
                    key={tool}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                  >
                    {tool}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      case "thumbnail":
        return (
          <div className="space-y-4 text-sm text-gray-700 dark:text-gray-200">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Click magnet</p>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">AI Thumbnails</p>
              <div className="flex flex-wrap gap-2">
                {["Option 1", "Option 2", "Option 3"].map((opt) => (
                  <button
                    key={opt}
                    className="h-24 w-24 rounded-lg border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600 transition hover:border-primary hover:text-primary dark:border-white/10 dark:bg-black/50 dark:text-gray-300"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Text</p>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                Headline:
                <input
                  value={thumbHeadline}
                  onChange={(e) => setThumbHeadline(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                />
              </label>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Font:
                  <select
                    value={thumbFont}
                    onChange={(e) => setThumbFont(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                  >
                    {["Poppins", "Satoshi", "Inter", "Montserrat"].map((f) => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Text style:
                  <select
                    value={thumbStyle}
                    onChange={(e) => setThumbStyle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                  >
                    {["Bold", "SemiBold", "Outline"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Enhancements</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={thumbFaceOutline}
                  onChange={(e) => setThumbFaceOutline(e.target.checked)}
                  className="accent-primary"
                />
                Face outline
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={thumbGlow} onChange={(e) => setThumbGlow(e.target.checked)} className="accent-primary" />
                Glow effect
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={thumbContrast}
                  onChange={(e) => setThumbContrast(e.target.checked)}
                  className="accent-primary"
                />
                High contrast
              </label>
            </div>

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Brand</p>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={thumbUseBrandColors}
                  onChange={(e) => setThumbUseBrandColors(e.target.checked)}
                  className="accent-primary"
                />
                Use channel colors
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={thumbUseBrandFont}
                  onChange={(e) => setThumbUseBrandFont(e.target.checked)}
                  className="accent-primary"
                />
                Use channel font
              </label>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen space-y-8 bg-gray-50 px-4 pb-28 pt-6 text-dark dark:bg-gray-950 dark:text-white md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">AI Reel</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-dark dark:text-white">{reelId ? `Reel ${reelId}` : "Reel"}</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary dark:bg-white/10 dark:text-gray-200">
              Customize
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-gray-900 px-2 py-1 font-semibold uppercase text-white dark:bg-white/15 dark:text-white">
              {reel?.status || "PENDING"}
            </span>
            <span className="rounded-full bg-primary/10 px-2 py-1 font-semibold text-primary dark:bg-white/10 dark:text-white">
              {reel?.platform || "Short-form"}
            </span>
            {reel?.tone && (
              <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700 dark:bg-white/5 dark:text-gray-200">
                {reel.tone}
              </span>
            )}
            <span className="rounded-full bg-gray-100 px-2 py-1 font-semibold text-gray-700 dark:bg-white/5 dark:text-gray-200">
              {labelForLanguage(reel?.language || "en")}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
            {versionTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-gray-200 px-2 py-1 text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
              >
                {tag}
              </span>
            ))}
          </div>
          <Link
            href="/ai-reels"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
          >
            Back to AI Reels
          </Link>
          <button
            onClick={() => handleExport("Export queued")}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Export / Publish
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm dark:border-white/10 dark:bg-gray-900 dark:text-gray-200">
          Loading reel...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-300/40 dark:bg-red-900/30">
          {error}
        </div>
      ) : !reel ? (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm dark:border-white/10 dark:bg-gray-900 dark:text-gray-200">
          Reel not found.
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
          {actionStatus.message && (
            <div
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                actionStatus.type === "error"
                  ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                  : "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300",
              )}
            >
              {actionStatus.message}
            </div>
          )}
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-300/40 dark:bg-amber-900/30 dark:text-amber-100">
            <span className="font-semibold">AI Insight:</span>
            <span>Shortening the hook may increase retention by ~12%.</span>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3 text-sm font-semibold text-gray-700 dark:border-white/5 dark:text-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "rounded-full px-3 py-1 transition",
                  activeTab === tab.id
                    ? "bg-primary/10 text-primary dark:bg-white/10 dark:text-white"
                    : "border border-transparent text-gray-600 hover:border-gray-200 hover:text-dark dark:text-gray-400 dark:hover:border-white/10",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,1fr)]">
            <div className="space-y-4 lg:pr-2">{renderTabContent(activeTab)}</div>

            <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-3 shadow-card-2 dark:border-white/10 dark:bg-gray-800">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Live preview</span>
                <span>Higher quality on export</span>
              </div>
              <div className="mt-2 aspect-[9/16] w-full overflow-hidden rounded-lg bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-900 dark:to-gray-950">
                {reel.videoUrl ? (
                  <video
                    controls
                    className={cn(
                      "h-full w-full object-cover transition ring-2 ring-transparent",
                      activeScene === 1
                        ? "ring-primary/70"
                        : activeScene === 2
                          ? "ring-amber-400"
                          : activeScene === 3
                            ? "ring-emerald-400"
                            : "ring-transparent",
                    )}
                    src={reel.videoUrl}
                    poster={reel.thumbnailUrl ?? undefined}
                  />
                ) : reel.thumbnailUrl ? (
                  <img
                    src={reel.thumbnailUrl}
                    alt="Reel thumbnail"
                    className={cn(
                      "h-full w-full object-cover transition ring-2 ring-transparent",
                      activeScene === 1
                        ? "ring-primary/70"
                        : activeScene === 2
                          ? "ring-amber-400"
                          : activeScene === 3
                            ? "ring-emerald-400"
                            : "ring-transparent",
                    )}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-300">
                    Video processing... (waveform + music overlay)
                  </div>
                )}
              </div>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                Preview may differ slightly from final render. Caption overlay + word highlights shown here. Safe-area overlay for thumbnails.
              </p>
              <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary dark:bg-white/10 dark:text-white">
                Replace music instantly (no regen)
              </div>
              <div className="mt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => handleExport("Export queued")}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/15 dark:text-gray-100 dark:hover:border-white/30"
                >
                  Export
                </button>
                <button
                  onClick={() => handlePublish()}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/15 dark:text-gray-100 dark:hover:border-white/30"
                >
                  Publish
                </button>
                <button
                  onClick={() => handleSave("Saved preview")}
                  className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/15 dark:text-gray-100 dark:hover:border-white/30"
                >
                  Save
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="rounded-full bg-gray-100 px-2 py-1 uppercase text-gray-700 dark:bg-white/5 dark:text-gray-200">
                  {reel.status || "PENDING"}
                </span>
                {reel.platform && (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 dark:bg-white/5 dark:text-gray-200">
                    {reel.platform}
                  </span>
                )}
                {reel.tone && (
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-gray-700 dark:bg-white/5 dark:text-gray-200">
                    {reel.tone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-800/80">
            <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-300">Timeline</p>
            <div className="mt-2 h-20 w-full rounded-md bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-900 dark:to-gray-950">
              <div className="flex h-full items-center justify-center text-xs text-gray-500 dark:text-gray-300">
                Caption + shot timeline placeholder
              </div>
            </div>
          </div>

        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-2 md:left-[290px]">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-3 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur dark:border-white/10 dark:bg-gray-900/95 md:max-w-full md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">Sticky actions follow you—no scrolling back up.</div>
          <div className="flex w-full flex-wrap gap-2 md:w-auto">
            <button
              onClick={() => handleSave()}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:border-primary hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 md:flex-none"
            >
              Save changes
            </button>
            <button
              onClick={() => handleExport("Next step: export queued")}
              className="flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 md:flex-none"
            >
              Next: Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
