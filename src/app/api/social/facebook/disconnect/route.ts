import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isPlatformEnabled } from "@/lib/social/platforms";

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

  const { error } = await supabaseAdmin
    .from("social_accounts")
    .delete()
    .eq("user_id", session.user.id)
    .eq("platform", "facebook");

  if (error) {
    const response = NextResponse.json({ error: "Unable to disconnect Facebook." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ connected: false });
  session.applyCookies(response);
  return response;
}
