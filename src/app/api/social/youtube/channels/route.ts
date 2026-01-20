import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getYoutubeAccessToken, listYoutubeChannels } from "@/lib/social/youtube";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  try {
    const { accessToken } = await getYoutubeAccessToken(session.user.id);
    const channels = await listYoutubeChannels(accessToken);
    const response = NextResponse.json({ channels });
    session.applyCookies(response);
    return response;
  } catch (err) {
    const response = NextResponse.json(
      { error: (err as Error).message || "Unable to load YouTube channels." },
      { status: 500 },
    );
    session.applyCookies(response);
    return response;
  }
}
