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
    const response = NextResponse.json({ error: "ID is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  // Try generated_reels first
  let deletionError: string | null = null;
  const { error } = await supabaseAdmin.from("generated_reels").delete().eq("id", id).eq("user_id", user.id);
  if (error) {
    // Fallback to scripts table if generated_reels is missing
    const { error: scriptError } = await supabaseAdmin.from("scripts").delete().eq("id", id).eq("user_id", user.id);
    if (scriptError) {
      deletionError = scriptError.message || error.message;
    }
  }

  if (deletionError) {
    console.error("Failed to delete script/caption", deletionError);
    const response = NextResponse.json({ error: "Unable to delete script/caption." }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  applyCookies(response);
  return response;
}
