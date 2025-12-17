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

  const sortedScenes = useMemo(
    () => [...scenes].sort((a, b) => a.sceneIndex - b.sceneIndex),
    [scenes],
  );

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
    <div className="space-y-8 bg-gray-900 p-4 text-white">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">AI Videos</p>
          <h1 className="text-2xl font-bold text-white">{project.title}</h1>
          <p className="text-sm text-gray-300">
            {project.videoType === "shorts" ? "Shorts/Reel" : "Long-form"} ·{" "}
            {labelForLanguage(project.language) || project.language || "en"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/ai-videos"
            className="rounded-lg border border-gray-700 px-3 py-2 text-sm font-semibold text-gray-200 transition hover:border-primary hover:text-primary"
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
          className={`text-sm ${
            status.type === "error"
              ? "text-red-500"
              : status.type === "success"
                ? "text-green-600"
                : "text-gray-6"
          }`}
        >
          {status.message}
        </p>
      )}

      <div className="space-y-4 rounded-2xl border border-gray-800 bg-gray-800 p-4 shadow-card-2">
        <div className="flex flex-wrap gap-2 border-b border-gray-700 pb-3 text-sm font-semibold text-gray-300">
          {(["settings", "music", "media", "captions"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-full px-3 py-1",
                activeTab === tab
                  ? "bg-primary/10 text-primary"
                  : "border border-transparent hover:border-primary/30",
              )}
            >
              {tab === "settings" ? "Settings" : tab === "music" ? "Music" : tab === "media" ? "Media" : "Captions"}
            </button>
          ))}
        </div>

        {activeTab === "settings" && (
          <div className="space-y-2 text-sm text-gray-200">
            <p>Project ID: {project.id}</p>
            <p>Status: {project.status}</p>
            <p>Language: {labelForLanguage(project.language) || project.language || "en"}</p>
            <p>Use this tab to adjust future global settings (templates, aspect ratios, colors).</p>
          </div>
        )}

        {activeTab === "music" && (
          <div className="space-y-2 text-sm text-gray-200">
            <p>Music selection coming soon. Attach audio via media or add a track here.</p>
          </div>
        )}

        {activeTab === "captions" && (
          <div className="space-y-2 text-sm text-gray-200">
            <p>Captions are generated during render; edit per-scene text in Media.</p>
          </div>
        )}

        {activeTab === "media" && (
          <div className="space-y-4">
            {sortedScenes.map((scene) => (
              <div
                key={scene.id}
                className="rounded-2xl border border-gray-700 bg-gray-850 p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-400">Section {scene.sceneIndex + 1}</span>
                    <input
                      value={scene.label || ""}
                      onChange={(e) =>
                        setScenes((prev) =>
                          prev.map((s) => (s.id === scene.id ? { ...s, label: e.target.value } : s)),
                        )
                      }
                      placeholder="Section title"
                      className="rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={5}
                      value={scene.durationMs ? Math.round(scene.durationMs / 1000) : ""}
                      onChange={(e) =>
                        setScenes((prev) =>
                          prev.map((s) =>
                            s.id === scene.id ? { ...s, durationMs: Number(e.target.value) * 1000 } : s,
                          ),
                        )
                      }
                      placeholder="sec"
                      className="w-20 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setActiveScene(scene);
                        setSectionModalOpen(true);
                      }}
                      className="rounded-md border border-primary/40 px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary"
                    >
                      Edit using AI
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveScene(scene)}
                      disabled={saving[scene.id]}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      {saving[scene.id] ? "Saving..." : "Save"}
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <textarea
                    value={scene.script || ""}
                    onChange={(e) =>
                      setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, script: e.target.value } : s)))
                    }
                    rows={4}
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                  />
                  <input
                    value={scene.prompt || ""}
                    onChange={(e) =>
                      setScenes((prev) => prev.map((s) => (s.id === scene.id ? { ...s, prompt: e.target.value } : s)))
                    }
                    placeholder="Visual prompt / suggestion"
                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-primary"
                  />
                  <div className="rounded-lg border border-dashed border-gray-200 p-3 text-xs text-gray-6 dark:border-dark-3 dark:text-dark-5">
                    <p className="font-semibold text-dark dark:text-white">Media</p>
                    {mediaLoading && <p className="text-xs text-gray-5">Loading media...</p>}
                    {mediaByScene[scene.id]?.length ? (
                      <ul className="mt-2 space-y-1">
                        {mediaByScene[scene.id].map((m) => (
                          <li
                            key={m.id}
                            className="flex items-center justify-between gap-2 rounded-md bg-gray-800 px-2 py-1 shadow-sm"
                          >
                            <span className="text-[11px] text-gray-300">
                              {m.mediaType} · {m.source || "upload"}
                            </span>
                            <a href={m.url} className="text-primary underline" target="_blank" rel="noreferrer">
                              Open
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[11px] text-gray-400">No media yet.</p>
                    )}
                    <div className="mt-2 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <input
                          placeholder="https://example.com/media.mp4"
                          onBlur={(e) => {
                            const url = e.target.value;
                            if (url.trim()) {
                              void saveMedia(scene, url.trim(), "video");
                              e.target.value = "";
                            }
                          }}
                          className="w-full rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white"
                        />
                        <span className="text-[11px] text-gray-400">Paste URL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              void handleFileUpload(scene, file);
                              e.target.value = "";
                            }
                          }}
                          className="w-full rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-white file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-primary"
                        />
                        {uploadingScene === scene.id && <span className="text-[11px] text-gray-5">Uploading...</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
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
