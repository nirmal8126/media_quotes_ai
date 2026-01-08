import { getVideoStatus, renderVideo } from "@/lib/video-providers";
import type { VideoRenderJob } from "@/lib/video-providers/types";

type TriggerInput = {
  scriptText: string;
  style?: string | null;
  template?: string | null;
  durationSec: number;
  language?: string | null;
  withVoiceover?: boolean;
};

export async function triggerRenderer(input: TriggerInput): Promise<VideoRenderJob> {
  try {
    const result = await renderVideo({
      scriptText: input.scriptText,
      style: input.style ?? null,
      template: input.template ?? null,
      durationSec: input.durationSec,
      language: input.language ?? null,
      withVoiceover: input.withVoiceover !== false,
      aspectRatio: "9:16",
      audioUrl: null,
      brand: null,
    });
    return result;
  } catch (error) {
    console.warn("Renderer failed", error);
    return {
      jobId: `renderer_${Date.now()}`,
      status: "failed",
      error: (error as Error).message || "Renderer failed",
    };
  }
}

export async function getRendererStatus(jobId: string): Promise<VideoRenderJob> {
  try {
    return await getVideoStatus(jobId);
  } catch (error) {
    console.warn("Renderer status failed", error);
    return {
      jobId,
      status: "failed",
      error: (error as Error).message || "Renderer status failed",
    };
  }
}
