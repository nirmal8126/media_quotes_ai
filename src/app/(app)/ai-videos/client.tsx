"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { DEFAULT_LANGUAGE, labelForLanguage, languageOptions, resolveLanguageCode } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

type Project = {
  id: string;
  title: string;
  videoType: string;
  language?: string | null;
  status: string;
  createdAt?: string | null;
};

type Scene = {
  id: string;
  projectId: string;
  sceneIndex: number;
  label?: string | null;
  script?: string | null;
  durationMs?: number | null;
};

type Voice = {
  id: string;
  name: string;
  language: string;
  gender?: string | null;
  tone?: string | null;
};

type RenderJob = {
  id: string;
  status: string;
  previewUrl?: string | null;
  outputUrl?: string | null;
  error?: string | null;
};

const contentFormats = [
  { value: "faceless", label: "Faceless Shorts" },
  { value: "fake_text", label: "Fake Text" },
  { value: "split_screen", label: "Split Screen" },
];

const videoSources = [
  { value: "ai_images", label: "AI Generated Images" },
  { value: "gameplay", label: "Gameplay Videos" },
  { value: "viral", label: "Viral Videos" },
];

const shortDurations = [
  { value: 30, label: "30s" },
  { value: 45, label: "45s" },
  { value: 60, label: "60s" },
];

