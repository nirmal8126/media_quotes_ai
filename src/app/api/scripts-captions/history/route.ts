import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireUser } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const { data, error } = await supabaseAdmin
    .from("generated_reels")
    .select("id, tone, platform, hook, script, caption, hashtags, thumbnail_prompt, created_at")
    .eq("user_id", user.id)
    .not("script", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    const response = NextResponse.json({ error: "Failed to load scripts & captions history" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({
    items: (data ?? []).map((row) => ({
      ...row,
      topic: row.thumbnail_prompt ?? "",
    })),
  });
  applyCookies(response);
  return response;
}
