import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

export type SocialToken = {
  id?: string;
  user_id: string;
  provider: "facebook";
  access_token: string;
  refresh_token?: string | null;
  expires_at?: string | null;
  page_id?: string | null;
  page_access_token?: string | null;
  metadata?: Record<string, unknown> | null;
};

function getConfig() {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!appId || !appSecret) {
    throw new Error("FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are required");
  }
  return { appId, appSecret, redirectUri };
}

export function buildFacebookAuthUrl(state: string, redirectUri: string) {
  const { appId } = getConfig();
  const scopes = [
    "public_profile",
    "email",
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
  ];
  const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", scopes.join(","));
  return url.toString();
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const { appId, appSecret } = getConfig();
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || "Failed to exchange code");
  }
  return json as { access_token: string; token_type: string; expires_in?: number };
}

export async function extendAccessToken(shortLivedToken: string) {
  const { appId, appSecret } = getConfig();
  const url = new URL(`${GRAPH_BASE}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const res = await fetch(url.toString(), { method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || "Failed to extend access token");
  }
  return json as { access_token: string; token_type: string; expires_in?: number };
}

export async function upsertSocialToken(token: SocialToken) {
  const { data, error } = await supabaseAdmin
    .from("social_tokens")
    .upsert(
      {
        user_id: token.user_id,
        provider: token.provider,
        access_token: token.access_token,
        refresh_token: token.refresh_token ?? null,
        expires_at: token.expires_at ?? null,
        page_id: token.page_id ?? null,
        page_access_token: token.page_access_token ?? null,
        metadata: token.metadata ?? null,
      },
      { onConflict: "user_id,provider" },
    )
    .select("id")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return data;
}

export async function getSocialToken(userId: string, provider: "facebook" = "facebook") {
  const { data, error } = await supabaseAdmin
    .from("social_tokens")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as SocialToken | null) ?? null;
}

async function resolvePageAccessToken(userAccessToken: string, preferredPageId?: string | null) {
  // If a page id is provided, fetch its access token
  if (preferredPageId) {
    const url = new URL(`${GRAPH_BASE}/${preferredPageId}`);
    url.searchParams.set("fields", "access_token,name,id");
    url.searchParams.set("access_token", userAccessToken);
    const res = await fetch(url.toString(), { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || "Failed to load page access token");
    }
    return { pageId: json.id as string, accessToken: json.access_token as string, name: json.name as string };
  }

  // Otherwise pick the first page the user manages
  const listUrl = new URL(`${GRAPH_BASE}/me/accounts`);
  listUrl.searchParams.set("access_token", userAccessToken);
  const res = await fetch(listUrl.toString(), { method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(json.error?.message || "No managed pages found for this user");
  }
  const page = json.data[0];
  return { pageId: page.id as string, accessToken: page.access_token as string, name: page.name as string };
}

export async function publishToFacebook(options: {
  userId: string;
  message: string;
  imageDataUrl?: string;
  pageId?: string;
}) {
  const token = await getSocialToken(options.userId, "facebook");
  if (!token) {
    throw new Error("Facebook is not connected for this user.");
  }

  const pageEnv = process.env.FACEBOOK_PAGE_ID;
  const targetPageId = options.pageId || token.page_id || pageEnv || undefined;

  const page = await resolvePageAccessToken(token.access_token, targetPageId);

  if (options.imageDataUrl) {
    const base64 = options.imageDataUrl.split(",")[1] || "";
    const buffer = Buffer.from(base64, "base64");
    const blob = new Blob([buffer], { type: "image/png" });
    const form = new FormData();
    form.append("source", blob, "quote.png");
    form.append("caption", options.message ?? "");

    const res = await fetch(`${GRAPH_BASE}/${page.pageId}/photos?access_token=${page.accessToken}`, {
      method: "POST",
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || "Failed to publish image");
    }
    return json;
  }

  const feedUrl = new URL(`${GRAPH_BASE}/${page.pageId}/feed`);
  feedUrl.searchParams.set("message", options.message);
  feedUrl.searchParams.set("access_token", page.accessToken);
  const res = await fetch(feedUrl.toString(), { method: "POST" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || "Failed to publish post");
  }
  return json;
}

export function missingFacebookConfigResponse() {
  const response = NextResponse.json(
    {
      error:
        "Facebook app is not configured. Please set FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, and FACEBOOK_REDIRECT_URI in your environment.",
    },
    { status: 500 },
  );
  return response;
}
