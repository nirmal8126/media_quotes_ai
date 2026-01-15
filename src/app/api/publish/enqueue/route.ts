import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isPlatformEnabled } from "@/lib/social/platforms";

type EnqueueRequest = {
  quote_id?: string;
  reel_id?: string;
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const enabled = await isPlatformEnabled("facebook");
  if (!enabled) {
    const response = NextResponse.json({ error: "Facebook is currently disabled." }, { status: 403 });
    session.applyCookies(response);
    return response;
  }

  const body = (await request.json().catch(() => ({}))) as EnqueueRequest;
  const quoteId = typeof body.quote_id === "string" ? body.quote_id.trim() : "";
  const reelId = typeof body.reel_id === "string" ? body.reel_id.trim() : "";

  if (!quoteId && !reelId) {
    const response = NextResponse.json({ error: "quote_id or reel_id is required." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  if (quoteId && reelId) {
    const response = NextResponse.json({ error: "Provide only one of quote_id or reel_id." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

  if (quoteId) {
    const { data: quote, error: quoteError } = await supabaseAdmin
      .from("quotes")
      .select("id")
      .eq("id", quoteId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (quoteError || !quote) {
      const response = NextResponse.json({ error: "Quote not found." }, { status: 404 });
      session.applyCookies(response);
      return response;
    }
  }

  if (reelId) {
    const { data: reel, error: reelError } = await supabaseAdmin
      .from("reels")
      .select("id")
      .eq("id", reelId)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (reelError || !reel) {
      const response = NextResponse.json({ error: "Reel not found." }, { status: 404 });
      session.applyCookies(response);
      return response;
    }
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from("publish_jobs")
    .insert({
      user_id: session.user.id,
      platform: "facebook",
      quote_id: quoteId || null,
      reel_id: reelId || null,
      status: "queued",
      scheduled_at: new Date().toISOString(),
    })
    .select("id, status, scheduled_at, created_at, updated_at")
    .maybeSingle();

  if (jobError) {
    console.error("Failed to queue publish job", { message: jobError.message, details: jobError.details });
    const response = NextResponse.json(
      { error: jobError.message || "Unable to queue publish job." },
      { status: 500 },
    );
    session.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true, job });
  session.applyCookies(response);
  return response;
}
