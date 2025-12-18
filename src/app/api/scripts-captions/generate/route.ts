import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { generateCaptionContent, generateHashtagList, generateScriptAssets, storeGeneratedReel } from "@/lib/reel-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";
import { normalizeScriptCaptionRequest } from "@/lib/generation-normalize";
import type { ScriptCaptionRequest } from "@/types/generation";
import { supabaseAdmin } from "@/lib/supabase";

type Payload = {
  topic?: string;
  description?: string;
  tone?: string;
  platform?: string;
  contentType?: string;
  length?: string;
  persona?: string;
  language?: string;
  hook?: string;
  variations?: number;
  provider?: "openai" | "gemini";
  script?: string;
  caption?: string;
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as Payload;
  const normalized: ScriptCaptionRequest = normalizeScriptCaptionRequest({
    contentType: body.contentType as ScriptCaptionRequest["contentType"],
    platform: body.platform as ScriptCaptionRequest["platform"],
    description: body.description ?? body.topic ?? "",
    tone: body.tone as ScriptCaptionRequest["tone"],
    length: body.length as ScriptCaptionRequest["length"],
    persona: body.persona ?? undefined,
    language: body.language ?? undefined,
    variations: body.variations,
  });
  if (!normalized.description) {
    const response = NextResponse.json({ error: "Topic/description is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const hook = (body.hook ?? "").trim() || undefined;
  const channelId = (body.channelId ?? body.channel_id ?? "").trim() || null;
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });
  const userScript = typeof body.script === "string" ? body.script.trim() : "";
  const userCaption = typeof body.caption === "string" ? body.caption.trim() : "";

  try {
    const scriptResult = userScript
      ? { script: userScript, shotBreakdown: [], hook: hook ?? "" }
      : await generateScriptAssets(normalized.tone, normalized.platform, normalized.description, hook, provider);
    const captionResult = userCaption
      ? { caption: userCaption, callToAction: "" }
      : await generateCaptionContent(normalized.tone, normalized.platform, normalized.description, hook, provider);
    const hashtags = await generateHashtagList(normalized.tone, normalized.platform, provider);

    const saved = await storeGeneratedReel({
      userId: user.id,
      channelId,
      status: "generated",
      tone: normalized.tone,
      platform: normalized.platform,
      hook: hook ?? scriptResult.hook,
      script: scriptResult.script,
      caption: `${captionResult.caption} ${captionResult.callToAction}`.trim(),
      hashtags,
      thumbnailPrompt: normalized.description,
    });

    let recordId = saved?.id ?? null;

    // Fallback: persist to scripts table if generated_reels is missing
    if (!recordId) {
      const { data, error } = await supabaseAdmin
        .from("scripts")
        .insert({
          user_id: user.id,
          platform: normalized.platform,
          tone: normalized.tone,
          input_prompt: normalized.description,
          text: scriptResult.script,
          created_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (!error) {
        recordId = data?.id ?? null;
      }
    }

    const response = NextResponse.json({
      message: "Generated",
      normalized,
      variations: [
        {
          id: recordId ?? `local-${Date.now()}`,
          topic: normalized.description,
          tone: normalized.tone,
          platform: normalized.platform,
          hook: hook ?? scriptResult.hook,
          script: scriptResult.script,
          caption: `${captionResult.caption} ${captionResult.callToAction}`.trim(),
          hashtags,
          created_at: new Date().toISOString(),
        },
      ],
    });
    applyCookies(response);
    return response;
  } catch (err) {
    console.error("Failed to generate script/caption", err);
    const response = NextResponse.json({ error: "Unable to generate script/caption" }, { status: 500 });
    applyCookies(response);
    return response;
  }
}