const longDurations = [
  { value: 300, label: "5 min" },
  { value: 600, label: "10 min" },
  { value: 900, label: "15 min" },
];

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export default function AiVideosClientPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [jobsByProject, setJobsByProject] = useState<Record<string, RenderJob[]>>({});
  const [scenesByProject, setScenesByProject] = useState<Record<string, Scene[]>>({});
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; message?: string }>({
    type: "idle",
  });
  const [rendering, setRendering] = useState<string | null>(null);
  const [generatingScenes, setGeneratingScenes] = useState<string | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceId, setVoiceId] = useState<string>("");

  // form state
  const [videoType, setVideoType] = useState<"shorts" | "longform">("shorts");
  const [contentFormat, setContentFormat] = useState("faceless");
  const [title, setTitle] = useState("");
  const [inputMode, setInputMode] = useState<"topic" | "prompt" | "script">("prompt");
  const [topic, setTopic] = useState("");
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  const [languageQuery, setLanguageQuery] = useState(labelForLanguage(DEFAULT_LANGUAGE));
  const [showLanguageList, setShowLanguageList] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(30);
  const [selectedSources, setSelectedSources] = useState<string[]>(["ai_images"]);

  const selectedLanguage = useMemo(
    () => resolveLanguageCode(languageQuery || DEFAULT_LANGUAGE),
    [languageQuery],
  );
  const filteredLanguages = useMemo(() => {
    if (!showLanguageList) return [];
    const term = (languageQuery || "").trim().toLowerCase();
    if (!term || term === "choose a language...") return languageOptions;

    const exactMatch = languageOptions.some(
      (lang) => lang.label.toLowerCase() === term || lang.code.toLowerCase() === term,
    );
    if (exactMatch) return languageOptions;

    return languageOptions.filter(
      (lang) => lang.label.toLowerCase().includes(term) || lang.code.toLowerCase().includes(term),
    );
  }, [languageQuery, showLanguageList]);
  const currentDurations = useMemo(() => (videoType === "shorts" ? shortDurations : longDurations), [videoType]);
  const filteredProjects = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return projects;
    return projects.filter((p) => {
      const text = `${p.title} ${p.videoType} ${p.language} ${p.status}`.toLowerCase();
      return text.includes(term);
    });
  }, [projects, search]);
  const pageCount = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProjects.slice(start, start + pageSize);
  }, [filteredProjects, currentPage, pageSize]);

  function toggleSource(value: string) {
    setSelectedSources((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
  }

  async function loadProjects() {
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/video-projects", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load projects");
      setProjects(Array.isArray(body.projects) ? body.projects : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingProjects(false);
    }
  }

  async function loadJobs(projectId: string) {
    try {
      const res = await fetch(`/api/video-render?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load jobs");
      setJobsByProject((prev) => ({ ...prev, [projectId]: Array.isArray(body.jobs) ? body.jobs : [] }));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadScenes(projectId: string) {
    try {
      const res = await fetch(`/api/video-scenes?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load scenes");
      setScenesByProject((prev) => ({ ...prev, [projectId]: Array.isArray(body.scenes) ? body.scenes : [] }));
    } catch (err) {
      console.error(err);
    }
  }

  async function loadVoices(lang: string) {
    setLoadingVoices(true);
    try {
      const res = await fetch(`/api/video-voices?language=${encodeURIComponent(lang)}`, { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to load voices");
      setVoices(Array.isArray(body.voices) ? body.voices : []);
      setVoiceId((body.voices?.[0]?.id as string) ?? "");
    } catch (err) {
      console.error(err);
      setVoices([]);
      setVoiceId("");
    } finally {
      setLoadingVoices(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    void loadVoices(selectedLanguage);
  }, [selectedLanguage]);

  useEffect(() => {
    projects.forEach((p) => {
      void loadJobs(p.id);
      void loadScenes(p.id);
    });
    const interval = setInterval(() => {
      projects
        .filter((p) => p.status !== "ready")
        .forEach((p) => {
          void loadJobs(p.id);
          void loadScenes(p.id);
        });
    }, 8000);
    return () => clearInterval(interval);
  }, [projects]);

  async function handleCreateAndEdit(event: React.FormEvent) {
    event.preventDefault();
    setStatus({ type: "loading", message: "Creating project..." });
    const payload = {
      title,
      videoType,
      contentFormat,
      inputMode,
      topic: inputMode === "topic" ? topic : null,
      prompt: inputMode === "prompt" ? prompt : null,
      script: inputMode === "script" ? script : null,
      language: selectedLanguage,
      durationSeconds,
      narratorVoiceId: voiceId || null,
      settings: { sources: selectedSources },
    };

    try {
      const res = await fetch("/api/video-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to create project");
      const projectId = body.project?.id as string;
      if (projectId) {
        await fetch("/api/video-scenes/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
        }).catch(() => {});
        setShowModal(false);
        router.push(`/ai-videos/${projectId}`);
      }
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Failed to create project" });
    } finally {
      setStatus((prev) => (prev.type === "loading" ? { type: "idle" } : prev));
    }
  }

  async function handleGenerateScenes(projectId: string) {
    setGeneratingScenes(projectId);
    try {
      await fetch("/api/video-scenes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      await loadScenes(projectId);
      setStatus({ type: "success", message: "Scenes refreshed" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setGeneratingScenes(null);
    }
  }

  async function handleRender(projectId: string) {
    setRendering(projectId);
    try {
      await fetch("/api/video-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      await loadJobs(projectId);
      setStatus({ type: "success", message: "Render started" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message });
    } finally {
      setRendering(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-card-2 dark:border-dark-3 dark:bg-dark-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">AI Videos</p>
          <h1 className="text-2xl font-bold text-dark dark:text-white">Generated AI Videos</h1>
          <p className="text-sm text-gray-6 dark:text-dark-6">View generated videos and create new ones.</p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            setStatus({ type: "idle" });
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          + Generate AI Video
        </button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-card-2 dark:border-dark-3 dark:bg-dark-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-gray-6 dark:text-dark-6">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
            >
              {[5, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span>entries</span>
          </div>
          <div className="relative flex items-center">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search videos (script, id, status)"
              className="h-10 w-56 rounded-lg border border-gray-200 bg-white px-3 pl-9 text-sm text-dark outline-none transition focus:border-primary dark:border-dark-3 dark:bg-dark-2 dark:text-dark-8"
              aria-label="Search videos"
            />
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-4">🔍</span>
          </div>
        </div>

        {loadingProjects ? (
          <p className="text-sm text-gray-6 dark:text-dark-6">Loading...</p>
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
                <thead className="bg-gray-50 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                  <tr>
                    <th className="px-4 py-3">Script / ID</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-3">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-6 dark:text-dark-6">
                        No projects yet.
                      </td>
                    </tr>
                  ) : pagedProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-10 text-center text-gray-6 dark:text-dark-6">
                        No results match your search.
                      </td>
                    </tr>
                  ) : (
                    pagedProjects.map((p) => {
                      const scenes = scenesByProject[p.id] ?? [];
                      const firstScript = scenes[0]?.script?.trim();
                      const preview = firstScript
                        ? `${firstScript.slice(0, 140)}${firstScript.length > 140 ? "..." : ""}`
                        : p.title || "—";
                      const job = jobsByProject[p.id]?.[0];

                      return (
                        <tr key={p.id} className="align-top hover:bg-gray-50/60 dark:hover:bg-dark-3/70">
                          <td className="px-4 py-3 text-sm text-gray-7 dark:text-dark-7">
                            <div className="line-clamp-2 font-medium text-dark dark:text-dark-8">{preview}</div>
                            <div className="text-xs text-gray-6 dark:text-dark-6">ID: {p.id}</div>
                            <div className="text-[11px] text-gray-5 dark:text-dark-6">
                              {(p.videoType === "shorts" ? "SHORTS" : "LONGFORM") +
                                " • " +
                                (labelForLanguage(p.language) || p.language || DEFAULT_LANGUAGE)}
                            </div>
                            {job?.id ? (
                              <div className="text-[11px] text-gray-5 dark:text-dark-6">Job: {job.id}</div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-center align-top">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                                p.status === "ready"
                                  ? "bg-green-100 text-green-700"
                                  : p.status === "rendering"
                                    ? "bg-amber-100 text-amber-700"
                                    : p.status === "failed"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-2 text-gray-7 dark:bg-dark-3 dark:text-dark-7",
                              )}
                            >
                              {p.status?.toUpperCase() || "UNKNOWN"}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-sm text-gray-7 dark:text-dark-7">
                            {formatDate(p.createdAt)}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <div className="flex flex-wrap justify-end gap-2">
                              <Link
                                href={`/ai-videos/${p.id}`}
                                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-50 dark:border-dark-3 dark:text-dark-7 dark:hover:bg-dark-2"
                              >
                                Detail
                              </Link>
                              <button
                                type="button"
                                onClick={() => {
                                  void loadJobs(p.id);
                                  void loadScenes(p.id);
                                }}
                                className="rounded-md border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-50 dark:border-dark-3 dark:text-dark-7 dark:hover:bg-dark-2"
                              >
                                Refresh
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleRender(p.id)}
                                disabled={rendering === p.id}
                                className="rounded-md bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                              >
                                {rendering === p.id ? "Rendering..." : "Render"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-6 dark:text-dark-6">
              <div>
                Showing{" "}
                {filteredProjects.length === 0
                  ? 0
                  : (currentPage - 1) * pageSize + 1}{" "}
                to{" "}
                {filteredProjects.length === 0
                  ? 0
                  : Math.min(currentPage * pageSize, filteredProjects.length)}{" "}
                of {filteredProjects.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-7 transition hover:bg-gray-50 disabled:opacity-60 dark:border-dark-3 dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-5 dark:text-dark-6">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  className="rounded-md border border-gray-200 px-3 py-1 text-sm font-semibold text-gray-7 transition hover:bg-gray-50 disabled:opacity-60 dark:border-dark-3 dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage >= pageCount}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-black/80 px-4 py-10 backdrop-blur-sm md:px-8">
            <div
              role="dialog"
              aria-modal="true"
              className="relative z-[10000] w-full max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white text-dark shadow-2xl dark:border-[#2f3542] dark:bg-[#1f252f] dark:text-white"
            >
              <button
                onClick={() => setShowModal(false)}
                className="absolute right-4 top-4 rounded-full px-3 py-1 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-primary dark:text-gray-4 dark:hover:bg-white/5 dark:hover:text-white"
              >
                Close
              </button>

              <div className="px-8 pt-6 pb-2">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">Generate</p>
                <h2 className="text-xl font-semibold">New AI video</h2>
                <p className="text-sm text-gray-600 dark:text-gray-300">Fill details to generate script & scenes.</p>
              </div>

              <form
                onSubmit={handleCreateAndEdit}
                className="flex-1 space-y-5 overflow-y-auto px-8 pb-8"
                style={{ maxHeight: "80vh" }}
              >
                <div className="space-y-2">
                  <label className="text-sm font-semibold">Project Title</label>
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Project Regular Gazelle"
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-dark outline-none focus:border-primary dark:border-[#3a4352] dark:bg-[#2a303c] dark:text-white"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold">Generation Input</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: "prompt", label: "Prompt" },
                      { value: "script", label: "Script" },
                    ].map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setInputMode(tab.value as typeof inputMode)}
                        className={cn(
                          "rounded-lg border px-4 py-3 text-sm font-semibold transition",
                          inputMode === tab.value
                            ? "border-primary bg-primary/10 text-primary dark:border-primary dark:bg-[#323a47] dark:text-white"
                            : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-[#3a4352] dark:text-gray-300",
                        )}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  {inputMode === "prompt" ? (
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      rows={4}
                      placeholder="Enter your prompt here..."
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-dark outline-none focus:border-primary dark:border-[#3a4352] dark:bg-[#2a303c] dark:text-white"
                    />
                  ) : (
                    <textarea
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      rows={5}
                      placeholder="Paste your full script..."
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-dark outline-none focus:border-primary dark:border-[#3a4352] dark:bg-[#2a303c] dark:text-white"
                    />
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Narrator voice</p>
                    <p className="text-xs text-gray-5">Narration</p>
                  </div>
                  <div className="space-y-2 rounded-lg border border-gray-300 bg-white p-2 dark:border-[#3a4352] dark:bg-[#2a303c]">
                    {loadingVoices && <p className="px-2 py-3 text-xs text-gray-500 dark:text-gray-5">Loading voices...</p>}
                    {!loadingVoices && voices.length === 0 && (
                      <p className="px-2 py-3 text-xs text-gray-500 dark:text-gray-5">
                        No voices for {labelForLanguage(selectedLanguage) || selectedLanguage}
                      </p>
                    )}
                    {voices.map((v) => (
                      <label
                        key={v.id}
                        className={cn(
                          "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 transition",
                          voiceId === v.id
                            ? "border-primary bg-primary/5 text-dark dark:border-primary dark:bg-[#323a47] dark:text-white"
                            : "border-transparent text-gray-800 hover:border-gray-300 dark:text-gray-100 dark:hover:border-[#3a4352]",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-white">▶</span>
                          <div className="flex flex-wrap items-center gap-2 text-sm">
                            <span className="font-semibold text-dark dark:text-white">{v.name}</span>
                            {v.gender ? (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-3">
                                {v.gender}
                              </span>
                            ) : null}
                            {v.tone ? (
                              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-3">
                                {v.tone}
                              </span>
                            ) : null}
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-3">
                              ~{Math.round(150)} WPM
                            </span>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="voice"
                          value={v.id}
                          checked={voiceId === v.id}
                          onChange={() => setVoiceId(v.id)}
                          className="h-4 w-4"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-semibold">Duration</label>
                  <select
                    value={durationSeconds}
                    onChange={(e) => setDurationSeconds(Number(e.target.value))}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-dark outline-none focus:border-primary dark:border-[#3a4352] dark:bg-[#2a303c] dark:text-white"
                  >
                    {currentDurations.map((dur) => (
                      <option key={dur.value} value={dur.value} className="text-dark dark:text-white">
                        {dur.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 dark:text-gray-400">25 credits will be deducted for this video.</p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Language</p>
                    <div className="relative">
                      <input
                        value={languageQuery}
                        onChange={(e) => {
                          setLanguageQuery(e.target.value);
                          setShowLanguageList(true);
                        }}
                        onFocus={() => setShowLanguageList(true)}
                        onClick={() => setShowLanguageList(true)}
                        onBlur={() => setTimeout(() => setShowLanguageList(false), 120)}
                        placeholder="Choose a language..."
                        autoComplete="off"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 pr-10 py-3 text-sm text-dark outline-none focus:border-primary dark:border-[#3a4352] dark:bg-[#2a303c] dark:text-white"
                      />
                      <button
                        type="button"
                        aria-label="Show languages"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowLanguageList((prev) => !prev);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 dark:text-gray-5 dark:hover:bg-white/5"
                      >
                        ▼
                      </button>
                      {showLanguageList && (
                        <div className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-xl dark:border-[#3a4352] dark:bg-[#1f252f]">
                          {!filteredLanguages.length && (
                            <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-5">No matches</div>
                          )}
                          {filteredLanguages.map((lang) => (
                            <button
                              key={lang.code}
                              type="button"
                              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-dark hover:bg-gray-50 dark:text-white dark:hover:bg-white/5"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                setLanguageQuery(lang.label);
                                setShowLanguageList(false);
                              }}
                            >
                              <span>{lang.label}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-5">{lang.code.toUpperCase()}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">Content format</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "shorts", label: "Shorts / Reels" },
                        { value: "longform", label: "Long-form" },
                      ].map((item) => (
                        <button
                          type="button"
                          key={item.value}
                          onClick={() => {
                            setVideoType(item.value as "shorts" | "longform");
                            setDurationSeconds(item.value === "shorts" ? 30 : 300);
                          }}
                          className={cn(
                            "rounded-lg border px-3 py-3 text-sm font-semibold transition",
                            videoType === item.value
                              ? "border-primary bg-primary/10 text-primary dark:border-primary dark:bg-[#323a47] dark:text-white"
                              : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-[#3a4352] dark:text-gray-300",
                          )}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 transition hover:border-primary hover:text-primary dark:border-dark-4 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={status.type === "loading"}
                    className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                  >
                    {status.type === "loading" ? "Working..." : "Generate a video"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
