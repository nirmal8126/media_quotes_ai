import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

type Payload = {
  channelId?: string;
  autoGenerate?: boolean;
  autoGenerateCount?: number;
  postingFrequency?: string;
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as Payload;
  const channelId = (body.channelId ?? "").trim();
  if (!channelId) {
    const response = NextResponse.json({ error: "channelId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const autoGenerate = body.autoGenerate ?? true;
  const autoGenerateCount = Math.max(1, Math.min(Number(body.autoGenerateCount) || 5, 60));
  const postingFrequency = (body.postingFrequency ?? "").trim() || null;

  const { error } = await supabaseAdmin
    .from("channels")
    .update({
      auto_generate: autoGenerate,
      auto_generate_count: autoGenerateCount,
      posting_frequency: postingFrequency,
      updated_at: new Date().toISOString(),
    })
    .eq("id", channelId)
    .eq("user_id", user.id);

  if (error) {
    const response = NextResponse.json({ error: error.message || "Unable to save schedule" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({
    message: "Schedule preferences saved",
    autoGenerate,
    autoGenerateCount,
    postingFrequency,
  });
  applyCookies(response);
  return response;
}
