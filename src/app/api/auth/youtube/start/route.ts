import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireUser } from "@/lib/api-auth";
import { isPlatformEnabled } from "@/lib/social/platforms";

const STATE_COOKIE = "yt_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const enabled = await isPlatformEnabled("youtube");
  if (!enabled) {
    const response = NextResponse.json({ error: "YouTube is currently disabled." }, { status: 403 });
    session.applyCookies(response);
    return response;
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    const response = NextResponse.json(
      { error: "YOUTUBE_CLIENT_ID and YOUTUBE_REDIRECT_URI are required." },
      { status: 500 },
    );
    session.applyCookies(response);
    return response;
  }

  const state = crypto.randomBytes(24).toString("hex");
  const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  oauthUrl.searchParams.set("client_id", clientId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", "https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly");
  oauthUrl.searchParams.set("access_type", "offline");
  oauthUrl.searchParams.set("prompt", "consent");
  oauthUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(oauthUrl.toString());
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: STATE_TTL_SECONDS,
    path: "/",
  });
  session.applyCookies(response);
  return response;
}
