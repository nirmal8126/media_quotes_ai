import type { RenderResult, RendererProvider } from "@/lib/renderer/types";

const API_URL = process.env.AI_VIDEO_API_URL;
const API_KEY = process.env.AI_VIDEO_API_KEY;

function ensureConfig() {
  if (!API_URL || !API_KEY) {
    throw new Error("AI video provider not configured.");
  }
  return { apiUrl: API_URL.replace(/\/$/, ""), apiKey: API_KEY };
}

export const aiProvider: RendererProvider = {
  name: "ai",
  async render(input) {
    const { apiUrl, apiKey } = ensureConfig();
    const res = await fetch(`${apiUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        script: input.script,
        style: input.style ?? null,
        template: input.template ?? null,
        durationSec: input.durationSec,
        language: input.language ?? null,
        withVoiceover: input.withVoiceover,
        aspectRatio: input.aspectRatio ?? "9:16",
        mode: "character_animation",
      }),
    });

    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      return {
        jobId: body.jobId || body.job_id || `ai_${Date.now()}`,
        status: "failed",
        error: body.error || body.message || `AI renderer failed (${res.status})`,
      };
    }

    const jobId = body.jobId || body.job_id || body.id;
    if (!jobId) {
      return {
        jobId: `ai_${Date.now()}`,
        status: "failed",
        error: "AI renderer response missing jobId",
      };
    }

    return {
      jobId,
      status: "rendering",
    };
  },
  async getStatus(jobId) {
    const { apiUrl, apiKey } = ensureConfig();
    const res = await fetch(`${apiUrl}/status/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    const body = (await res.json().catch(() => ({}))) as Record<string, any>;
    if (!res.ok) {
      return {
        jobId,
        status: "failed",
        error: body.error || body.message || `AI renderer status failed (${res.status})`,
      };
    }

    const statusRaw = (body.status || body.state || "").toString().toLowerCase();
    if (statusRaw === "ready") {
      return {
        jobId,
        status: "ready",
        videoUrl: body.videoUrl || body.video_url || null,
        thumbnailUrl: body.thumbnailUrl || body.thumbnail_url || null,
        error: body.error || null,
      };
    }
    if (statusRaw === "failed") {
      return {
        jobId,
        status: "failed",
        error: body.error || body.message || "AI renderer job failed",
      };
    }

    return {
      jobId,
      status: "rendering",
    };
  },
};
