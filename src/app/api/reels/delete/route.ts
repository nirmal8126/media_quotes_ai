import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function DELETE(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    const response = NextResponse.json({ error: "Reel id is required." }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const { error } = await supabaseAdmin.from("reels").delete().eq("id", id).eq("user_id", user.id);

  if (error) {
    const response = NextResponse.json({ error: error.message || "Unable to delete reel." }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  applyCookies(response);
  return response;
}
