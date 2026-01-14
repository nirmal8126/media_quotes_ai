import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { isPlatformEnabled } from "@/lib/social/platforms";

type EnqueueRequest = {
  quote_id?: string;
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

  if (!quoteId) {
    const response = NextResponse.json({ error: "quote_id is required." }, { status: 400 });
    session.applyCookies(response);
    return response;
  }

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

  const { data: job, error: jobError } = await supabaseAdmin
    .from("publish_jobs")
    .insert({
      user_id: session.user.id,
      platform: "facebook",
      quote_id: quoteId,
      status: "queued",
      scheduled_at: new Date().toISOString(),
    })
    .select("id, status, scheduled_at, created_at, updated_at")
    .maybeSingle();

  if (jobError) {
    const response = NextResponse.json({ error: "Unable to queue publish job." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true, job });
  session.applyCookies(response);
  return response;
}
