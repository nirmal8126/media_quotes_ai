import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

type Payload = {
  reelId?: string;
  platforms?: string[];
  bestTime?: string;
  status?: string;
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as Payload;
  const reelId = (body.reelId ?? "").trim();
  const platforms = Array.isArray(body.platforms)
    ? body.platforms.map((p) => String(p || "").trim()).filter(Boolean)
    : [];
  if (!reelId || platforms.length === 0) {
    const response = NextResponse.json({ error: "reelId and platforms[] are required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const entries = platforms.map((platform) => ({
    user_id: user.id,
    reel_id: reelId,
    scheduled_date: new Date().toISOString().slice(0, 10),
    best_time: body.bestTime || "Best time TBD",
    status: body.status || "planned",
    platform,
  }));

  const { error } = await supabaseAdmin.from("content_calendar").insert(entries);
  if (error) {
    const response = NextResponse.json({ error: error.message || "Unable to create cross-post entries" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ message: "Cross-post tasks created", entries: platforms.length });
  applyCookies(response);
  return response;
}
