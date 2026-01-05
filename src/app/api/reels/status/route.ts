import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { fetchReelStatus } from "@/lib/reels-pipeline";
import { supabaseAdmin } from "@/lib/supabase";

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

  try {
    const reel = await fetchReelStatus(user.id, reelId);
    const response = NextResponse.json({ reel });
    applyCookies(response);
    return response;
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = (error as Error)?.message || "Unable to fetch reel status.";
    const response = NextResponse.json({ error: message }, { status });
    applyCookies(response);
    return response;
  }
}

function clampDuration(value?: unknown) {
  const num = Number(value);
  if (!Number.isFinite(num)) return undefined;
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
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function isMissingCustomSettings(err: { message?: string | null }) {
  const msg = err?.message?.toLowerCase() ?? "";
  return msg.includes("custom_settings");
}

export async function PATCH(request: Request) {
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

  const normalizedPlatform = typeof body.platform === "string" ? body.platform.trim().toUpperCase() : undefined;
  const normalizedTone = typeof body.tone === "string" ? body.tone.trim() : undefined;
  const normalizedStyle = typeof body.style === "string" ? body.style.trim() : undefined;
  const normalizedTemplate = typeof body.template === "string" ? body.template.trim() : undefined;
  const normalizedStatus = typeof body.status === "string" ? body.status.trim().toUpperCase() : undefined;

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (normalizedPlatform) updates.platform = normalizedPlatform;
  if (normalizedTone) updates.tone = normalizedTone;
  if (normalizedStyle) updates.style = normalizedStyle;
  if (normalizedTemplate) updates.template = normalizedTemplate;
  if (normalizedStatus) updates.status = normalizedStatus;

  const duration = clampDuration(body.durationSec ?? body.duration_sec);
  if (duration !== undefined) updates.duration_sec = duration;

  if (Array.isArray(body.brandColors)) updates.brand_colors = body.brandColors;
  if (Array.isArray(body.brandFonts)) updates.brand_fonts = body.brandFonts;
  if (typeof body.logoUrl === "string") updates.logo_url = body.logoUrl || null;
  if (typeof body.endScreenTemplate === "string") updates.end_screen_template = body.endScreenTemplate || null;
  if (typeof body.audioVoiceId === "string") updates.audio_voice_id = body.audioVoiceId || null;
  if (typeof body.musicTrackId === "string") updates.music_track_id = body.musicTrackId || null;
  if (typeof body.trendingAudioId === "string") updates.trending_audio_id = body.trendingAudioId || null;
  if (typeof body.thumbnailUrl === "string") updates.thumbnail_url = body.thumbnailUrl || null;
  if (typeof body.videoUrl === "string") updates.video_url = body.videoUrl || null;

  // Persist raw customization payload in custom_settings jsonb when available.
  if (body.settings !== undefined) {
    updates.custom_settings = body.settings;
  }

  if (Object.keys(updates).length === 1) {
    const response = NextResponse.json({ error: "No fields to update" }, { status: 422 });
    applyCookies(response);
    return response;
  }

  async function doUpdate(includeSettings: boolean) {
    const payload = { ...updates };
    if (!includeSettings) {
      delete payload.custom_settings;
    }
    return supabaseAdmin
      .from("reels")
      .update(payload)
      .eq("id", reelId)
      .eq("user_id", user.id)
      .select("*")
      .maybeSingle();
  }

  let settingsPersisted = true;
  let { data, error } = await doUpdate(true);
  if (error && isMissingCustomSettings(error)) {
    settingsPersisted = false;
    ({ data, error } = await doUpdate(false));
  }

  if (error || !data) {
    const response = NextResponse.json(
      { error: error?.message || "Unable to update reel." },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }

  let reel;
  let fetchError: Error | null = null;
  try {
    reel = await fetchReelStatus(user.id, reelId);
  } catch (err) {
    fetchError = err as Error;
    reel = mapReelRow(data);
  }
  const action = typeof body.action === "string" ? body.action : "updated";
  const response = NextResponse.json({
    message: fetchError ? `Reel ${action}; status fetch failed` : `Reel ${action}`,
    reel,
    settingsPersisted,
  });
  applyCookies(response);
  return response;
}
