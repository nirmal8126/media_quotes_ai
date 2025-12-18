"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
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
  const [autoReorder, setAutoReorder] = useState(true);
  const [targetDuration, setTargetDuration] = useState<number>(10);
  const [lockDuration, setLockDuration] = useState(true);
  const [autoTrim, setAutoTrim] = useState(false);
  const [seamlessLoop, setSeamlessLoop] = useState(true);
  const [fadeOutro, setFadeOutro] = useState(false);
  const [previewQuality] = useState("Medium");
  const [exportQuality] = useState("High (1080p)");
  const [mood, setMood] = useState<"happy" | "suspense" | "calm">("happy");
  const [musicQuery, setMusicQuery] = useState("suspense | happy | kids");
  const [recommendedTrack, setRecommendedTrack] = useState("Happy Sparkle");
  const [voiceBalance, setVoiceBalance] = useState<number>(60);
  const [autoDuck, setAutoDuck] = useState(true);
  const [beatSync, setBeatSync] = useState(true);
  const [introWhoosh, setIntroWhoosh] = useState(false);
  const [outroHit, setOutroHit] = useState(false);
  const [fadeInOut, setFadeInOut] = useState(false);
  const [trendingPlatform, setTrendingPlatform] = useState("Instagram");
  const [trendingRegion, setTrendingRegion] = useState("Global");
  const [activeScene, setActiveScene] = useState<number>(1);
  const [sceneStyles, setSceneStyles] = useState<Record<number, string>>({
    1: "Cinematic zoom",
    2: "Ken Burns",
    3: "Parallax",
  });
  const [captionText, setCaptionText] = useState(
    "Hook: Stop scrolling.\nBody: This 10-second habit can reset your day.\nCTA: Follow for more.",
  );
  const [captionStyle, setCaptionStyle] = useState("MrBeast");
  const [captionMode, setCaptionMode] = useState<"multi" | "one">("multi");
  const [captionSpeed, setCaptionSpeed] = useState<number>(55);
  const [highlightKeywords, setHighlightKeywords] = useState(true);
  const [highlightColor, setHighlightColor] = useState("#FACC15");
  const [emojiBoost, setEmojiBoost] = useState(true);
  const [ctaText, setCtaText] = useState("Follow for more");
  const [autoCtaPlacement, setAutoCtaPlacement] = useState(true);
  const [thumbHeadline, setThumbHeadline] = useState("THIS ONE HABIT");
  const [thumbFont, setThumbFont] = useState("Poppins");
  const [thumbStyle, setThumbStyle] = useState("Bold");
  const [thumbFaceOutline, setThumbFaceOutline] = useState(true);
  const [thumbGlow, setThumbGlow] = useState(true);
  const [thumbContrast, setThumbContrast] = useState(true);
  const [thumbUseBrandColors, setThumbUseBrandColors] = useState(true);
  const [thumbUseBrandFont, setThumbUseBrandFont] = useState(true);
  const [sceneUploads, setSceneUploads] = useState<Record<number, string | null>>({});
  const [collapsedScenes, setCollapsedScenes] = useState<Record<number, boolean>>({});
  const [sceneOrder, setSceneOrder] = useState<number[]>([1, 2, 3]);
  const [draggingScene, setDraggingScene] = useState<number | null>(null);
  const platformLabel = (reel?.platform || "YOUTUBE_SHORTS").toString();

  const collapseStateFor = (openScene?: number): Record<number, boolean> => {
    const base: Record<number, boolean> = { 1: true, 2: true, 3: true };
    if (openScene) {
      base[openScene] = false;
    }
    return base;
  };

  useEffect(() => {
    setCollapsedScenes({ 1: false, 2: true, 3: true });
  }, []);

  const loadReel = async () => {
    if (!reelId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reels/status?reelId=${encodeURIComponent(reelId)}`, { cache: "no-store" });
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

  useEffect(() => {
    void loadReel();
  }, [reelId]);

  const gatherSettings = () => ({
    pacing,
    hookEmphasis,
    autoScenes,
    emphasizeEmotion,
    removeLowEngagement,
    autoReorder,
    targetDuration,
    lockDuration,
    autoTrim,
    seamlessLoop,
    fadeOutro,
    previewQuality,
    exportQuality,
    mood,
    musicQuery,
    recommendedTrack,
    voiceBalance,
    autoDuck,
    beatSync,
    introWhoosh,
    outroHit,
    fadeInOut,
    trendingPlatform,
    trendingRegion,
    activeScene,
    sceneStyles,
    captionText,
    captionStyle,
    captionMode,
    captionSpeed,
    highlightKeywords,
    highlightColor,
    emojiBoost,
    ctaText,
    autoCtaPlacement,
    thumbHeadline,
    thumbFont,
    thumbStyle,
    thumbFaceOutline,
    thumbGlow,
    thumbContrast,
    thumbUseBrandColors,
    thumbUseBrandFont,
    sceneUploads,
    sceneOrder,
  });

  type ActionKind = "save" | "export" | "publish" | "applySuggestion" | "ignoreSuggestion";

  const performAction = async (action: ActionKind, options?: { message?: string; suggestion?: string }) => {
    if (!reelId) {
      setActionStatus({ type: "error", message: "Missing reel id." });
      return;
    }

    const defaultMessages: Record<ActionKind, string> = {
      save: "Changes saved",
      export: "Export queued",
      publish: "Publish queued",
      applySuggestion: "Suggestion applied",
      ignoreSuggestion: "Suggestion ignored",
    };

    const normalizedPlatform = (reel?.platform || trendingPlatform || "INSTAGRAM")
      .toString()
      .toUpperCase()
      .replace(/\s+/g, "_");

    setActionStatus({ type: "loading", message: options?.message || defaultMessages[action] || "Working..." });

    try {
      const res = await fetch("/api/reels/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reelId,
          action,
          status: action === "export" ? "RENDERING" : action === "publish" ? "READY" : undefined,
          durationSec: targetDuration,
          style: captionStyle || reel?.style,
          template: thumbStyle || reel?.template,
          platform: normalizedPlatform,
          tone: reel?.tone,
          language: reel?.language,
          settings: {
            ...gatherSettings(),
            lastAction: action,
            suggestion: options?.suggestion,
          },
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to update reel.");
      }

      if (body?.reel) {
        setReel(body.reel);
      } else {
        await loadReel();
      }

      const warning = body?.settingsPersisted === false ? " (metadata not stored; add custom_settings jsonb to reels)" : "";
      const successMessage =
        (body?.message as string | undefined) || options?.message || defaultMessages[action] || "Done";
      setActionStatus({
        type: "success",
        message: `${successMessage}${warning}`,
      });
    } catch (err) {
      setActionStatus({ type: "error", message: (err as Error).message || "Action failed." });
    }
  };

  const handleUploadChange = (sceneIdx: number, file?: File) => {
    setSceneUploads((prev) => ({
      ...prev,
      [sceneIdx]: file ? file.name : null,
    }));
  };

  const triggerUpload = (sceneIdx: number) => {
    const input = document.getElementById(`scene-upload-${sceneIdx}`) as HTMLInputElement | null;
    if (input) {
      input.click();
    }
  };

  const toggleSceneCollapse = (sceneIdx: number) => {
    setCollapsedScenes((prev) => {
      const isCollapsed = prev[sceneIdx] ?? sceneIdx !== activeScene;
      return collapseStateFor(isCollapsed ? sceneIdx : undefined);
    });
    setActiveScene(sceneIdx);
  };

  const focusScene = (sceneIdx: number) => {
    setActiveScene(sceneIdx);
    setCollapsedScenes(collapseStateFor(sceneIdx));
  };

  const handleDragStart = (sceneIdx: number) => {
    setDraggingScene(sceneIdx);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, targetIdx: number) => {
    event.preventDefault();
    if (draggingScene === null || draggingScene === targetIdx) return;
    setSceneOrder((prev) => {
      const current = [...prev];
      const from = current.indexOf(draggingScene);
      const to = current.indexOf(targetIdx);
      if (from === -1 || to === -1) return prev;
      current.splice(from, 1);
      current.splice(to, 0, draggingScene);
      return current;
    });
  };

  const handleDragEnd = () => {
    setDraggingScene(null);
  };

  const applyPlatformOptimizer = (platform: "instagram" | "youtube" | "tiktok") => {
    if (platform === "instagram") {
      setTargetDuration(15);
      setCaptionMode("multi");
      setCaptionSpeed(60);
      setVoiceBalance(55);
    } else if (platform === "youtube") {
      setTargetDuration(30);
      setCaptionSpeed(50);
      setVoiceBalance(50);
    } else {
      setTargetDuration(20);
      setCaptionSpeed(65);
      setVoiceBalance(60);
    }
    setActionStatus({ type: "success", message: `Optimized for ${platform === "instagram" ? "Instagram Reels" : platform === "youtube" ? "YouTube Shorts" : "TikTok"}` });
  };

  const applyQuickMode = (mode: "viral" | "kids" | "repurpose") => {
    if (mode === "viral") {
      setPacing("fast");
      setHookEmphasis(80);
      setCaptionStyle("MrBeast");
      setCaptionSpeed(75);
      setAutoDuck(true);
      setBeatSync(true);
      setMood("happy");
      setActionStatus({ type: "success", message: "Viral mode applied: faster cuts, bold captions, trending pacing." });
    } else if (mode === "kids") {
      setPacing("normal");
      setCaptionStyle("Kids Cartoon");
      setEmojiBoost(true);
      setHighlightColor("#FDE68A");
      setCaptionSpeed(50);
      setMood("calm");
      setActionStatus({ type: "success", message: "Kids-safe mode applied: simple words, friendly visuals, softer pacing." });
    } else {
      setActionStatus({ type: "success", message: "Repurpose: duplicate this reel for another platform." });
    }
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
                <input type="checkbox" checked={autoReorder} onChange={(e) => setAutoReorder(e.target.checked)} className="accent-primary" />
                Auto scene reordering
              </label>
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

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Metadata</p>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold">Platform: </span>
                  <span className="text-gray-700 dark:text-gray-100">{platformLabel || "—"}</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold">Status: </span>
                  <span className="text-gray-700 dark:text-gray-100">{reel?.status || "PENDING"}</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold">Tone: </span>
                  <span className="text-gray-700 dark:text-gray-100">{reel?.tone || "—"}</span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-semibold">Language: </span>
                  <span className="text-gray-700 dark:text-gray-100">{labelForLanguage(reel?.language || "en")}</span>
                </div>
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
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                {["happy", "suspense", "calm"].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(m as "happy" | "suspense" | "calm")}
                    className={cn(
                      "rounded-full px-3 py-1 transition",
                      mood === m
                        ? "bg-primary/10 text-primary dark:bg-white/10 dark:text-white"
                        : "border border-gray-200 text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200",
                    )}
                  >
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
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
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Trending platform
                  <select
                    value={trendingPlatform}
                    onChange={(e) => setTrendingPlatform(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                  >
                    {["Instagram", "YouTube Shorts", "TikTok"].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                  Region
                  <select
                    value={trendingRegion}
                    onChange={(e) => setTrendingRegion(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                  >
                    {["Global", "India", "US", "UK"].map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </select>
                </label>
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
                {sceneOrder.map((idx) => {
                  const isCollapsed = collapsedScenes[idx] ?? idx !== activeScene;
                  return (
                    <div
                      key={idx}
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDragEnd();
                      }}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "rounded-lg border bg-gray-50 p-3 dark:bg-[#0f0f13]",
                        activeScene === idx ? "border-primary" : "border-gray-200 dark:border-white/5",
                        draggingScene === idx ? "opacity-70 ring-2 ring-primary/40" : "",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleSceneCollapse(idx)}
                            className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                            aria-label={isCollapsed ? "Expand scene" : "Collapse scene"}
                          >
                            {isCollapsed ? "▶" : "▼"}
                          </button>
                          <button
                            onClick={() => focusScene(idx)}
                            className="flex items-center gap-2 rounded-md px-2 py-1 text-left text-sm font-semibold text-dark transition hover:text-primary dark:text-white"
                          >
                            <span className="text-base cursor-move" aria-hidden>
                              ☰
                            </span>
                            Scene {idx} ({idx === 1 ? "0–2s" : idx === 2 ? "2–5s" : "5–8s"})
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => focusScene(idx)}
                            className="rounded-md border border-primary/60 px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary"
                          >
                            Replace
                          </button>
                          <button className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200">
                            {idx === 1 ? "Lock" : "Extend"}
                          </button>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <>
                          <div className="mt-3 space-y-3">
                            <div className="space-y-2 text-xs font-semibold text-gray-600 dark:text-gray-300">
                              <input
                                id={`scene-upload-${idx}`}
                                type="file"
                                accept="image/*,video/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  handleUploadChange(idx, file || undefined);
                                  e.target.value = "";
                                }}
                              />
                              {!sceneUploads[idx] ? (
                                <button
                                  type="button"
                                  onClick={() => triggerUpload(idx)}
                                  className="flex w-full flex-col items-start justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-3 text-left transition hover:border-primary hover:text-primary dark:border-white/10 dark:bg-black/40 dark:text-gray-200"
                                >
                                  <span className="text-sm font-semibold">⬆ Upload image / video</span>
                                  <span className="text-[11px] text-gray-500 dark:text-gray-400">JPG, PNG, MP4 • Max 20s</span>
                                </button>
                              ) : (
                                <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-black/50">
                                  <div className="flex items-center justify-between text-xs font-semibold text-gray-700 dark:text-gray-100">
                                    <span>✓ {sceneUploads[idx]}</span>
                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => triggerUpload(idx)}
                                        className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                                      >
                                        Replace
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUploadChange(idx, undefined)}
                                        className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                              <p className="mb-1">Crop / Fit</p>
                              <div className="flex flex-wrap gap-2">
                                {[
                                  { label: "Fit", icon: "▢" },
                                  { label: "Fill", icon: "◼" },
                                  { label: "Crop", icon: "✂" },
                                ].map((opt) => (
                                  <button
                                    key={opt.label}
                                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                                  >
                                    <span className="mr-1">{opt.icon}</span>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="mt-2">
                            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">Zoom</p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {[
                                { label: "None", hint: "Static", value: "None" },
                                { label: "Slow", hint: "Gentle cinematic zoom", value: "Cinematic zoom" },
                                { label: "Dynamic", hint: "Punchy Ken Burns effect", value: "Dynamic" },
                              ].map((opt) => (
                                <div key={opt.label} className="flex flex-col">
                                  <button
                                    onClick={() =>
                                      setSceneStyles((prev) => ({
                                        ...prev,
                                        [idx]: opt.value,
                                      }))
                                    }
                                    className={cn(
                                      "rounded-full border px-3 py-1 text-xs font-semibold transition",
                                      sceneStyles[idx] === opt.value
                                        ? "border-primary text-primary dark:border-white/30 dark:text-white"
                                        : "border-gray-200 text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200",
                                    )}
                                  >
                                    {opt.label}
                                  </button>
                                  <span className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{opt.hint}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-300/40 dark:bg-amber-900/30 dark:text-amber-100">
                            <div className="font-semibold">AI Suggestion:</div>
                            <p>{idx === 1 ? "This scene could be stronger as the hook." : "Consider replacing weak visuals for better retention."}</p>
                            <div className="mt-2 flex gap-2">
                              <button className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white">Apply</button>
                              <button className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200">
                                Ignore
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
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
                {["MrBeast", "Kids Cartoon", "Motivational Bold", "Minimal Clean"].map((style) => (
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
                <input type="checkbox" checked={emojiBoost} onChange={(e) => setEmojiBoost(e.target.checked)} className="accent-primary" />
                Emoji boost (AI)
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
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-gray-600 dark:text-gray-300">Color per word</span>
                <span className="text-gray-500 dark:text-gray-400">AI applies contrast automatically</span>
              </div>
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

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">CTA</p>
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                CTA text
                <input
                  value={ctaText}
                  onChange={(e) => setCtaText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                />
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={autoCtaPlacement}
                  onChange={(e) => setAutoCtaPlacement(e.target.checked)}
                  className="accent-primary"
                />
                Auto-position at last 2s
              </label>
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
                {["Option 1 (happy)", "Option 2 (surprised)", "Option 3 (determined)"].map((opt) => (
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
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" className="accent-primary" defaultChecked />
                Highlight face & emotion
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

            <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-gray-900/60">
              <p className="text-sm font-semibold text-dark dark:text-white">Hook suggestions</p>
              <div className="flex flex-wrap gap-2">
                {["One quick fix", "Stop scrolling", "Do this daily", "Save this"].map((text) => (
                  <button
                    key={text}
                    onClick={() => setThumbHeadline(text.toUpperCase())}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                  >
                    {text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  return (
    
    
    <div className="min-h-screen space-y-8 bg-gray-50 px-4 pb-28 pt-6 text-dark dark:bg-gray-950 dark:text-white md:px-8">

        <div className="sticky top-0 left-0 right-0 z-40 -mx-4 flex flex-col gap-4 border-b border-gray-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur dark:border-white/10 dark:bg-gray-900/95 md:mx-0 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">AI Reel</p>
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-bold text-dark dark:text-white">{reelId ? `Reel ${reelId}` : "Reel"}</h1>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary dark:bg-white/10 dark:text-gray-200">
                    Customize
                  </span>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold uppercase text-primary dark:bg-white/10 dark:text-white">
                    {platformLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              <label className="flex items-center gap-1">
                <span>Versions</span>
                <select className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 outline-none transition hover:border-primary hover:text-primary dark:border-white/10 dark:bg-black dark:text-gray-200">
                  <option>v1 (original)</option>
                  <option>v2</option>
                  <option>v3</option>
                </select>
              </label>
            </div>
            <Link
              href="/ai-reels"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
            >
              Back to AI Reels
            </Link>
            <button
              onClick={() => performAction("export", { message: "Export queued" })}
              disabled={actionStatus.type === "loading"}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-semibold text-white transition",
                actionStatus.type === "loading" ? "bg-primary/60" : "bg-primary hover:bg-primary/90",
              )}
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
                  : actionStatus.type === "loading"
                    ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200"
                    : "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-300",
              )}
            >
              {actionStatus.message}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
            <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-gray-900">
              <div className="text-sm font-semibold text-dark dark:text-white">Reel strategy</div>
              <div className="grid gap-2 md:grid-cols-2">
                <label className="text-sm font-semibold text-gray-700 dark:text-white">
                  Target platform
                  <select
                    onChange={(e) =>
                      applyPlatformOptimizer(
                        e.target.value === "Instagram Reels"
                          ? "instagram"
                          : e.target.value === "YouTube Shorts"
                            ? "youtube"
                            : "tiktok",
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                    defaultValue="Target"
                  >
                    <option disabled value="Target">
                      Target platform
                    </option>
                    <option>YouTube Shorts</option>
                    <option>Instagram Reels</option>
                    <option>TikTok</option>
                  </select>
                </label>

                <label className="text-sm font-semibold text-gray-700 dark:text-white">
                  AI Style
                  <select
                    onChange={(e) =>
                      applyQuickMode(
                        e.target.value === "Viral" ? "viral" : e.target.value === "Kids-safe" ? "kids" : "repurpose",
                      )
                    }
                    className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                    defaultValue="Default"
                  >
                    <option>Default</option>
                    <option>Viral</option>
                    <option>Kids-safe</option>
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => performAction("save", { message: "Version saved" })}
                  disabled={actionStatus.type === "loading"}
                  className={cn(
                    "rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200",
                    actionStatus.type === "loading" && "opacity-70",
                  )}
                >
                  Save version
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-gray-900">
              <div className="flex items-center justify-between text-sm font-semibold text-dark dark:text-white">
                <span>AI Suggestions</span>
              </div>
              <div className="mt-2 space-y-2 text-xs text-gray-600 dark:text-gray-300">
                {[
                  "Shorten hook by 1s to boost retention.",
                  "Increase caption speed slightly.",
                  "Add CTA in final 2s.",
                  "Try trending audio for your region.",
                ].map((tip) => (
                  <div key={tip} className="flex items-start justify-between rounded-lg border border-gray-200 bg-white px-2 py-2 dark:border-white/10 dark:bg-gray-800/60">
                    <span className="mr-2">{tip}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => performAction("applySuggestion", { message: `Applied: ${tip}`, suggestion: tip })}
                        className="rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-white"
                      >
                        Apply
                      </button>
                      <button
                        onClick={() => performAction("ignoreSuggestion", { message: "Ignored suggestion", suggestion: tip })}
                        className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
                      >
                        Ignore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-gray-900">
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3 text-sm font-semibold text-gray-700 dark:border-white/5 dark:text-gray-200">
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
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,1fr)]">
            <div className="space-y-4 lg:pr-2">{renderTabContent(activeTab)}</div>

            <div className="sticky top-4 rounded-xl border border-gray-200 bg-white p-3 shadow-card-2 dark:border-white/10 dark:bg-gray-800">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-700 dark:text-gray-200">Live Preview</span>
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
              onClick={() => performAction("save", { message: "Changes saved" })}
              disabled={actionStatus.type === "loading"}
              className={cn(
                "flex-1 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:border-primary hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10 md:flex-none",
                actionStatus.type === "loading" && "opacity-70",
              )}
            >
              Save changes
            </button>
            <button
              onClick={() => performAction("export", { message: "Next step: export queued" })}
              disabled={actionStatus.type === "loading"}
              className={cn(
                "flex-1 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 md:flex-none",
                actionStatus.type === "loading" && "opacity-70",
              )}
            >
              Next: Export
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
