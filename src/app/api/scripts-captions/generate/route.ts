import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { generateCaptionContent, generateHashtagList, generateScriptAssets, storeGeneratedReel } from "@/lib/reel-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";

type Payload = {
  topic?: string;
  tone?: string;
  platform?: string;
  hook?: string;
  provider?: "openai" | "gemini";
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const body = (await request.json().catch(() => ({}))) as Payload;
  const topic = (body.topic ?? "").trim();
  if (!topic) {
    const response = NextResponse.json({ error: "Topic is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const tone = (body.tone ?? "informative").trim() || "informative";
  const platform = (body.platform ?? "instagram").trim() || "instagram";
  const hook = (body.hook ?? "").trim() || undefined;
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });

  try {
    const scriptResult = await generateScriptAssets(tone, platform, provider);
    const captionResult = await generateCaptionContent(tone, platform, provider);
    const hashtags = await generateHashtagList(tone, platform, provider);

    const saved = await storeGeneratedReel({
      userId: user.id,
      tone,
      platform,
      hook: hook ?? scriptResult.hook,
      script: scriptResult.script,
      caption: `${captionResult.caption} ${captionResult.callToAction}`.trim(),
      hashtags,
      thumbnailPrompt: topic,
    });

    const response = NextResponse.json({
      message: "Generated",
      item: {
        id: saved?.id ?? `local-${Date.now()}`,
        topic,
        tone,
        platform,
        hook: hook ?? scriptResult.hook,
        script: scriptResult.script,
        caption: `${captionResult.caption} ${captionResult.callToAction}`.trim(),
        hashtags,
        created_at: new Date().toISOString(),
      },
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
