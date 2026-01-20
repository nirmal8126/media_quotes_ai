import type { VideoProvider, VideoRenderInput, VideoRenderJob } from "./types";
import { localStubProvider } from "./local_stub";
import { runwayProvider } from "./runway";
import { resolveProviderKey } from "./config";

export function getVideoProvider(): VideoProvider {
  const provider = resolveProviderKey(process.env.VIDEO_PROVIDER);
  if (provider === "runway") {
    return runwayProvider;
  }
  if (provider === "local_stub") {
    return localStubProvider;
  }
  return localStubProvider;
}

export async function renderVideo(input: VideoRenderInput): Promise<VideoRenderJob> {
  const provider = getVideoProvider();
  return provider.createRender(input);
}

export async function getVideoStatus(jobId: string): Promise<VideoRenderJob> {
  const provider = getVideoProvider();
  return provider.getRender(jobId);
}
