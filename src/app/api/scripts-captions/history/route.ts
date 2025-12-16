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
    .from("scripts")
    .select("id, input_prompt, tone, platform, text, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    const missingTable =
      error.message?.toLowerCase().includes("relation") && error.message?.toLowerCase().includes("does not exist");
    const response = NextResponse.json(
      {
        error: missingTable
          ? 'Missing "scripts" table. Run web/docs/sql/ai_reels_tables.sql in Supabase.'
          : "Failed to load scripts & captions history",
      },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({
    items: (data ?? []).map((row) => ({
      ...row,
      topic: row.input_prompt ?? "Untitled",
      hook: null,
      caption: null,
      hashtags: [],
      script: row.text,
    })),
  });
  applyCookies(response);
  return response;
}
