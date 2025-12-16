import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireSuperAdmin } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await requireSuperAdmin(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit")) || 200;

  const { data, error } = await supabaseAdmin
    .from("reels")
    .select("id, status, video_url, thumbnail_url, renderer_job_id, script_id, channel_id, created_at, user_id")
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(500, limit)));

  if (error) {
    const response = NextResponse.json({ error: error.message || "Unable to load reels" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ reels: data ?? [] });
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

  const { error } = await supabaseAdmin.from("reels").delete().eq("id", id);
  if (error) {
    const response = NextResponse.json({ error: error.message || "Unable to delete reel" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true });
  applyCookies(response);
  return response;
}
