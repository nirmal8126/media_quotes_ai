import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { missingFacebookConfigResponse, publishToFacebook } from "@/lib/social/facebook";
import { isPlatformEnabled } from "@/lib/social/platforms";

type PublishBody = {
  message?: string;
  imageDataUrl?: string;
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

  if (!message && !imageDataUrl) {
    const response = NextResponse.json({ error: "Message or imageDataUrl is required." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  try {
    const result = await publishToFacebook({
      userId: session.user.id,
      message,
      imageDataUrl,
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
