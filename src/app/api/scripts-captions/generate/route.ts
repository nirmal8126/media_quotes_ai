import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { generateCaptionContent, generateHashtagList, generateScriptAssets, storeGeneratedReel } from "@/lib/reel-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";
import { normalizeScriptCaptionRequest } from "@/lib/generation-normalize";
import type { ScriptCaptionRequest } from "@/types/generation";

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

  try {
    const scriptResult = await generateScriptAssets(normalized.tone, normalized.platform, provider);
    const captionResult = await generateCaptionContent(normalized.tone, normalized.platform, provider);
    const hashtags = await generateHashtagList(normalized.tone, normalized.platform, provider);

    const saved = await storeGeneratedReel({
      userId: user.id,
      channelId,
      tone: normalized.tone,
      platform: normalized.platform,
      hook: hook ?? scriptResult.hook,
      script: scriptResult.script,
      caption: `${captionResult.caption} ${captionResult.callToAction}`.trim(),
      hashtags,
      thumbnailPrompt: normalized.description,
    });

    const response = NextResponse.json({
      message: "Generated",
      normalized,
      variations: [
        {
          id: saved?.id ?? `local-${Date.now()}`,
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
