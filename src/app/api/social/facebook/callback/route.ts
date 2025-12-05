import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { extendAccessToken, exchangeCodeForToken, missingFacebookConfigResponse, upsertSocialToken } from "@/lib/social/facebook";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    // If not authenticated, send them to sign-in
    return NextResponse.redirect("/auth/sign-in");
  }

  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    const response = NextResponse.redirect(`/quotes?fb=error`);
    session.applyCookies(response);
    return response;
  }

  if (!code) {
    const response = NextResponse.redirect(`/quotes?fb=missing_code`);
    session.applyCookies(response);
    return response;
  }

  const redirectUri = process.env.FACEBOOK_REDIRECT_URI || `${origin}/api/social/facebook/callback`;
  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return missingFacebookConfigResponse();
  }

  try {
    const shortToken = await exchangeCodeForToken(code, redirectUri);
    const extended = await extendAccessToken(shortToken.access_token);

    await upsertSocialToken({
      user_id: session.user.id,
      provider: "facebook",
      access_token: extended.access_token,
      expires_at: extended.expires_in ? new Date(Date.now() + extended.expires_in * 1000).toISOString() : null,
    });

    const response = NextResponse.redirect(`/quotes?fb=connected`);
    session.applyCookies(response);
    return response;
  } catch (err) {
    console.error("Failed to handle Facebook callback", err);
    const response = NextResponse.redirect(`/quotes?fb=failed`);
    session.applyCookies(response);
    return response;
  }
}
