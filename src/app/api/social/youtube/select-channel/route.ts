import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

type Body = { channelId?: string; channelName?: string };

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const channelName = typeof body.channelName === "string" ? body.channelName.trim() : "";

  if (!channelId) {
    const response = NextResponse.json({ error: "channelId is required." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .update({
      page_id: channelId,
      page_name: channelName || null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", session.user.id)
    .eq("platform", "youtube")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const response = NextResponse.json({ error: "Unable to save YouTube channel." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  session.applyCookies(response);
  return response;
}
