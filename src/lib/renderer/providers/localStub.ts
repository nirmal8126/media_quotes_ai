import type { RenderResult, RendererProvider } from "@/lib/renderer/types";

function getRendererConfig() {
  const url = process.env.RENDERER_API_URL || "http://localhost:4001";
  const apiKey = process.env.RENDERER_API_KEY || "dev-renderer-key";
  return { url, apiKey };
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

export const localStubProvider: RendererProvider = {
  name: "local_stub",
  async render(input) {
    const { url, apiKey } = getRendererConfig();
    const target = `${url.replace(/\/$/, "")}/render`;
    const scenes = buildScenes(input.script, input.durationSec);
    const res = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        scriptText: input.script,
        scenes,
        durationSec: input.durationSec,
        style: input.style ?? null,
        template: input.template ?? null,
        language: input.language ?? null,
        withVoiceover: input.withVoiceover,
        aspectRatio: input.aspectRatio ?? "9:16",
      }),
    });

    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
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
  async getStatus(jobId) {
    return {
      jobId,
      status: "ready",
    };
  },
};
