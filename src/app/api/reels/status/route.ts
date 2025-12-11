import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import type { ReelRenderJob } from "@/types/generation";

// This is a stubbed status endpoint. In a real setup, you would fetch job status from
// your render queue/service (e.g., DB, worker, external service).

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) {
    const response = NextResponse.json({ error: "jobId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const job: ReelRenderJob = {
    id: jobId,
    status: "queued",
    videoUrl: null,
    thumbnailUrl: null,
    scenes: [],
  };

  // TODO: replace with real status lookup from your renderer

  const response = NextResponse.json({ job });
  applyCookies(response);
  return response;
}
