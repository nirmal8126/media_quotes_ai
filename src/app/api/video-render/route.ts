import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createRenderJob, getVideoProject, listRenderJobs, listScenes, updateRenderJob, updateVideoProject, upsertScene, listMedia, upsertMedia } from "@/lib/video-service";
import { triggerRenderer } from "@/lib/renderer-client";
import { synthesizeWithElevenLabs } from "@/lib/tts";

function formatTimestamp(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  const milliseconds = Math.max(0, ms % 1000)
    .toString()
    .padStart(3, "0");
  return `${hours}:${minutes}:${seconds},${milliseconds}`;
}

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const projectId = (searchParams.get("projectId") ?? "").trim();
  if (!projectId) {
    const response = NextResponse.json({ error: "projectId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const jobs = await listRenderJobs(projectId);
    const response = NextResponse.json({ jobs });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to load render jobs" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = (body.projectId ?? "").toString().trim();
  if (!projectId) {
    const response = NextResponse.json({ error: "projectId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const project = await getVideoProject(session.user.id, projectId);
    if (!project) {
      const response = NextResponse.json({ error: "Project not found" }, { status: 404 });
      applyCookies(response);
      return response;
    }

    const scenes = await listScenes(projectId);
    if (!scenes.length) {
      const response = NextResponse.json({ error: "No scenes found. Generate scenes before rendering." }, { status: 400 });
      applyCookies(response);
      return response;
    }

    const job = await createRenderJob(projectId);
    if (!job?.id) {
      throw new Error("Render job id missing");
    }
    await updateVideoProject(session.user.id, projectId, { status: "rendering" });
    await updateRenderJob(job.id, { status: "processing", startedAt: new Date().toISOString() });

    // Simulate processing → completed with placeholder URLs
    const base = (process.env.MEDIA_CDN_BASE_URL || "https://cdn.mediaquotes.ai").replace(/\/$/, "");
    const previewUrl = `${base}/previews/${job?.id || "preview"}.mp4`;
    const outputUrl = `${base}/renders/${job?.id || "render"}.mp4`;

    if (!job?.id) throw new Error("Render job id missing");

    // Build a simple timeline from scenes
    let cursor = 0;
    const sceneMedia = await listMedia(projectId);
    const timeline = scenes
      .sort((a, b) => a.sceneIndex - b.sceneIndex)
      .map((scene) => {
        const duration = scene.durationMs ?? 5000;
        const startMs = cursor;
        const endMs = cursor + duration;
        cursor = endMs;
        const media = sceneMedia
          .filter((m) => m.sceneId === scene.id)
          .map((m) => ({ url: m.url, type: m.mediaType as "video" | "image" | "audio", source: m.source ?? null }));
        return {
          sceneIndex: scene.sceneIndex,
          startMs,
          endMs,
          caption: (scene.script || "").slice(0, 140),
          media,
          script: scene.script || "",
          prompt: scene.prompt || null,
        };
      });

    const captions = timeline.map((entry, idx) => ({
      index: idx + 1,
      startMs: entry.startMs,
      endMs: entry.endMs,
      text: entry.caption || "Caption",
      srt: `${idx + 1}\n${formatTimestamp(entry.startMs)} --> ${formatTimestamp(entry.endMs)}\n${entry.caption || "Caption"}\n`,
    }));
    const srtText = captions.map((c) => c.srt).join("\n");

    // Persist timeline/captions into scene metadata
    for (const entry of timeline) {
      const scene = scenes.find((s) => s.sceneIndex === entry.sceneIndex);
      await upsertScene(projectId, entry.sceneIndex, {
        durationMs: scene?.durationMs ?? entry.endMs - entry.startMs,
        metadata: {
          ...(scene?.metadata as Record<string, unknown> | null),
          timeline: { startMs: entry.startMs, endMs: entry.endMs },
          caption: entry.caption,
        },
      });
    }

    // Optional narration (ElevenLabs). If missing API key/voice, skip gracefully.
    let narrationUrl: string | null = null;
    try {
      const elevenKey = process.env.ELEVEN_API_KEY || process.env.ELEVENLABS_API_KEY;
      if (elevenKey) {
        const stitchedScript = timeline.map((t) => t.script).join("\n\n");
        narrationUrl = await synthesizeWithElevenLabs({
          text: stitchedScript,
          voiceId: project.narratorVoiceId || process.env.TTS_VOICE_DEFAULT || undefined,
          apiKey: elevenKey,
          mediaBaseUrl: process.env.MEDIA_CDN_BASE_URL,
          mediaDir: process.env.RENDERER_MEDIA_DIR,
        });
        if (narrationUrl) {
          await upsertMedia({
            projectId,
            sceneId: null,
            mediaType: "audio",
            source: "tts",
            url: narrationUrl,
            metadata: { voiceId: project.narratorVoiceId || null },
          });
        }
      }
    } catch (err) {
      console.warn("Narration generation skipped", err);
    }

    // Try hitting external renderer; fallback to local stub URLs on failure
    let rendererJob = null;
    try {
      rendererJob = await triggerRenderer({
        projectId,
        language: project.language ?? "en",
        voiceId: project.narratorVoiceId ?? undefined,
        captions: captions.map((c) => ({ startMs: c.startMs, endMs: c.endMs, text: c.text })),
        scenes: timeline.map((t) => ({
          index: t.sceneIndex,
          script: t.script,
          durationMs: t.endMs - t.startMs,
          prompt: t.prompt ?? undefined,
          media: t.media,
        })),
        audioUrl: narrationUrl || undefined,
      });
    } catch (err) {
      console.warn("Renderer failed, using stub URLs", err);
    }

    const finalPreview = rendererJob?.previewUrl ?? previewUrl;
    const finalOutput = rendererJob?.outputUrl ?? outputUrl;

    const updatedJob = await updateRenderJob(job.id, {
      status: "completed",
      previewUrl: finalPreview,
      outputUrl: finalOutput,
      completedAt: new Date().toISOString(),
      error: rendererJob ? undefined : "Renderer fallback used",
    });

    await updateVideoProject(session.user.id, projectId, {
      status: "ready",
      settings: {
        ...(project.settings || {}),
        renderJobId: updatedJob?.id,
        timeline,
        captions,
        captionSrt: srtText,
        previewUrl: finalPreview,
        outputUrl: finalOutput,
        rendererJobId: rendererJob?.jobId,
        rendererStatus: rendererJob?.status ?? "fallback",
        narrationUrl: narrationUrl || undefined,
      },
    });

    const response = NextResponse.json({ job: updatedJob }, { status: 201 });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to create render job" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
