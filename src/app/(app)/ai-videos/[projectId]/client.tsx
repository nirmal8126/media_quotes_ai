"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { labelForLanguage } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

type Scene = {
  id: string;
  projectId: string;
  sceneIndex: number;
  label?: string | null;
  script?: string | null;
  prompt?: string | null;
  durationMs?: number | null;
};

type Project = {
  id: string;
  title: string;
  videoType: string;
  status: string;
  language?: string | null;
};

type SceneMedia = {
  id: string;
  projectId: string;
  sceneId?: string | null;
  mediaType: string;
  source?: string | null;
  url: string;
};

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

export default function AiVideoEditorClient() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [regen, setRegen] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<{ type: "idle" | "success" | "error"; message?: string }>({ type: "idle" });
  const [mediaByScene, setMediaByScene] = useState<Record<string, SceneMedia[]>>({});
  const [mediaLoading, setMediaLoading] = useState(false);
  const [uploadingScene, setUploadingScene] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"settings" | "music" | "media" | "captions">("media");
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [sectionPrompt, setSectionPrompt] = useState("");
  const [activeScene, setActiveScene] = useState<Scene | null>(null);
  const [rendering, setRendering] = useState(false);
  const [savingAll, setSavingAll] = useState(false);

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex),
    [scenes],
  );
  const expectedDuration = useMemo(() => {
    const totalMs = sortedScenes.reduce((acc, s) => acc + (s.durationMs || 0), 0);
    if (totalMs > 0) return totalMs / 1000;
    const words = sortedScenes.reduce((acc, s) => acc + (s.script?.split(/\s+/).length || 0), 0);
    const seconds = words / 2.5; // ~150 wpm
    return Math.round(seconds);
  }, [sortedScenes]);

  async function loadProject() {
    setLoading(true);
    try {
      const res = await fetch("/api/video-projects", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load project");
      const found = (body.projects || []).find((p: Project) => p.id === projectId);
      if (!found) {
        setStatus({ type: "error", message: "Project not found" });
        return;
      }
      setProject(found);
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function loadScenes() {
    try {
      const res = await fetch(`/api/video-scenes?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load scenes");
      setScenes(Array.isArray(body.scenes) ? body.scenes : []);
      const sceneIds = (body.scenes || []).map((s: Scene) => s.id);
      await loadMedia(sceneIds);
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    }
  }

  useEffect(() => {
    void loadProject();
    void loadScenes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function saveScene(scene: Scene) {
    setSaving((prev) => ({ ...prev, [scene.id]: true }));
    try {
      const res = await fetch("/api/video-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sceneIndex: scene.sceneIndex,
          label: scene.label,
          script: scene.script,
          prompt: scene.prompt,
          durationMs: scene.durationMs,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to save scene");
      setStatus({ type: "success", message: "Scene saved" });
      await loadScenes();
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setSaving((prev) => ({ ...prev, [scene.id]: false }));
    }
  }

  async function loadMedia(sceneIds: string[]) {
    setMediaLoading(true);
    try {
      const res = await fetch(`/api/video-media?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load media");
      const grouped: Record<string, SceneMedia[]> = {};
      (body.media || []).forEach((m: SceneMedia) => {
        const key = m.sceneId || "global";
        grouped[key] = grouped[key] ? [...grouped[key], m] : [m];
      });
      setMediaByScene(grouped);
    } catch (err) {
      console.error(err);
    } finally {
      setMediaLoading(false);
    }
  }

  async function saveMedia(scene: Scene, url: string, mediaType: string) {
    if (!url.trim()) return;
    setSaving((prev) => ({ ...prev, [`media-${scene.id}`]: true }));
    try {
      const res = await fetch("/api/video-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sceneId: scene.id,
          mediaType,
          url,
          source: "upload",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to save media");
      await loadMedia([scene.id]);
      setStatus({ type: "success", message: "Media added" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setSaving((prev) => ({ ...prev, [`media-${scene.id}`]: false }));
    }
  }

  async function getUploadUrl(filename: string, projectId: string) {
    const res = await fetch("/api/video-media/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename, projectId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || "Unable to get upload URL");
    }
    return body as { uploadUrl: string; path: string; publicUrl?: string | null };
  }

  async function handleFileUpload(scene: Scene, file: File) {
    setUploadingScene(scene.id);
    try {
      const { uploadUrl, publicUrl, path } = await getUploadUrl(file.name, projectId);
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!putRes.ok) {
        const text = await putRes.text().catch(() => putRes.statusText);
        throw new Error(`Upload failed: ${text}`);
      }
      const mediaUrl = publicUrl || path;
      await saveMedia(scene, mediaUrl, file.type.startsWith("audio/") ? "audio" : file.type.startsWith("image/") ? "image" : "video");
      setStatus({ type: "success", message: "Uploaded media" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setUploadingScene(null);
    }
  }

  async function regenerateScene(scene: Scene) {
    setRegen((prev) => ({ ...prev, [scene.id]: true }));
    try {
      const res = await fetch("/api/video-scenes/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sceneIndex: scene.sceneIndex,
          script: scene.script,
          prompt: sectionPrompt || scene.script,
          language: project?.language ?? "en",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to regenerate scene");
      setStatus({ type: "success", message: "Scene regenerated" });
      await loadScenes();
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setRegen((prev) => ({ ...prev, [scene.id]: false }));
      setSectionModalOpen(false);
      setActiveScene(null);
      setSectionPrompt("");
    }
  }

  async function saveAllScenes() {
    setSavingAll(true);
    for (const scene of sortedScenes) {
      await saveScene(scene);
    }
    setSavingAll(false);
  }

  async function handleRender(projectId: string) {
    setRendering(true);
    try {
      await fetch("/api/video-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      setStatus({ type: "success", message: "Generating video! It will take a few minutes..." });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setRendering(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-6 dark:text-dark-6">Loading...</div>;
  }

  if (!project) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-500">{status.message || "Project not found"}</p>
        <Link href="/ai-videos" className="text-primary underline">Back</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-8 bg-gray-50 px-4 pb-10 pt-6 text-dark dark:bg-gray-950 dark:text-white md:px-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Faceless Video</p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-dark dark:text-white">{project.title}</h1>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary dark:bg-white/10 dark:text-gray-200">
              Beta
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {project.videoType === "shorts" ? "Shorts/Reel" : "Long-form"} •{" "}
            {labelForLanguage(project.language) || project.language || "en"}
          </p>
        </div>
          <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 dark:bg-white/5 dark:text-gray-300">
            Expected duration: {expectedDuration ? `${(expectedDuration / 60).toFixed(2)} mins` : "—"}
          </span>
          <Link
            href="/ai-videos"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
          >
            Back to AI Videos
          </Link>
          <button
            onClick={() => void handleRender(project.id)}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
          >
            Generate video
          </button>
        </div>
      </div>

      {status.message && (
        <p
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            status.type === "error"
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
              : status.type === "success"
                ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                : "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
          )}
        >
          {status.message}
        </p>
      )}

      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-white/10 dark:bg-gray-900">
        <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-3 text-sm font-semibold text-gray-700 dark:border-white/5 dark:text-gray-200">
          {(["settings", "music", "media", "captions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-3 py-1 transition",
                activeTab === tab
                  ? "bg-primary/10 text-primary dark:bg-white/10 dark:text-white"
                  : "border border-transparent text-gray-600 hover:border-gray-200 hover:text-dark dark:text-gray-400 dark:hover:border-white/10",
              )}
            >
              {tab === "settings" ? "Settings" : tab === "music" ? "Music" : tab === "media" ? "Media" : "Captions"}
            </button>
          ))}
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(420px,1fr)]">
          <div className="space-y-4">
            {activeTab === "settings" && (
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
                <p className="text-sm font-semibold text-dark dark:text-white">Video settings</p>
                {[
                  { label: "Caption Position", min: 0, max: 100, defaultValue: 50 },
                  { label: "Letter Spacing", min: 0, max: 50, defaultValue: 10 },
                  { label: "Stroke Width", min: 0, max: 12, defaultValue: 3 },
                  { label: "Font Size", min: 10, max: 72, defaultValue: 32 },
                ].map((slider) => (
                  <div key={slider.label} className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <span>{slider.label}</span>
                      <span>{slider.defaultValue}</span>
                    </div>
                    <input
                      type="range"
                      min={slider.min}
                      max={slider.max}
                      defaultValue={slider.defaultValue}
                      className="w-full accent-primary"
                    />
                  </div>
                ))}
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>Highlight mode</span>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="highlight" defaultChecked className="accent-primary" /> Font
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="highlight" className="accent-primary" /> Background
                  </label>
                </div>
              </div>
            )}

            {activeTab === "music" && (
              <div className="space-y-3 text-sm text-gray-700 dark:text-gray-200">
                <p className="text-sm font-semibold text-dark dark:text-white">Background Music</p>
                <div className="flex items-center gap-2">
                  <input
                    placeholder="Search tracks (e.g. tech, chill, cinematic)"
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-dark outline-none focus:border-primary dark:border-white/10 dark:bg-black dark:text-white"
                  />
                  <button className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white">Search</button>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-white/10 dark:bg-black/40 dark:text-gray-400">
                  <p>Preview and choose a track. Auto ducking and trim to video length will be applied.</p>
                </div>
              </div>
            )}

            {activeTab === "captions" && (
              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-200">
                <p className="text-sm font-semibold text-dark dark:text-white">Captions</p>
                <p>Captions are generated from narration. Per-word timing appears in the timeline.</p>
              </div>
            )}

            {activeTab === "media" && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-dark dark:text-white">Edit Media</p>
                <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-2 dark:border-white/10 dark:bg-black/60">
                  {sortedScenes.map((scene) => (
                    <div
                      key={scene.id}
                      className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 dark:border-white/5 dark:bg-[#0f0f13]"
                    >
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-700 line-clamp-2 dark:text-gray-100">
                          {scene.prompt || scene.script || scene.label || `Section ${scene.sceneIndex + 1}`}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-500">
                          {scene.durationMs ? `${(scene.durationMs / 1000).toFixed(2)}s` : "00:00:05 - 00:00:10"}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveScene(scene);
                          setSectionModalOpen(true);
                        }}
                        className="rounded-md border border-primary/60 px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary"
                      >
                        Change
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-800">
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Preview only — final video will be higher quality.</span>
              <span>Any flickering won’t appear in exported video.</span>
            </div>
            <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg bg-gradient-to-br from-gray-200 to-gray-100 dark:from-gray-900 dark:to-gray-950">
              <div className="flex h-full items-center justify-center text-gray-500 dark:text-gray-300">Preview placeholder</div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-2">
              <button className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/15 dark:text-gray-100 dark:hover:border-white/30">
                Export
              </button>
              <button className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/15 dark:text-gray-100 dark:hover:border-white/30">
                Exports
              </button>
              <button className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-white/15 dark:text-gray-100 dark:hover:border-white/30">
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-3 dark:border-white/10 dark:bg-gray-800/80">
          <p className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-300">Timeline</p>
          <div className="mt-2 h-24 w-full rounded-md bg-gradient-to-r from-gray-200 to-gray-100 dark:from-gray-900 dark:to-gray-950">
            <div className="flex h-full items-center justify-center text-xs text-gray-500 dark:text-gray-300">
              Per-word caption timeline placeholder
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <div className="rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-700 dark:border-white/10 dark:bg-gray-900 dark:text-gray-200">
            Generating video! It will take a few minutes...
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={() => void saveAllScenes()}
              disabled={savingAll}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:border-primary hover:text-primary disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              {savingAll ? "Saving..." : "Save Script"}
            </button>
            <button
              type="button"
              onClick={async () => {
                await saveAllScenes();
                await handleRender(project.id);
              }}
              disabled={rendering}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {rendering ? "Generating..." : "Next"}
            </button>
          </div>
        </div>
      </div>
      {sectionModalOpen && activeScene && (
        <ModalPortal>
          <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-gray-700 bg-gray-850 p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Generate Section Content</h3>
                <button
                  onClick={() => {
                    setSectionModalOpen(false);
                    setSectionPrompt("");
                    setActiveScene(null);
                  }}
                  className="text-sm text-gray-400 hover:text-primary"
                >
                  Close
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-400">
                Make changes to your section here. Click Generate when you&apos;re done.
              </p>
              <div className="mt-4 space-y-2">
                <label className="text-xs font-semibold text-gray-300">Prompt</label>
                <textarea
                  value={sectionPrompt}
                  onChange={(e) => setSectionPrompt(e.target.value)}
                  placeholder="Enter a prompt to generate or modify the section content."
                  rows={4}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                />
              </div>
              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSectionModalOpen(false);
                    setSectionPrompt("");
                    setActiveScene(null);
                  }}
                  className="rounded-lg border border-gray-600 px-4 py-2 text-sm font-semibold text-gray-200 hover:border-primary hover:text-primary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => activeScene && regenerateScene(activeScene)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90"
                >
                  Generate Section
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
