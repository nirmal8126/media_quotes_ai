import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isPlatformEnabled } from "@/lib/social/platforms";

type PublishRequest = {
  userId?: string;
  quoteId?: string;
  scheduledAt?: string | null;
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const enabled = await isPlatformEnabled("facebook");
  if (!enabled) {
    const response = NextResponse.json({ error: "Facebook is currently disabled." }, { status: 403 });
    applyCookies(response);
    return response;
  }

  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as PublishRequest;
  const quoteId = typeof body.quoteId === "string" ? body.quoteId.trim() : "";

  if (body.userId && body.userId !== user.id) {
    const response = NextResponse.json({ error: "Unauthorized user." }, { status: 403 });
    applyCookies(response);
    return response;
  }

  if (!quoteId) {
    const response = NextResponse.json({ error: "quoteId is required." }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const { data: quote, error: quoteError } = await supabaseAdmin
    .from("quotes")
    .select("id")
    .eq("id", quoteId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (quoteError || !quote) {
    const response = NextResponse.json({ error: "Quote not found." }, { status: 404 });
    applyCookies(response);
    return response;
  }

  const scheduledAt = typeof body.scheduledAt === "string" ? body.scheduledAt.trim() : "";
  const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
  const scheduledIso = scheduledDate && !Number.isNaN(scheduledDate.getTime()) ? scheduledDate.toISOString() : null;

  const { data: job, error: jobError } = await supabaseAdmin
    .from("publish_jobs")
    .insert({
      user_id: user.id,
      platform: "facebook",
      entity_type: "quote",
      entity_id: quoteId,
      status: "queued",
      scheduled_at: scheduledIso,
    })
    .select("id, status, scheduled_at, created_at, updated_at, attempts")
    .maybeSingle();

  if (jobError) {
    const response = NextResponse.json({ error: "Unable to queue publish job." }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true, job });
  applyCookies(response);
  return response;
}
