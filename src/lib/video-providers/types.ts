export type VideoRenderStatus = "rendering" | "ready" | "failed";

export type VideoRenderInput = {
  scriptText: string;
  durationSec: number;
  style?: string | null;
  template?: string | null;
  audioUrl?: string | null;
  brand?: {
    colors?: string[] | null;
    fonts?: string[] | null;
    logoUrl?: string | null;
    endScreenTemplate?: string | null;
  } | null;
  language?: string | null;
  withVoiceover: boolean;
  aspectRatio?: "9:16" | "16:9";
};

export type VideoRenderJob = {
  jobId: string;
  status: VideoRenderStatus;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
};

export interface VideoProvider {
  createRender(input: VideoRenderInput): Promise<VideoRenderJob>;
  getRender(jobId: string): Promise<VideoRenderJob>;
}
