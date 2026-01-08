import type { VideoProvider, VideoRenderInput, VideoRenderJob } from "./types";

function getRendererConfig() {
  const url = process.env.RENDERER_API_URL || "http://localhost:4001";
  const apiKey = process.env.RENDERER_API_KEY || "dev-renderer-key";
  const mediaBase = process.env.MEDIA_CDN_BASE_URL || `${url.replace(/\/$/, "")}/media`;
  return { url, apiKey, mediaBase };
}

function splitScript(script: string) {
  const lines = script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const segments: string[] = [];
  lines.forEach((line) => {
    if (/^step\s*\d+[:.]/i.test(line)) {
      segments.push(line);
      return;
    }
    line.split(/(?<=[.!?])\s+/).forEach((part) => {
      const trimmed = part.trim();
      if (trimmed) segments.push(trimmed);
    });
  });
  return segments.length ? segments : [script];
}

function buildScenes(script: string, durationSec: number) {
  let segments = splitScript(script);
  if (segments.length > 8) segments = segments.slice(0, 8);
  if (segments.length < 4) segments = [...segments, ...segments].slice(0, 4);
  const totalMs = Math.max(4, durationSec) * 1000;
  const base = Math.floor(totalMs / segments.length);
  let remainder = totalMs - base * segments.length;
  return segments.map((text) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder = Math.max(0, remainder - 1);
    return { text, durationMs: base + extra };
  });
}

async function parseResponse(res: Response): Promise<Record<string, any>> {
  return (await res.json().catch(() => ({}))) as Record<string, any>;
}

export const localStubProvider: VideoProvider = {
  async createRender(input: VideoRenderInput): Promise<VideoRenderJob> {
    const { url, apiKey } = getRendererConfig();
    const target = `${url.replace(/\/$/, "")}/render`;
    const scenes = buildScenes(input.scriptText, input.durationSec);
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        scriptText: input.scriptText,
        durationSec: input.durationSec,
        style: input.style ?? null,
        template: input.template ?? null,
        audioUrl: input.audioUrl ?? null,
        brand: input.brand ?? null,
        language: input.language ?? null,
        withVoiceover: input.withVoiceover,
        aspectRatio: input.aspectRatio ?? "9:16",
        scenes,
      }),
    });

    const body = await parseResponse(res);
    const jobId = body.jobId || body.job_id || body.id || body.renderId || body.render_id;
    if (!res.ok) {
      return {
        jobId: jobId || `stub_${Date.now()}`,
        status: "failed",
        error: body.error || body.message || `Renderer failed (${res.status})`,
      };
    }

    const videoUrl = body.videoUrl || body.video_url || null;
    const thumbnailUrl = body.thumbnailUrl || body.thumbnail_url || null;
    if (!videoUrl || !thumbnailUrl) {
      return {
        jobId: jobId || `stub_${Date.now()}`,
        status: "failed",
        error: "Local stub returned without assets",
      };
    }
    return {
      jobId: jobId || `stub_${Date.now()}`,
      status: "ready",
      videoUrl,
      thumbnailUrl,
      error: body.error || null,
    };
  },
  async getRender(jobId: string): Promise<VideoRenderJob> {
    const { mediaBase } = getRendererConfig();
    return {
      jobId,
      status: "ready",
      videoUrl: `${mediaBase.replace(/\/$/, "")}/renders/${jobId}.mp4`,
      thumbnailUrl: `${mediaBase.replace(/\/$/, "")}/previews/${jobId}.jpg`,
    };
  },
};
