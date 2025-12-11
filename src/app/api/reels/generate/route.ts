import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { normalizeReelRequest } from "@/lib/generation-normalize";
import type { ReelRenderJob } from "@/types/generation";

type Payload = {
  script?: { type?: "existing" | "uploaded" | "new"; scriptId?: string; text?: string };
  reelType?: string;
  visual?: {
    videoStyle?: string;
    background?: string;
    font?: string;
    textAnimation?: string;
  };
  audio?: {
    aiVoiceId?: string;
    musicUploadId?: string;
    trendingAudioId?: string;
  };
  resolution?: { width?: number; height?: number };
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { applyCookies } = session;

  const body = (await request.json().catch(() => ({}))) as Payload;
  const normalized = normalizeReelRequest({
    script: body.script,
    reelType: body.reelType as any,
    visual: body.visual as any,
    audio: body.audio as any,
    resolution: body.resolution as any,
  });

  // Stub job payload for now (no render pipeline yet)
  const job: ReelRenderJob = {
    id: `reel-job-${Date.now()}`,
    status: "queued",
    videoUrl: null,
    thumbnailUrl: null,
    scenes: [],
  };

  const response = NextResponse.json({
    message: "Reel generation job created (stub). Wire this to your renderer.",
    job,
    normalized,
  });
  applyCookies(response);
  return response;
}
