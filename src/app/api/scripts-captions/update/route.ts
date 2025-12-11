import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCaptionContent, generateHashtagList, generateScriptAssets } from "@/lib/reel-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";

type UpdatePayload = {
  id?: string;
  topic?: string;
  tone?: string;
  platform?: string;
  hook?: string;
  script?: string;
  caption?: string;
  hashtags?: string[];
  regenerate?: boolean;
  provider?: "openai" | "gemini";
};

export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as UpdatePayload;
  const id = body.id?.trim();
  if (!id) {
    const response = NextResponse.json({ error: "ID is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });
  const topic = (body.topic ?? "").trim();
  const tone = (body.tone ?? "").trim();
  const platform = (body.platform ?? "").trim();
  const hook = (body.hook ?? "").trim();
  const updates: Record<string, unknown> = {};

  if (topic) updates.thumbnail_prompt = topic;
  if (tone) updates.tone = tone;
  if (platform) updates.platform = platform;
  if (hook) updates.hook = hook;

  const regenerate = Boolean(body.regenerate);

  if (regenerate) {
    try {
      const scriptResult = await generateScriptAssets(tone || "informative", platform || "instagram", provider);
      const captionResult = await generateCaptionContent(tone || "informative", platform || "instagram", provider);
      const hashtags = await generateHashtagList(tone || "informative", platform || "instagram", provider);
      updates.script = scriptResult.script;
      updates.hook = hook || scriptResult.hook || null;
      updates.caption = `${captionResult.caption} ${captionResult.callToAction}`.trim();
      updates.hashtags = hashtags;
    } catch (err) {
      console.error("Failed to regenerate script/caption", err);
      const response = NextResponse.json({ error: "Unable to regenerate script/caption." }, { status: 500 });
      applyCookies(response);
      return response;
    }
  } else {
    if (typeof body.script === "string") updates.script = body.script.trim();
    if (typeof body.caption === "string") updates.caption = body.caption.trim();
    if (Array.isArray(body.hashtags)) updates.hashtags = body.hashtags.map((h) => h.trim()).filter(Boolean);
  }

  if (Object.keys(updates).length === 0) {
    const response = NextResponse.json({ error: "No fields to update." }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from("generated_reels")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, tone, platform, hook, script, caption, hashtags, thumbnail_prompt, created_at")
    .maybeSingle();

  if (error) {
    console.error("Failed to update script/caption", error);
    const response = NextResponse.json({ error: "Unable to update script/caption." }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({
    item: {
      ...data,
      topic: data?.thumbnail_prompt ?? "",
    },
  });
  applyCookies(response);
  return response;
}
