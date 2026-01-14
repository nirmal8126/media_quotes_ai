import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireUser } from "@/lib/api-auth";
import { isPlatformEnabled } from "@/lib/social/platforms";

const STATE_COOKIE = "fb_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;

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

  const appId = process.env.FACEBOOK_LOGIN_APP_ID;
  const redirectUri = process.env.FACEBOOK_LOGIN_REDIRECT_URI;
  if (!appId || !redirectUri) {
    const response = NextResponse.json(
      { error: "FACEBOOK_LOGIN_APP_ID and FACEBOOK_LOGIN_REDIRECT_URI are required." },
      { status: 500 },
    );
    session.applyCookies(response);
    return response;
  }

  const state = crypto.randomBytes(24).toString("hex");
  const oauthUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  oauthUrl.searchParams.set("client_id", appId);
  oauthUrl.searchParams.set("redirect_uri", redirectUri);
  oauthUrl.searchParams.set("state", state);
  oauthUrl.searchParams.set("response_type", "code");
  oauthUrl.searchParams.set("scope", "pages_show_list,pages_read_engagement,pages_manage_posts");

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
