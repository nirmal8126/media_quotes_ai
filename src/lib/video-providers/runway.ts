import type { VideoProvider, VideoRenderInput, VideoRenderJob } from "./types";

function getRunwayConfig() {
  const apiUrl = process.env.AI_VIDEO_API_URL;
  const apiKey = process.env.AI_VIDEO_API_KEY;
  if (!apiUrl || !apiKey) {
    throw new Error("Runway credentials missing");
  }
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey };
}

async function parseResponse(res: Response): Promise<Record<string, any>> {
  return (await res.json().catch(() => ({}))) as Record<string, any>;
}

export const runwayProvider: VideoProvider = {
  async createRender(input: VideoRenderInput): Promise<VideoRenderJob> {
    const { apiUrl, apiKey } = getRunwayConfig();
    const res = await fetch(`${apiUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        script: input.scriptText,
        style: input.style ?? null,
        template: input.template ?? null,
        durationSec: input.durationSec,
        language: input.language ?? null,
        withVoiceover: input.withVoiceover,
        aspectRatio: input.aspectRatio ?? "9:16",
      }),
    });

    const body = await parseResponse(res);
    if (!res.ok) {
      return {
        jobId: body.jobId || body.job_id || `runway_${Date.now()}`,
        status: "failed",
        error: body.error || body.message || `Runway request failed (${res.status})`,
      };
    }

    const jobId = body.jobId || body.job_id || body.id;
    if (!jobId) {
      return {
        jobId: `runway_${Date.now()}`,
        status: "failed",
        error: "Runway response missing jobId",
      };
    }

    return { jobId, status: "rendering" };
  },
  async getRender(jobId: string): Promise<VideoRenderJob> {
    const { apiUrl, apiKey } = getRunwayConfig();
    const res = await fetch(`${apiUrl}/status/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const body = await parseResponse(res);
    if (!res.ok) {
      return {
        jobId,
        status: "failed",
        error: body.error || body.message || `Runway status failed (${res.status})`,
      };
    }

    const statusRaw = String(body.status || body.state || "").toLowerCase();
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
        error: body.error || body.message || "Runway job failed",
      };
    }

    return { jobId, status: "rendering" };
  },
};
