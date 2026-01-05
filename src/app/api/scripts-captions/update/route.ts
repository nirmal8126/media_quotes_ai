import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { generateCaptionContent, generateHashtagList, generateScriptAssets } from "@/lib/reel-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";
import { normalizeScriptCaptionRequest } from "@/lib/generation-normalize";
import type { ScriptCaptionRequest } from "@/types/generation";

type UpdatePayload = {
  id?: string;
  description?: string;
  topic?: string;
  tone?: string;
  platform?: string;
  hook?: string;
  script?: string;
  caption?: string;
  hashtags?: string[];
  regenerate?: boolean;
  provider?: "openai" | "gemini";
  length?: string;
  contentType?: string;
  persona?: string;
  language?: string;
  variations?: number;
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
  const normalized: ScriptCaptionRequest = normalizeScriptCaptionRequest({
    contentType: body.contentType as ScriptCaptionRequest["contentType"],
    platform: (body.platform as ScriptCaptionRequest["platform"]) ?? undefined,
    description: body.description ?? body.topic ?? "",
    tone: body.tone as ScriptCaptionRequest["tone"],
    length: body.length as ScriptCaptionRequest["length"],
    persona: body.persona ?? undefined,
    language: body.language ?? undefined,
    variations: body.variations,
  });
  const topic = normalized.description;
  const tone = normalized.tone;
  const platform = normalized.platform;
  const hook = (body.hook ?? "").trim();
  const updates: Record<string, unknown> = {};

  if (topic) updates.thumbnail_prompt = topic;
  if (tone) updates.tone = tone;
  if (platform) updates.platform = platform;
  if (hook) updates.hook = hook;

  const regenerate = Boolean(body.regenerate);

  if (regenerate) {
    try {
      const scriptResult = await generateScriptAssets(
        tone || "informative",
        platform || "instagram",
        topic,
        hook,
        provider,
      );
      const captionResult = await generateCaptionContent(
        tone || "informative",
        platform || "instagram",
        topic,
        hook,
        provider,
      );
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

  let targetItem: any = null;
  let updateError: string | null = null;

  const scriptUpdates: Record<string, unknown> = {};
  if (updates.tone) scriptUpdates.tone = updates.tone;
  if (updates.platform) scriptUpdates.platform = updates.platform;
  if (updates.script) {
    scriptUpdates.text = updates.script;
    scriptUpdates.script = updates.script; // fallback column name
  }
  if (topic) scriptUpdates.input_prompt = topic;
  if (updates.hook) scriptUpdates.hook = updates.hook;
  if (updates.audience) scriptUpdates.audience = updates.audience;

  const { data: scriptRow, error: scriptErr } = await supabaseAdmin
    .from("scripts")
    .update({ ...scriptUpdates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (scriptErr) {
    const msg = scriptErr.message?.toLowerCase() || "";
    const retryPayload = { ...scriptUpdates };
    if (msg.includes("hook")) delete (retryPayload as any).hook;
    if (msg.includes("audience")) delete (retryPayload as any).audience;

    // Fallback: try updating "script" column if "text" is missing in schema cache
    if (msg.includes("text") && msg.includes("column")) {
      const { data: retryRow, error: retryErr } = await supabaseAdmin
        .from("scripts")
        .update({ ...retryPayload, text: undefined, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .maybeSingle();

      if (retryErr) {
        updateError = retryErr.message;
      } else {
        targetItem = retryRow;
      }
    } else {
      const { data: retryRow, error: retryErr } = await supabaseAdmin
        .from("scripts")
        .update({ ...retryPayload, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*")
        .maybeSingle();

      if (retryErr) {
        updateError = retryErr.message;
      } else {
        targetItem = retryRow;
      }
    }
  } else {
    targetItem = scriptRow;
  }

  if (updateError) {
    console.error("Failed to update script/caption", updateError);
    const response = NextResponse.json({ error: "Unable to update script/caption." }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({
    item: {
      id: targetItem?.id ?? id,
      tone: targetItem?.tone ?? tone,
      platform: targetItem?.platform ?? platform,
      hook,
      audience: targetItem?.audience ?? updates.audience ?? "",
      script: targetItem?.text ?? targetItem?.script ?? updates.script ?? "",
      caption: updates.caption ?? "",
      hashtags: updates.hashtags ?? [],
      topic: targetItem?.input_prompt ?? topic,
      created_at: targetItem?.created_at ?? new Date().toISOString(),
    },
  });
  applyCookies(response);
  return response;
}
