import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireUser } from "@/lib/api-auth";

const STATE_COOKIE = "fb_oauth_state";
const PAGES_COOKIE = "fb_pages_session";
const STATE_TTL_SECONDS = 10 * 60;

function getSigningKey() {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required to sign Facebook session cookies.");
  }
  return key;
}

function signPayload(payload: string) {
  return crypto.createHmac("sha256", getSigningKey()).update(payload).digest("base64url");
}

function toBase64Url(data: string) {
  return Buffer.from(data, "utf8").toString("base64url");
}

type FacebookTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

type FacebookUser = {
  id: string;
  name?: string;
};

type FacebookPage = {
  id: string;
  name?: string;
  access_token?: string;
  tasks?: string[];
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
    const response = NextResponse.redirect(new URL("/settings/social?connected=facebook&error=state", request.url));
    response.cookies.delete(STATE_COOKIE);
    session.applyCookies(response);
    return response;
  }

  const appId = process.env.FACEBOOK_LOGIN_APP_ID;
  const appSecret = process.env.FACEBOOK_LOGIN_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_LOGIN_REDIRECT_URI;
  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";

  if (!appId || !appSecret || !redirectUri) {
    const response = NextResponse.json(
      { error: "FACEBOOK_LOGIN_APP_ID, FACEBOOK_LOGIN_APP_SECRET, and FACEBOOK_LOGIN_REDIRECT_URI are required." },
      { status: 500 },
    );
    session.applyCookies(response);
    return response;
  }

  try {
    const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    tokenUrl.searchParams.set("client_id", appId);
    tokenUrl.searchParams.set("client_secret", appSecret);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString(), { method: "GET" });
    const tokenJson = (await tokenRes.json().catch(() => ({}))) as FacebookTokenResponse;
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error("Failed to exchange Facebook code for token.");
    }

    const extendUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
    extendUrl.searchParams.set("grant_type", "fb_exchange_token");
    extendUrl.searchParams.set("client_id", appId);
    extendUrl.searchParams.set("client_secret", appSecret);
    extendUrl.searchParams.set("fb_exchange_token", tokenJson.access_token);

    const extendRes = await fetch(extendUrl.toString(), { method: "GET" });
    const extendJson = (await extendRes.json().catch(() => ({}))) as FacebookTokenResponse;
    if (!extendRes.ok || !extendJson.access_token) {
      throw new Error("Failed to extend Facebook access token.");
    }

    const userUrl = new URL(`https://graph.facebook.com/${graphVersion}/me`);
    userUrl.searchParams.set("fields", "id,name");
    userUrl.searchParams.set("access_token", extendJson.access_token);

    const userRes = await fetch(userUrl.toString(), { method: "GET" });
    const userJson = (await userRes.json().catch(() => ({}))) as FacebookUser;
    if (!userRes.ok || !userJson.id) {
      throw new Error("Failed to load Facebook user profile.");
    }

    const pagesUrl = new URL(`https://graph.facebook.com/${graphVersion}/me/accounts`);
    pagesUrl.searchParams.set("fields", "id,name,access_token,tasks");
    pagesUrl.searchParams.set("access_token", extendJson.access_token);

    const pagesRes = await fetch(pagesUrl.toString(), { method: "GET" });
    const pagesJson = (await pagesRes.json().catch(() => ({}))) as { data?: FacebookPage[] };
    if (!pagesRes.ok || !Array.isArray(pagesJson.data)) {
      throw new Error("Failed to load Facebook pages.");
    }

    const payload = {
      userId: session.user.id,
      facebookUser: { id: userJson.id, name: userJson.name ?? null },
      pages: pagesJson.data.map((page) => ({
        id: page.id,
        name: page.name ?? null,
        access_token: page.access_token ?? null,
        tasks: page.tasks ?? [],
      })),
      tokenExpiresAt: extendJson.expires_in
        ? new Date(Date.now() + extendJson.expires_in * 1000).toISOString()
        : null,
      createdAt: new Date().toISOString(),
    };

    const encodedPayload = toBase64Url(JSON.stringify(payload));
    const signature = signPayload(encodedPayload);

    const response = NextResponse.redirect(new URL("/settings/social?connected=facebook", request.url));
    response.cookies.delete(STATE_COOKIE);
    response.cookies.set(PAGES_COOKIE, `${encodedPayload}.${signature}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: STATE_TTL_SECONDS,
      path: "/",
    });
    session.applyCookies(response);
    return response;
  } catch (err) {
    console.error("Facebook OAuth callback failed", err);
    const response = NextResponse.redirect(new URL("/settings/social?connected=facebook&error=oauth", request.url));
    response.cookies.delete(STATE_COOKIE);
    session.applyCookies(response);
    return response;
  }
}
