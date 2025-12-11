import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import {
  listManagedFacebookPages,
  missingFacebookConfigResponse,
  savePreferredFacebookPage,
} from "@/lib/social/facebook";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  if (!process.env.FACEBOOK_APP_ID || !process.env.FACEBOOK_APP_SECRET) {
    return missingFacebookConfigResponse();
  }

  try {
    const pages = await listManagedFacebookPages(session.user.id);
    const response = NextResponse.json({
      pages: pages.pages,
      selectedPageId: pages.selectedPageId,
      selectedPageName: pages.selectedPageName,
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
