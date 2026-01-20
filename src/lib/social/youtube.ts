import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken, encryptToken } from "@/lib/security/tokenVault";

type YoutubeAccount = {
  id: string;
  user_id: string;
  page_id: string | null;
  page_name: string | null;
  page_access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
};

type YoutubeChannel = { id: string; name: string };

async function getYoutubeAccount(userId: string): Promise<YoutubeAccount | null> {
  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .select(
      "id, user_id, page_id, page_name, page_access_token_encrypted, refresh_token_encrypted, token_expires_at",
    )
    .eq("user_id", userId)
    .eq("platform", "youtube")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  return (data as YoutubeAccount | null) ?? null;
}

function isTokenExpired(expiresAt?: string | null) {
  if (!expiresAt) return false;
  const time = new Date(expiresAt).getTime();
  return Number.isFinite(time) && time <= Date.now() + 60 * 1000;
}

async function refreshAccessToken(refreshToken: string) {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!res.ok || !body.access_token) {
    throw new Error(body?.error || "Failed to refresh YouTube access token.");
  }
  return {
    accessToken: body.access_token,
    expiresAt: body.expires_in ? new Date(Date.now() + body.expires_in * 1000).toISOString() : null,
  };
}

export async function getYoutubeAccessToken(userId: string) {
  const account = await getYoutubeAccount(userId);
  if (!account?.page_access_token_encrypted) {
    throw new Error("YouTube not connected.");
  }
  const accessToken = decryptToken(account.page_access_token_encrypted);
  if (!isTokenExpired(account.token_expires_at)) {
    return { accessToken, channelId: account.page_id, channelName: account.page_name };
  }

  if (!account.refresh_token_encrypted) {
    return { accessToken, channelId: account.page_id, channelName: account.page_name };
  }

  const refreshToken = decryptToken(account.refresh_token_encrypted);
  const refreshed = await refreshAccessToken(refreshToken);
  await supabaseAdmin
    .from("social_accounts")
    .update({
      page_access_token_encrypted: encryptToken(refreshed.accessToken),
      token_expires_at: refreshed.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", account.id);

  return { accessToken: refreshed.accessToken, channelId: account.page_id, channelName: account.page_name };
}

export async function listYoutubeChannels(accessToken: string): Promise<YoutubeChannel[]> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    items?: Array<{ id: string; snippet?: { title?: string } }>;
  };
  if (!res.ok) {
    throw new Error(body?.error?.message || "Unable to fetch YouTube channels.");
  }
  return (body.items || []).map((item) => ({
    id: item.id,
    name: item.snippet?.title || "YouTube Channel",
  }));
}

export async function uploadYoutubeVideo(options: {
  accessToken: string;
  videoUrl: string;
  title: string;
  description: string;
  tags?: string[];
  privacyStatus?: "private" | "unlisted" | "public";
}) {
  const { accessToken, videoUrl, title, description, tags = [], privacyStatus = "unlisted" } = options;
  const videoRes = await fetch(videoUrl);
  if (!videoRes.ok) {
    throw new Error("Unable to download video for upload.");
  }
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

  const metadata = {
    snippet: { title, description, tags },
    status: { privacyStatus },
  };
  const boundary = `boundary_${Date.now()}`;
  const bodyParts = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    "Content-Type: video/mp4",
    "",
  ];
  const endPart = `\n--${boundary}--`;
  const body = Buffer.concat([
    Buffer.from(bodyParts.join("\n"), "utf8"),
    videoBuffer,
    Buffer.from(endPart, "utf8"),
  ]);

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=multipart&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
      body,
    },
  );
  const uploadBody = (await uploadRes.json().catch(() => ({}))) as { id?: string };
  if (!uploadRes.ok || !uploadBody.id) {
    throw new Error(uploadBody?.error?.message || "YouTube upload failed.");
  }

  const videoId = uploadBody.id;
  return {
    videoId,
    videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
  };
}
