import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getYoutubeAccessToken, uploadYoutubeVideo } from "@/lib/social/youtube";

type PublishBody = {
  reelId?: string;
  title?: string;
  description?: string;
  tags?: string[];
  privacyStatus?: "private" | "unlisted" | "public";
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const body = (await request.json().catch(() => ({}))) as PublishBody;
  const reelId = typeof body.reelId === "string" ? body.reelId.trim() : "";
  if (!reelId) {
    const response = NextResponse.json({ error: "reelId is required." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  const { data: reel, error } = await supabaseAdmin
    .from("reels")
    .select("id, user_id, video_url, caption, hashtags")
    .eq("id", reelId)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !reel) {
    const response = NextResponse.json({ error: "Reel not found." }, { status: 404 });
    session.applyCookies(response);
    return response;
  }
  if (!reel.video_url) {
    const response = NextResponse.json({ error: "Reel video is missing." }, { status: 422 });
    session.applyCookies(response);
    return response;
  }

  try {
    const { accessToken } = await getYoutubeAccessToken(session.user.id);
    const title = body.title || reel.caption || "MediaQuotes Reel";
    const tags = Array.isArray(body.tags) ? body.tags : Array.isArray(reel.hashtags) ? reel.hashtags : [];
    const description = body.description || [reel.caption, tags.join(" ")].filter(Boolean).join("\n\n");

    const uploaded = await uploadYoutubeVideo({
      accessToken,
      videoUrl: reel.video_url,
      title,
      description,
      tags,
      privacyStatus: body.privacyStatus || "unlisted",
    });

    const response = NextResponse.json({ success: true, video: uploaded });
    session.applyCookies(response);
    return response;
  } catch (err) {
    const response = NextResponse.json(
      { error: (err as Error).message || "Unable to publish to YouTube." },
      { status: 500 },
    );
    session.applyCookies(response);
    return response;
  }
}
