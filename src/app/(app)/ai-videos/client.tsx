"use client";

import { useEffect, useMemo, useState } from "react";
import { labelForLanguage, languageOptions, resolveLanguageCode } from "@/lib/languages";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Project = {
  id: string;
  title: string;
  videoType: string;
  contentFormat?: string | null;
  inputMode?: string | null;
  language?: string | null;
  durationSeconds?: number | null;
  status: string;
  createdAt?: string | null;
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
  createdAt?: string | null;
  error?: string | null;
};

type Scene = {
  id: string;
  projectId: string;
  sceneIndex: number;
  label?: string | null;
  script?: string | null;
  durationMs?: number | null;
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

export default function AiVideosClientPage() {
  const [videoType, setVideoType] = useState<"shorts" | "longform">("shorts");
  const [contentFormat, setContentFormat] = useState<string>("faceless");
  const [title, setTitle] = useState("");
  const [inputMode, setInputMode] = useState<"topic" | "prompt" | "script">("topic");
  const [topic, setTopic] = useState("");
  const [prompt, setPrompt] = useState("");
  const [script, setScript] = useState("");
  const [languageQuery, setLanguageQuery] = useState(labelForLanguage("en"));
  const [durationSeconds, setDurationSeconds] = useState<number>(30);
  const [selectedSources, setSelectedSources] = useState<string[]>(["ai_images"]);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState<string>("");
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [status, setStatus] = useState<{ type: "idle" | "loading" | "error" | "success"; message?: string }>({
    type: "idle",
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [jobsByProject, setJobsByProject] = useState<Record<string, RenderJob[]>>({});
  const [rendering, setRendering] = useState<string | null>(null);
  const [scenesByProject, setScenesByProject] = useState<Record<string, Scene[]>>({});
  const [generatingScenes, setGeneratingScenes] = useState<string | null>(null);
  const [polling, setPolling] = useState<NodeJS.Timeout | null>(null);

  const currentDurations = useMemo(() => (videoType === "shorts" ? shortDurations : longDurations), [videoType]);

  const selectedLanguage = useMemo(() => resolveLanguageCode(languageQuery || "en"), [languageQuery]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects]);

  useEffect(() => {
    if (polling) {
      clearInterval(polling);
    }
    const interval = setInterval(() => {
      projects
        .filter((p) => p.status !== "ready")
        .forEach((p) => {
          void loadJobs(p.id);
          void loadScenes(p.id);
        });
    }, 8000);
    setPolling(interval);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  async function handleSubmit(event: React.FormEvent) {
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
      setStatus({ type: "success", message: "Project created. Proceed to script & scene generation." });
      setTitle("");
      setTopic("");
      setPrompt("");
      setScript("");
      setSelectedSources(["ai_images"]);
      await loadProjects();
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Failed to create project" });
    }
  }

  async function handleRender(projectId: string) {
    setRendering(projectId);
    try {
      const res = await fetch("/api/video-render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to create render job");
      await loadJobs(projectId);
      setStatus({ type: "success", message: "Render job queued" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Failed to start render" });
    } finally {
      setRendering(null);
    }
  }

  async function handleGenerateScenes(projectId: string) {
    setGeneratingScenes(projectId);
    try {
      const res = await fetch("/api/video-scenes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to generate scenes");
      await loadScenes(projectId);
      setStatus({ type: "success", message: "Script and scenes generated" });
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Failed to generate scenes" });
    } finally {
      setGeneratingScenes(null);
    }
  }

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">AI Videos</p>
        <h1 className="text-3xl font-bold text-dark dark:text-white">Multi-step AI video creator</h1>
        <p className="max-w-3xl text-sm text-gray-6 dark:text-dark-6">
          Guided wizard for Shorts and long-form videos with language-aware scripts, narrator voices, visual sourcing,
          and per-scene customization. This page creates the project draft; next screens will handle script, scenes, and
          rendering.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card-2 dark:border-dark-3 dark:bg-dark-2 lg:col-span-2 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-dark dark:text-white">Video type</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
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
                    className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                      videoType === item.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 text-gray-700 dark:border-dark-3 dark:text-dark-5"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-dark dark:text-white">Content format</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {contentFormats.map((fmt) => (
                  <button
                    type="button"
                    key={fmt.value}
                    onClick={() => setContentFormat(fmt.value)}
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                      contentFormat === fmt.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 text-gray-700 dark:border-dark-3 dark:text-dark-5"
                    }`}
                  >
                    {fmt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark dark:text-white">Project title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Project Regular Gazelle"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-dark dark:text-white">Language</label>
              <input
                value={languageQuery}
                onChange={(e) => setLanguageQuery(e.target.value)}
                list="video-language-options"
                placeholder="English"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
              />
              <datalist id="video-language-options">
                {languageOptions.map((lang) => (
                  <option key={lang.code} value={lang.label} />
                ))}
              </datalist>
              <p className="text-xs text-gray-5 dark:text-dark-5">Voices and script generation follow this language.</p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-dark dark:text-white">Content input</label>
            <div className="flex flex-wrap gap-2">
              {[
                { value: "topic", label: "Popular Topic" },
                { value: "prompt", label: "Prompt" },
                { value: "script", label: "Script" },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setInputMode(tab.value as typeof inputMode)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    inputMode === tab.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 text-gray-7 dark:border-dark-3 dark:text-dark-5"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {inputMode === "topic" && (
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
              >
                <option value="">Choose a topic</option>
                {[
                  "Motivational Story",
                  "Scary Story",
                  "Interesting Facts",
                  "Historical Events",
                  "Science Discoveries",
                  "Technology Trends",
                  "Health Tips",
                  "Travel Destinations",
                  "Cooking Recipes",
                  "Art & Culture",
                  "Sports Highlights",
                ].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            )}

            {inputMode === "prompt" && (
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="top 5 biggest airplanes"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
              />
            )}

            {inputMode === "script" && (
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={5}
                placeholder="Paste your full script..."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-dark-3 dark:bg-dark-2"
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium text-dark dark:text-white">Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {currentDurations.map((dur) => (
                  <button
                    key={dur.value}
                    type="button"
                    onClick={() => setDurationSeconds(dur.value)}
                    className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${
                      durationSeconds === dur.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-gray-200 text-gray-700 dark:border-dark-3 dark:text-dark-5"
                    }`}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-dark dark:text-white">Narrator voice</label>
              <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-dark-3 dark:bg-dark-2">
                {loadingVoices && <p className="text-xs text-gray-5">Loading voices...</p>}
                {!loadingVoices && voices.length === 0 && (
                  <p className="text-xs text-gray-5">No voices for {labelForLanguage(selectedLanguage) || selectedLanguage}</p>
                )}
                <div className="space-y-2">
                  {voices.map((v) => (
                    <label key={v.id} className="flex items-center gap-2 rounded-lg border border-transparent px-2 py-1 hover:border-primary/40">
                      <input
                        type="radio"
                        name="voice"
                        value={v.id}
                        checked={voiceId === v.id}
                        onChange={() => setVoiceId(v.id)}
                      />
                      <span className="text-sm text-dark dark:text-white">
                        {v.name}
                        {v.tone ? ` · ${v.tone}` : ""}
                        {v.gender ? ` · ${v.gender}` : ""}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-dark dark:text-white">Video sources</label>
            <div className="flex flex-wrap gap-2">
              {videoSources.map((src) => (
                <button
                  type="button"
                  key={src.value}
                  onClick={() => toggleSource(src.value)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                    selectedSources.includes(src.value)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 text-gray-7 dark:border-dark-3 dark:text-dark-5"
                  }`}
                >
                  {src.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-5 dark:text-dark-5">
              Used to decide AI image prompts vs gameplay/viral sourcing in the next steps.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={status.type === "loading"}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {status.type === "loading" ? "Creating..." : "Create project"}
            </button>
            {status.message && (
              <span
                className={`text-sm ${
                  status.type === "error" ? "text-red-500" : status.type === "success" ? "text-green-600" : "text-gray-6"
                }`}
              >
                {status.message}
              </span>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-card-2 dark:border-dark-3 dark:bg-dark-2">
            <h2 className="text-lg font-semibold text-dark dark:text-white">Existing projects</h2>
            {loadingProjects && <p className="mt-2 text-sm text-gray-6 dark:text-dark-6">Loading...</p>}
            {!loadingProjects && projects.length === 0 && (
              <p className="mt-2 text-sm text-gray-6 dark:text-dark-6">No projects yet.</p>
            )}
            <ul className="mt-3 space-y-3">
              {projects.map((p) => (
                <li key={p.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-dark-3 dark:bg-dark-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-dark dark:text-white">{p.title}</span>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-semibold",
                      p.status === "ready"
                        ? "bg-emerald-100 text-emerald-700"
                        : p.status === "rendering"
                          ? "bg-amber-100 text-amber-700"
                          : p.status === "failed"
                            ? "bg-red-100 text-red-700"
                            : "bg-primary/10 text-primary"
                    )}>
                      {p.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-6 dark:text-dark-6">
                    {p.videoType === "shorts" ? "Shorts" : "Long-form"} · {labelForLanguage(p.language) || p.language || "en"}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/ai-videos/${p.id}`}
                      className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-7 transition hover:border-primary hover:text-primary dark:border-dark-3 dark:text-dark-5"
                    >
                      Open editor
                    </Link>
                    <button
                      type="button"
                      onClick={() => void handleGenerateScenes(p.id)}
                      disabled={generatingScenes === p.id}
                      className="rounded-md border border-primary/30 px-3 py-1 text-xs font-semibold text-primary transition hover:border-primary disabled:opacity-60"
                    >
                      {generatingScenes === p.id ? "Generating..." : "Generate script + scenes"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRender(p.id)}
                      disabled={rendering === p.id}
                      className="rounded-md bg-primary px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
                    >
                      {rendering === p.id ? "Queuing..." : "Render video"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void loadJobs(p.id);
                        void loadScenes(p.id);
                      }}
                      className="rounded-md border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-7 transition hover:border-primary hover:text-primary dark:border-dark-3 dark:text-dark-5"
                    >
                      Refresh status
                    </button>
                  </div>
                  {scenesByProject[p.id] && scenesByProject[p.id].length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {scenesByProject[p.id].slice(0, 4).map((scene) => (
                        <li key={scene.id} className="rounded-md bg-white px-2 py-1 text-xs text-gray-6 shadow-sm dark:bg-dark-3 dark:text-dark-5">
                          <span className="font-semibold text-dark dark:text-white">{scene.label || `Scene ${scene.sceneIndex + 1}`}</span>
                          {scene.durationMs ? (
                            <span className="ml-2 text-gray-5 dark:text-dark-5">· {(scene.durationMs / 1000).toFixed(0)}s</span>
                          ) : null}
                          <div className="text-[11px] text-gray-5 dark:text-dark-5 line-clamp-2">{scene.script}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                    {jobsByProject[p.id] && jobsByProject[p.id].length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {jobsByProject[p.id].slice(0, 3).map((job) => (
                          <li key={job.id} className="rounded-md bg-white px-2 py-1 text-xs text-gray-6 shadow-sm dark:bg-dark-3 dark:text-dark-5">
                            <span className="font-semibold text-dark dark:text-white">{job.status}</span>
                            {job.outputUrl && (
                              <a
                                href={job.outputUrl}
                                className="ml-2 text-primary underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                Output
                              </a>
                            )}
                            {!job.outputUrl && job.previewUrl && (
                              <a
                                href={job.previewUrl}
                                className="ml-2 text-primary underline"
                                target="_blank"
                                rel="noreferrer"
                              >
                                Preview
                              </a>
                            )}
                            {job.error && <span className="ml-2 text-red-500">{job.error}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 text-sm text-primary">
              <h3 className="text-base font-semibold text-primary">Next wiring</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Step screens for script → scenes → media mapping</li>
                <li>Render job kickoff (audio + captions + timeline)</li>
                <li>Customization tabs for captions/music/media</li>
              </ul>
            </div>
          </aside>
        </form>
      </div>
    );
  }
