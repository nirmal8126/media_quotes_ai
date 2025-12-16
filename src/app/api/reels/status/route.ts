import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { fetchReelStatus } from "@/lib/reels-pipeline";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const reelId = searchParams.get("reelId");

  if (!reelId) {
    const response = NextResponse.json({ error: "reelId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const reel = await fetchReelStatus(user.id, reelId);
    const response = NextResponse.json({ reel });
    applyCookies(response);
    return response;
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = (error as Error)?.message || "Unable to fetch reel status.";
    const response = NextResponse.json({ error: message }, { status });
    applyCookies(response);
    return response;
  }
}
