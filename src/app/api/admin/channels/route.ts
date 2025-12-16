import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireSuperAdmin } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await requireSuperAdmin(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;

  const { data, error } = await supabaseAdmin
    .from("channels")
    .select(
      "id, name, platform, handle, tone, style, persona_id, topic, audience, content_type, duration_default, cta_default, base_hashtags, character_name, character_images, logo_url, created_at, user_id",
    )
    .order("created_at", { ascending: false });

  if (error) {
    const response = NextResponse.json({ error: error.message || "Unable to load channels" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ channels: data ?? [] });
  applyCookies(response);
  return response;
}

export async function DELETE(request: Request) {
  const session = await requireSuperAdmin(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    const response = NextResponse.json({ error: "ID is required" }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const { error } = await supabaseAdmin.from("channels").delete().eq("id", id);
  if (error) {
    const response = NextResponse.json({ error: error.message || "Unable to delete channel" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  applyCookies(response);
  return response;
}
