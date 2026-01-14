import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { encryptToken } from "@/lib/crypto/tokenVault";
import { isPlatformEnabled } from "@/lib/social/platforms";

const PAGES_COOKIE = "fb_pages_session";

type PagePayload = {
  userId: string;
  facebookUser?: { id: string; name?: string | null } | null;
  pages: Array<{ id: string; name?: string | null; access_token?: string | null; tasks?: string[] }>
  tokenExpiresAt?: string | null;
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
    return JSON.parse(decoded) as PagePayload;
  } catch {
    return null;
  }
}

type SelectPageBody = {
  page_id?: string;
  page_ids?: string[];
};

export async function POST(request: Request) {
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

  const body = (await request.json().catch(() => ({}))) as SelectPageBody;
  const pageId = typeof body.page_id === "string" ? body.page_id.trim() : "";
  const pageIds = Array.isArray(body.page_ids) ? body.page_ids.map((id) => String(id || "").trim()).filter(Boolean) : [];
  const targets = pageIds.length > 0 ? pageIds : pageId ? [pageId] : [];

  if (targets.length === 0) {
    const response = NextResponse.json({ error: "page_id or page_ids is required." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(PAGES_COOKIE)?.value;
  if (!cookieValue) {
    const { data: existing, error } = await supabaseAdmin
      .from("social_accounts")
      .update({ updated_at: new Date().toISOString() })
      .eq("user_id", session.user.id)
      .eq("platform", "facebook")
      .in("page_id", targets)
      .select("page_id, page_name");

    if (error || !existing || existing.length === 0) {
      const response = NextResponse.json({ error: "Reconnect Facebook to select a page." }, { status: 400 });
      session.applyCookies(response);
      return response;
    }

    const response = NextResponse.json({
      connected: true,
      pages: existing.map((row) => ({ page_id: row.page_id, page_name: row.page_name })),
    });
    session.applyCookies(response);
    return response;
  }

  const payload = verifyCookiePayload(cookieValue);
  if (!payload || payload.userId !== session.user.id) {
    const response = NextResponse.json({ error: "Invalid Facebook pages session." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  const pagesToSave = payload.pages.filter((item) => targets.includes(item.id));
  if (pagesToSave.length === 0) {
    const response = NextResponse.json({ error: "Selected page not found." }, { status: 404 });
    session.applyCookies(response);
    return response;
  }

  const tokenExpiresAt = payload.tokenExpiresAt ?? null;
  const facebookUserId = payload.facebookUser?.id ?? null;

  const rows = pagesToSave
    .filter((page) => page.access_token)
    .map((page) => ({
      user_id: session.user.id,
      platform: "facebook",
      fb_user_id: facebookUserId,
      page_id: page.id,
      page_name: page.name ?? null,
      page_access_token_encrypted: encryptToken(page.access_token as string),
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    const response = NextResponse.json({ error: "Selected page token missing." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  const { error } = await supabaseAdmin
    .from("social_accounts")
    .upsert(rows, { onConflict: "user_id,platform,page_id" });

  if (error) {
    console.error("Failed to save Facebook page", { message: error.message, details: error.details });
    const response = NextResponse.json(
      { error: error.message || "Failed to save Facebook page." },
      { status: 500 },
    );
    session.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({
    connected: true,
    pages: rows.map((row) => ({ page_id: row.page_id, page_name: row.page_name })),
  });
  response.cookies.delete(PAGES_COOKIE);
  session.applyCookies(response);
  return response;
}
