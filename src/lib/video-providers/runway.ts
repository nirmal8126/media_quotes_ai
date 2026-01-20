import type { VideoProvider, VideoRenderInput, VideoRenderJob } from "./types";
import { getProviderEnv } from "./config";

type RunwayMode = "image_to_video" | "text_to_video";

function getRunwayConfig() {
  const env = getProviderEnv("runway");
  const apiBaseUrl = env.apiBaseUrl || "https://api.runwayml.com";
  const apiKey = env.apiKey;
  const apiVersion = env.apiVersion;
  const model = env.model || "veo3.1";
  if (!apiKey) {
    throw new Error("Runway API key missing (set RUNWAY_API_KEY).");
  }
  return { apiBaseUrl: apiBaseUrl.replace(/\/$/, ""), apiKey, apiVersion, model };
}

async function parseResponse(res: Response): Promise<Record<string, any>> {
  return (await res.json().catch(() => ({}))) as Record<string, any>;
}

async function requestJson(
  url: string,
  apiKey: string,
  apiVersion: string | undefined,
  body: Record<string, unknown>,
  fetcher: typeof fetch,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
  if (apiVersion) headers["X-Runway-Version"] = apiVersion;
  const res = await fetcher(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await parseResponse(res);
  return { res, data };
}

async function fetchTask(
  url: string,
  apiKey: string,
  apiVersion: string | undefined,
  fetcher: typeof fetch,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (apiVersion) headers["X-Runway-Version"] = apiVersion;
  const res = await fetcher(url, { method: "GET", headers });
  const data = await parseResponse(res);
  return { res, data };
}

function pickTaskId(body: Record<string, any>) {
  return body.taskId || body.task_id || body.jobId || body.job_id || body.id || null;
}

function pickVideoUrl(body: Record<string, any>) {
  return (
    body.videoUrl ||
    body.video_url ||
    body.output?.[0]?.url ||
    body.outputs?.[0]?.url ||
    body.result?.url ||
    null
  );
}

export async function runRunwayVideo(options: {
  mode?: RunwayMode;
  prompt: string;
  imageUrl?: string | null;
  durationSec: number;
  aspectRatio: "9:16" | "16:9";
  fetcher?: typeof fetch;
}) {
  const { apiBaseUrl, apiKey, apiVersion, model } = getRunwayConfig();
  const fetcher = options.fetcher || fetch;
  const ratio = options.aspectRatio === "16:9" ? "1280:720" : "720:1280";
  const rawDuration = Math.max(2, Math.min(Number(options.durationSec || 2), 10));
  const allowedDurations = [4, 6, 8];
  const duration = allowedDurations.reduce(
    (closest, value) =>
      Math.abs(value - rawDuration) < Math.abs(closest - rawDuration) ? value : closest,
    allowedDurations[0],
  );
  const mode: RunwayMode =
    options.mode || (options.imageUrl ? "image_to_video" : "text_to_video");

  const endpoint = mode === "image_to_video" ? "/v1/image_to_video" : "/v1/text_to_video";
  const body =
    mode === "image_to_video"
      ? {
          promptText: options.prompt,
          promptImage: options.imageUrl,
          ratio,
          duration,
          model,
        }
      : {
          promptText: options.prompt,
          ratio,
          audio: true,
          duration,
          model,
        };

  const { res, data } = await requestJson(`${apiBaseUrl}${endpoint}`, apiKey, apiVersion, body, fetcher);
  console.error("Runway validation issues", JSON.stringify(data.issues, null, 2));
  console.error("Runway request body", body);
  if (!res.ok) {
    throw new Error(data.error || data.message || `Runway request failed (${res.status})`);
  }

  const taskId = pickTaskId(data);
  const immediateUrl = pickVideoUrl(data);
  if (immediateUrl) {
    return { jobId: taskId || `runway_${Date.now()}`, videoUrl: immediateUrl, durationSec: data.duration };
  }
  if (!taskId) {
    throw new Error("Runway response missing task id.");
  }

  let attempts = 0;
  while (attempts < 30) {
    attempts += 1;
    const { res: statusRes, data: statusBody } = await fetchTask(
      `${apiBaseUrl}/v1/tasks/${encodeURIComponent(taskId)}`,
      apiKey,
      apiVersion,
      fetcher,
    );
    if (!statusRes.ok) {
      throw new Error(statusBody.error || statusBody.message || `Runway status failed (${statusRes.status})`);
    }
    const statusRaw = String(statusBody.status || statusBody.state || "").toLowerCase();
    if (statusRaw === "ready" || statusRaw === "completed" || statusRaw === "succeeded") {
      const url = pickVideoUrl(statusBody);
      if (!url) {
        throw new Error("Runway completed without a video URL.");
      }
      return { jobId: taskId, videoUrl: url, durationSec: statusBody.duration };
    }
    if (statusRaw === "failed") {
      throw new Error(statusBody.error || statusBody.message || "Runway job failed");
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Runway job timed out.");
}

export const runwayProvider: VideoProvider = {
  async createRender(input: VideoRenderInput): Promise<VideoRenderJob> {
    try {
      const result = await runRunwayVideo({
        prompt: input.scriptText,
        imageUrl: null,
        durationSec: input.durationSec,
        aspectRatio: input.aspectRatio ?? "9:16",
      });
      return {
        jobId: result.jobId || `runway_${Date.now()}`,
        status: "ready",
        videoUrl: result.videoUrl,
        thumbnailUrl: null,
      };
    } catch (error) {
      return {
        jobId: `runway_${Date.now()}`,
        status: "failed",
        error: (error as Error).message || "Runway job failed",
      };
    }
  },
  async getRender(jobId: string): Promise<VideoRenderJob> {
    return { jobId, status: "rendering" };
  },
};
