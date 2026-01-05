import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { triggerRenderer } from "@/lib/reels-pipeline";

function clampDuration(value?: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 30;
  return Math.max(5, Math.min(Math.round(num), 180));
}

function mapReelRow(row: Record<string, any>) {
  return {
    id: row.id,
    userId: row.user_id,
    scriptId: row.script_id,
    channelId: row.channel_id ?? null,
    personaId: row.persona_id ?? null,
    platform: row.platform ?? null,
    tone: row.tone ?? null,
    style: row.style ?? null,
    template: row.template ?? null,
    brandColors: row.brand_colors ?? null,
    brandFonts: row.brand_fonts ?? null,
    logoUrl: row.logo_url ?? null,
    endScreenTemplate: row.end_screen_template ?? null,
    audioVoiceId: row.audio_voice_id ?? null,
    musicTrackId: row.music_track_id ?? null,
    trendingAudioId: row.trending_audio_id ?? null,
    durationSec: row.duration_sec ?? null,
    status: row.status ?? null,
    rendererJobId: row.renderer_job_id ?? null,
    videoUrl: row.video_url ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    errorMessage: row.error_message ?? null,
    customSettings: row.custom_settings ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;

  const body = await request.json().catch(() => ({}));
  const reelId = (body.reelId ?? body.id ?? "").toString().trim();
  if (!reelId) {
    const response = NextResponse.json({ error: "reelId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const { data: reelRow, error: reelError } = await supabaseAdmin
    .from("reels")
    .select(
      "id, user_id, script_id, platform, tone, style, template, duration_sec, brand_colors, brand_fonts, logo_url, end_screen_template, audio_voice_id, music_track_id, trending_audio_id",
    )
    .eq("id", reelId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (reelError || !reelRow) {
    const response = NextResponse.json({ error: "Reel not found" }, { status: 404 });
    applyCookies(response);
    return response;
  }

  let scriptText = "";
  if (reelRow.script_id) {
    const { data: scriptRow } = await supabaseAdmin
      .from("scripts")
      .select("text")
      .eq("id", reelRow.script_id)
      .maybeSingle();
    scriptText = scriptRow?.text ?? "";
  }

  if (!scriptText) {
    const response = NextResponse.json({ error: "Reel script not available" }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const durationSec = clampDuration(body.durationSec ?? reelRow.duration_sec);
  const style = typeof body.style === "string" ? body.style.trim() : reelRow.style ?? null;
  const template = typeof body.template === "string" ? body.template.trim() : reelRow.template ?? null;

  const rendererJob = await triggerRenderer({
    scriptText,
    style,
    template,
    brand: {
      colors: Array.isArray(body?.brand?.colors) ? body.brand.colors : reelRow.brand_colors ?? null,
      fonts: Array.isArray(body?.brand?.fonts) ? body.brand.fonts : reelRow.brand_fonts ?? null,
      logoUrl: typeof body?.brand?.logoUrl === "string" ? body.brand.logoUrl : reelRow.logo_url ?? null,
      endScreenTemplate:
        typeof body?.brand?.endScreenTemplate === "string"
          ? body.brand.endScreenTemplate
          : reelRow.end_screen_template ?? null,
    },
    durationSec,
    withVoiceover: body.withVoiceover !== false,
    audio: {
      aiVoiceId: reelRow.audio_voice_id ?? null,
      musicUploadId: reelRow.music_track_id ?? null,
      trendingAudioId: reelRow.trending_audio_id ?? null,
    },
  });

  const nextStatus =
    rendererJob.status === "ready" ? "READY" : rendererJob.status === "failed" ? "FAILED" : "RENDERING";

  const { data: updated, error: updateError } = await supabaseAdmin
    .from("reels")
    .update({
      status: nextStatus,
      renderer_job_id: rendererJob.id,
      video_url: rendererJob.videoUrl ?? null,
      thumbnail_url: rendererJob.thumbnailUrl ?? null,
      error_message: rendererJob.error ?? null,
      duration_sec: durationSec,
      style,
      template,
      custom_settings: body.settings ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reelId)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (updateError || !updated) {
    const response = NextResponse.json({ error: updateError?.message || "Unable to update reel" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ reel: mapReelRow(updated) });
  applyCookies(response);
  return response;
}
