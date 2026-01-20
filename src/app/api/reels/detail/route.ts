import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

function mapReelRow(row: Record<string, any>) {
  const rawHashtags = row.hashtags ?? row.custom_settings?.hashtags ?? null;
  const hashtags = Array.isArray(rawHashtags)
    ? rawHashtags.filter(Boolean)
    : typeof rawHashtags === "string"
      ? rawHashtags.split(/[,\n]/).map((tag: string) => tag.trim()).filter(Boolean)
      : null;
  return {
    id: row.id,
    status: row.status ?? null,
    platform: row.platform ?? null,
    tone: row.tone ?? null,
    style: row.style ?? null,
    template: row.template ?? null,
    language: row.language ?? null,
    durationSec: row.duration_sec ?? null,
    rendererJobId: row.renderer_job_id ?? null,
    videoUrl: row.video_url ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    customSettings: row.custom_settings ?? null,
    scriptText: row.scripts?.text ?? row.scripts?.[0]?.text ?? null,
    inputPrompt: row.scripts?.input_prompt ?? row.scripts?.[0]?.input_prompt ?? null,
    caption: row.caption ?? row.custom_settings?.caption?.text ?? null,
    hashtags,
    thumbnailPrompt: row.thumbnail_prompt ?? row.custom_settings?.thumbnailPrompt ?? null,
  };
}

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const reelId = searchParams.get("reelId");

  if (!reelId) {
    const response = NextResponse.json({ error: "reelId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const selectBase = `
    id, status, platform, tone, style, template, language, duration_sec, renderer_job_id, video_url, thumbnail_url, error_message,
    caption, hashtags, thumbnail_prompt, custom_settings,
    created_at, updated_at,
    script_id
  `;

  let { data, error } = await supabaseAdmin
    .from("reels")
    .select(selectBase)
    .eq("id", reelId)
    .eq("user_id", user.id)
    .maybeSingle();

  const errorMsg = (error?.message ?? "").toLowerCase();
  if (
    error &&
    (errorMsg.includes("custom_settings") ||
      errorMsg.includes("caption") ||
      errorMsg.includes("hashtags") ||
      errorMsg.includes("language"))
  ) {
    const fallbackSelect = `
      id, status, platform, tone, style, template, duration_sec, renderer_job_id, video_url, thumbnail_url, error_message,
      created_at, updated_at,
      script_id
    `;
    ({ data, error } = await supabaseAdmin
      .from("reels")
      .select(fallbackSelect)
      .eq("id", reelId)
      .eq("user_id", user.id)
      .maybeSingle());
  }

  if (error || !data) {
    const response = NextResponse.json({ error: error?.message || "Unable to load reel" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  let scriptText: string | null = null;
  let inputPrompt: string | null = null;
  if (data?.script_id) {
    const { data: scriptRow } = await supabaseAdmin
      .from("scripts")
      .select("text, input_prompt")
      .eq("id", data.script_id)
      .maybeSingle();
    scriptText = scriptRow?.text ?? null;
    inputPrompt = scriptRow?.input_prompt ?? null;
  }

  const response = NextResponse.json({
    reel: {
      ...mapReelRow(data),
      scriptText,
      inputPrompt,
    },
  });
  applyCookies(response);
  return response;
}
