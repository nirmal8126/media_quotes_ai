import type { VideoProvider, VideoRenderInput, VideoRenderJob } from "./types";

function getRunwayConfig() {
  const apiUrl = process.env.AI_VIDEO_API_URL;
  const apiKey = process.env.AI_VIDEO_API_KEY;
  const apiVersion = process.env.RUNWAY_API_VERSION || process.env.AI_VIDEO_API_VERSION;
  const model = process.env.RUNWAY_MODEL || "veo3.1";
  if (!apiUrl || !apiKey) {
    throw new Error("Runway credentials missing");
  }
  if (!apiVersion) {
    throw new Error("Runway API version missing (set RUNWAY_API_VERSION)");
  }
  return { apiUrl: apiUrl.replace(/\/$/, ""), apiKey, apiVersion, model };
}

async function parseResponse(res: Response): Promise<Record<string, any>> {
  return (await res.json().catch(() => ({}))) as Record<string, any>;
}

async function requestJson(url: string, apiKey: string, apiVersion: string, body: Record<string, unknown>) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "X-Runway-Version": apiVersion,
    },
    body: JSON.stringify(body),
  });
  const data = await parseResponse(res);
  return { res, data };
}

export const runwayProvider: VideoProvider = {
  async createRender(input: VideoRenderInput): Promise<VideoRenderJob> {
    const { apiUrl, apiKey, apiVersion, model } = getRunwayConfig();
    const ratio = input.aspectRatio === "16:9" ? "1280:720" : "720:1280";
    const duration = Math.max(2, Math.min(Number(input.durationSec || 2), 10));
    const { res, data } = await requestJson(`${apiUrl}/v1/text_to_video`, apiKey, apiVersion, {
      promptText: input.scriptText,
      ratio,
      audio: Boolean(input.withVoiceover),
      duration,
      model,
    });

    if (!res.ok) {
      return {
        jobId: data.jobId || data.job_id || data.id || `runway_${Date.now()}`,
        status: "failed",
        error: data.error || data.message || `Runway request failed (${res.status})`,
      };
    }

    const jobId = data.taskId || data.task_id || data.jobId || data.job_id || data.id;
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
    const { apiUrl, apiKey, apiVersion } = getRunwayConfig();
    const res = await fetch(`${apiUrl}/v1/tasks/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "X-Runway-Version": apiVersion,
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
    if (statusRaw === "ready" || statusRaw === "completed" || statusRaw === "succeeded") {
      return {
        jobId,
        status: "ready",
        videoUrl:
          body.videoUrl ||
          body.video_url ||
          body.output?.[0]?.url ||
          body.outputs?.[0]?.url ||
          body.result?.url ||
          null,
        thumbnailUrl: body.thumbnailUrl || body.thumbnail_url || body.preview_url || null,
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
