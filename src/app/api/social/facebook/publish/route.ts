import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { decryptToken } from "@/lib/crypto/tokenVault";
import { missingFacebookConfigResponse, publishToFacebook } from "@/lib/social/facebook";
import { publishToFacebook as publishToFacebookWithPageToken } from "@/lib/social/facebookPublish";
import { isPlatformEnabled } from "@/lib/social/platforms";

type PublishBody = {
  message?: string;
  imageDataUrl?: string;
  videoUrl?: string;
  pageId?: string;
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

  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return missingFacebookConfigResponse();
  }

  const body = (await request.json().catch(() => ({}))) as PublishBody;
  const message = typeof body.message === "string" && body.message.trim().length > 0 ? body.message.trim() : "";
  const imageDataUrl = typeof body.imageDataUrl === "string" && body.imageDataUrl.startsWith("data:image/")
    ? body.imageDataUrl
    : undefined;
  const videoUrl = typeof body.videoUrl === "string" && body.videoUrl.trim().startsWith("http")
    ? body.videoUrl.trim()
    : undefined;

  if (!message && !imageDataUrl && !videoUrl) {
    const response = NextResponse.json({ error: "Message, imageDataUrl, or videoUrl is required." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  try {
    const { data: account } = await supabaseAdmin
      .from("social_accounts")
      .select("page_id, page_access_token_encrypted, updated_at")
      .eq("user_id", session.user.id)
      .eq("platform", "facebook")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
    const { data: pageAccount } =
      pageId && (!account || account.page_id !== pageId)
        ? await supabaseAdmin
            .from("social_accounts")
            .select("page_id, page_access_token_encrypted")
            .eq("user_id", session.user.id)
            .eq("platform", "facebook")
            .eq("page_id", pageId)
            .maybeSingle()
        : { data: account };

    if (pageAccount?.page_id && pageAccount?.page_access_token_encrypted) {
      const pageAccessToken = decryptToken(pageAccount.page_access_token_encrypted);
      const result = await publishToFacebookWithPageToken({
        pageId: pageAccount.page_id,
        pageAccessToken,
        message,
        imageDataUrl,
        videoUrl,
      });
      const response = NextResponse.json({ success: true, result });
      session.applyCookies(response);
      return response;
    }

    const result = await publishToFacebook({
      userId: session.user.id,
      message,
      imageDataUrl,
      videoUrl,
      pageId: body.pageId,
    });
    const response = NextResponse.json({ success: true, result });
    session.applyCookies(response);
    return response;
  } catch (err) {
    console.error("Failed to publish to Facebook", err);
    const response = NextResponse.json({ error: "Unable to publish to Facebook." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }
}
