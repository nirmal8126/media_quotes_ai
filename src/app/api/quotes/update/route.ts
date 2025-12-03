import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateQuotesList } from "@/lib/quote-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";

type UpdatePayload = {
  id?: string;
  topic?: string | null;
  tone?: string | null;
  persona?: string | null;
  language?: string | null;
  style?: string | null;
  quotes?: string[];
  count?: number;
  provider?: "openai" | "gemini";
};

export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as UpdatePayload;
  const { id } = body;
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });

  if (!id) {
    const response = NextResponse.json({ error: "Quote id is required." }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.topic === "string") {
    const topic = body.topic.trim();
    updates.topic = topic.length > 0 ? topic : "Untitled";
  }
  if (typeof body.tone === "string") updates.tone = body.tone || null;
  if (typeof body.persona === "string") updates.persona = body.persona || null;
  if (typeof body.language === "string") updates.language = body.language || null;
  if (typeof body.style === "string") updates.style = body.style || null;
  if (Array.isArray(body.quotes)) updates.quotes = body.quotes;

  const requestedCount =
    typeof body.count === "number" && Number.isFinite(body.count) ? Math.max(1, Math.min(body.count, 5)) : null;
  if (requestedCount) {
    try {
      const topicText =
        typeof updates.topic === "string"
          ? updates.topic
          : typeof body.topic === "string" && body.topic.trim()
            ? body.topic.trim()
            : "Untitled";
      const generated = await generateQuotesList({
        topic: topicText,
        tone: (typeof body.tone === "string" && body.tone) || undefined,
        persona: (typeof body.persona === "string" && body.persona) || undefined,
        language: (typeof body.language === "string" && body.language) || "en",
        count: requestedCount,
        provider,
      });
      updates.quotes = generated;
    } catch (err) {
      console.error("Failed to regenerate quotes during update", err);
      const response = NextResponse.json({ error: "Unable to regenerate quotes." }, { status: 500 });
      applyCookies(response);
      return response;
    }
  }

  if (Object.keys(updates).length === 0) {
    const response = NextResponse.json({ error: "No fields to update." }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from("quotes")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, topic, persona, tone, language, style, quotes, created_at")
    .maybeSingle();

  if (error) {
    console.error("Failed to update quote pack", error);
    const response = NextResponse.json({ error: "Unable to update quote pack." }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ success: true, quote: data });
  applyCookies(response);
  return response;
}
