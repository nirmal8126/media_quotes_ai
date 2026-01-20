import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encryptToken } from "@/lib/security/tokenVault";

const STATE_COOKIE = "yt_oauth_state";

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const stateCookie = cookieStore.get(STATE_COOKIE)?.value;

  if (!code || !state || !stateCookie || stateCookie !== state) {
    const response = NextResponse.redirect(new URL("/settings/social?connected=youtube&error=state", request.url));
    response.cookies.delete(STATE_COOKIE);
    session.applyCookies(response);
    return response;
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    const response = NextResponse.json(
      { error: "YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI are required." },
      { status: 500 },
    );
    session.applyCookies(response);
    return response;
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenBody = (await tokenRes.json().catch(() => ({}))) as TokenResponse;
    if (!tokenRes.ok || !tokenBody.access_token) {
      throw new Error(tokenBody?.error || "Failed to exchange YouTube code for token.");
    }

    const accessToken = tokenBody.access_token;
    const refreshToken = tokenBody.refresh_token;
    const expiresAt = tokenBody.expires_in
      ? new Date(Date.now() + tokenBody.expires_in * 1000).toISOString()
      : null;

    const channelRes = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    const channelBody = (await channelRes.json().catch(() => ({}))) as {
      items?: Array<{ id: string; snippet?: { title?: string } }>;
    };
    if (!channelRes.ok || !channelBody.items?.length) {
      throw new Error("Unable to fetch YouTube channel info.");
    }

    const channel = channelBody.items[0];
    const channelId = channel.id;
    const channelName = channel.snippet?.title || "YouTube Channel";

    const { data: existing } = await supabaseAdmin
      .from("social_accounts")
      .select("id, page_access_token_encrypted, refresh_token_encrypted")
      .eq("user_id", session.user.id)
      .eq("platform", "youtube")
      .maybeSingle();

    await supabaseAdmin
      .from("social_accounts")
      .upsert(
        {
          id: existing?.id,
          user_id: session.user.id,
          platform: "youtube",
          page_id: channelId,
          page_name: channelName,
          page_access_token_encrypted: encryptToken(accessToken),
          refresh_token_encrypted: refreshToken
            ? encryptToken(refreshToken)
            : existing?.refresh_token_encrypted ?? null,
          token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,page_id" },
      );

    const response = NextResponse.redirect(new URL("/settings/social?connected=youtube", request.url));
    response.cookies.delete(STATE_COOKIE);
    session.applyCookies(response);
    return response;
  } catch (err) {
    console.error("YouTube OAuth callback failed", err);
    const response = NextResponse.redirect(new URL("/settings/social?connected=youtube&error=oauth", request.url));
    response.cookies.delete(STATE_COOKIE);
    session.applyCookies(response);
    return response;
  }
}
