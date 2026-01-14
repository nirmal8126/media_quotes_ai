import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isPlatformEnabled } from "@/lib/social/platforms";

export async function GET(request: Request) {
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

  const { data, error } = await supabaseAdmin
    .from("social_accounts")
    .select("page_id, page_name, updated_at")
    .eq("user_id", session.user.id)
    .eq("platform", "facebook")
    .order("updated_at", { ascending: false });

  if (error) {
    const response = NextResponse.json({ error: "Unable to load connected Facebook pages." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ pages: data ?? [] });
  session.applyCookies(response);
  return response;
}
