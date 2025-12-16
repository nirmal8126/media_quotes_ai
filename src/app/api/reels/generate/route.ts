import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { startReelGeneration } from "@/lib/reels-pipeline";

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;

  const body = await request.json().catch(() => ({}));

  try {
    const result = await startReelGeneration(user, body);
    const response = NextResponse.json({
      message: "Reel generation started",
      reel: result.reel,
      script: result.script,
    });
    applyCookies(response);
    return response;
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = (error as Error)?.message || "Unable to start reel generation.";
    console.error("reels/generate failed", error);
    const response = NextResponse.json({ error: message }, { status });
    applyCookies(response);
    return response;
  }
}
