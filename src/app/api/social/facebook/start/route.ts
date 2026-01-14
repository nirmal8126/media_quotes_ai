import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { buildFacebookAuthUrl, missingFacebookConfigResponse } from "@/lib/social/facebook";
import { isPlatformEnabled } from "@/lib/social/platforms";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const enabled = await isPlatformEnabled("facebook");
  if (!enabled) {
    const response = NextResponse.json({ error: "Facebook is currently disabled." }, { status: 403 });
    session.applyCookies(response);
    return response;
  }

  try {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret) {
      return missingFacebookConfigResponse();
    }

    const origin = new URL(request.url).origin;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI || `${origin}/api/social/facebook/callback`;
    const url = buildFacebookAuthUrl(session.user.id, redirectUri);
    const response = NextResponse.json({ url });
    session.applyCookies(response);
    return response;
  } catch (err) {
    console.error("Failed to start Facebook OAuth", err);
    const response = NextResponse.json({ error: "Unable to start Facebook connect flow." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }
}
