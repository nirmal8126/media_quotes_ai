export type RenderStatus = "rendering" | "ready" | "failed";

export type RenderResult = {
  jobId: string;
  status: RenderStatus;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  error?: string | null;
};

export interface RendererProvider {
  name: string;
  render(input: {
    script: string;
    style?: string | null;
    template?: string | null;
    durationSec: number;
    language?: string | null;
    withVoiceover: boolean;
    aspectRatio?: "9:16" | "16:9";
  }): Promise<RenderResult>;
  getStatus(jobId: string): Promise<RenderResult>;
}
