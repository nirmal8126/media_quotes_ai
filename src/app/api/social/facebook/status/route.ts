import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { getSocialToken } from "@/lib/social/facebook";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  try {
    const token = await getSocialToken(session.user.id, "facebook");
    const response = NextResponse.json({
      connected: Boolean(token),
      pageId: token?.page_id ?? null,
      pageName: (token?.metadata as { page_name?: string } | null)?.page_name ?? null,
    });
    session.applyCookies(response);
    return response;
  } catch (err) {
    console.error("Failed to fetch Facebook status", err);
    const response = NextResponse.json({ error: "Unable to fetch Facebook status" }, { status: 500 });
    session.applyCookies(response);
    return response;
  }
}
