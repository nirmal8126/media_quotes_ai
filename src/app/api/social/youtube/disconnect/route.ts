import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { error } = await supabaseAdmin
    .from("social_accounts")
    .delete()
    .eq("user_id", session.user.id)
    .eq("platform", "youtube");

  if (error) {
    const response = NextResponse.json({ error: "Unable to disconnect YouTube." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  session.applyCookies(response);
  return response;
}
