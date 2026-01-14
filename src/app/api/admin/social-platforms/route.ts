import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

type UpdateBody = {
  platform?: string;
  enabled?: boolean;
};

export async function GET(request: Request) {
  const session = await requireSuperAdmin(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { data, error } = await supabaseAdmin
    .from("social_platforms")
    .select("platform, name, overview, enabled, updated_at")
    .order("name", { ascending: true });

  if (error) {
    const response = NextResponse.json({ error: "Unable to load social platforms." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ platforms: data ?? [] });
  session.applyCookies(response);
  return response;
}

export async function PATCH(request: Request) {
  const session = await requireSuperAdmin(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const body = (await request.json().catch(() => ({}))) as UpdateBody;
  const platform = typeof body.platform === "string" ? body.platform.trim().toLowerCase() : "";

  if (!platform || typeof body.enabled !== "boolean") {
    const response = NextResponse.json({ error: "platform and enabled are required." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from("social_platforms")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq("platform", platform)
    .select("platform, name, overview, enabled, updated_at")
    .maybeSingle();

  if (error || !data) {
    const response = NextResponse.json({ error: "Unable to update social platform." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ platform: data });
  session.applyCookies(response);
  return response;
}
