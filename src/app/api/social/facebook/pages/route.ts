import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireUser } from "@/lib/api-auth";
import { isPlatformEnabled } from "@/lib/social/platforms";
import { missingFacebookConfigResponse, savePreferredFacebookPage } from "@/lib/social/facebook";

const PAGES_COOKIE = "fb_pages_session";

type CookiePagesPayload = {
  userId: string;
  pages: Array<{ id: string; name?: string | null; tasks?: string[] }>;
};

function getSigningKey() {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required to verify page session cookies.");
  }
  return key;
}

function verifyCookiePayload(value: string) {
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", getSigningKey()).update(payload).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }
  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(decoded) as CookiePagesPayload;
  } catch {
    return null;
  }
}

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

  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return missingFacebookConfigResponse();
  }

  try {
    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(PAGES_COOKIE)?.value;
    if (!cookieValue) {
      const response = NextResponse.json({ error: "Reconnect Facebook to load pages." }, { status: 400 });
      session.applyCookies(response);
      return response;
    }

    const payload = verifyCookiePayload(cookieValue);
    if (payload?.userId !== session.user.id || !Array.isArray(payload.pages)) {
      const response = NextResponse.json({ error: "Reconnect Facebook to load pages." }, { status: 400 });
      session.applyCookies(response);
      return response;
    }

    const response = NextResponse.json({
      pages: payload.pages.map((page) => ({
        id: page.id,
        name: page.name ?? "Untitled Page",
        tasks: page.tasks ?? [],
      })),
    });
    session.applyCookies(response);
    return response;
  } catch (err) {
    console.error("Failed to list Facebook pages", err);
    const response = NextResponse.json({ error: "Unable to load Facebook Pages" }, { status: 500 });
    session.applyCookies(response);
    return response;
  }
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return missingFacebookConfigResponse();
  }

  const body = (await request.json().catch(() => ({}))) as { pageId?: string };
  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
  if (!pageId) {
    const response = NextResponse.json({ error: "pageId is required" }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  try {
    const page = await savePreferredFacebookPage({ userId: session.user.id, pageId });
    const response = NextResponse.json({ success: true, page });
    session.applyCookies(response);
    return response;
  } catch (err) {
    console.error("Failed to save Facebook page preference", err);
    const response = NextResponse.json({ error: "Unable to save Facebook page" }, { status: 500 });
    session.applyCookies(response);
    return response;
  }
}
