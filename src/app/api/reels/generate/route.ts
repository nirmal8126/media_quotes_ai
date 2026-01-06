import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { startReelGeneration } from "@/lib/reels-pipeline";
import {
  generateCaptionContent,
  generateHashtagList,
  generateScriptVariants,
  generateStoryboard,
  generateThumbnailPrompt,
} from "@/lib/reel-service";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";
import { getChannel } from "@/lib/channel-service";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;

  const body = await request.json().catch(() => ({}));
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });
  const channelId = (body.channelId ?? body.channel_id ?? "").trim() || null;
  const channel = channelId ? await getChannel(user.id, channelId).catch(() => null) : null;

  try {
    const result = await startReelGeneration(user, body);

    const topic = body.idea || channel?.topic || channel?.name || "Untitled";
    const tone = body.tone || channel?.tone || "motivational";
    const platform = body.platform || channel?.platform || "INSTAGRAM";

    let variants: null | {
      hooks: string[];
      titles: string[];
      scripts: string[];
      hashtags: string[][];
    } = null;
    let storyboard: null | Array<{ label?: string; text: string; durationMs?: number; visualSuggestion?: string }> = null;
    let caption: { text: string; callToAction: string } | null = null;
    let hashtags: string[] | null = null;
    let thumbnailPrompt: string | null = null;

    if (body.multiVariants) {
      variants = await generateScriptVariants({
        topic,
        tone,
        platform,
        count: Number(body.variantCount) || 3,
        provider,
      });
    }

    if (body.storyboard) {
      storyboard = await generateStoryboard({
        script: result.script.text,
        tone,
        platform,
        provider,
      });
    }

    try {
      const captionResult = await generateCaptionContent(tone, platform, topic, undefined, provider);
      caption = { text: captionResult.caption, callToAction: captionResult.callToAction };
    } catch (err) {
      console.warn("Caption generation failed:", err);
    }
    try {
      hashtags = await generateHashtagList(tone, platform, provider);
    } catch (err) {
      console.warn("Hashtag generation failed:", err);
    }
    try {
      thumbnailPrompt = await generateThumbnailPrompt(tone, platform, provider);
    } catch (err) {
      console.warn("Thumbnail prompt generation failed:", err);
    }

    if (result.reel?.id) {
      const settingsPayload = {
        custom_settings: {
          ...(storyboard?.length ? { storyboard } : {}),
          caption,
          hashtags,
          thumbnailPrompt,
        },
        caption: caption?.text ?? null,
        hashtags: hashtags ?? null,
        thumbnail_prompt: thumbnailPrompt ?? null,
      };
      let { error: settingsError } = await supabaseAdmin
        .from("reels")
        .update(settingsPayload)
        .eq("id", result.reel.id)
        .eq("user_id", user.id);

      if (settingsError) {
        const msg = (settingsError.message || "").toLowerCase();
        if (msg.includes("custom_settings")) {
          const legacyOnly = {
            caption: caption?.text ?? null,
            hashtags: hashtags ?? null,
            thumbnail_prompt: thumbnailPrompt ?? null,
          };
          ({ error: settingsError } = await supabaseAdmin
            .from("reels")
            .update(legacyOnly)
            .eq("id", result.reel.id)
            .eq("user_id", user.id));
        } else if (msg.includes("caption") || msg.includes("hashtags") || msg.includes("thumbnail_prompt")) {
          ({ error: settingsError } = await supabaseAdmin
            .from("reels")
            .update({ custom_settings: settingsPayload.custom_settings })
            .eq("id", result.reel.id)
            .eq("user_id", user.id));
        }
        if (settingsError && !settingsError.message?.toLowerCase().includes("custom_settings")) {
          console.warn("Unable to persist reel metadata:", settingsError.message || settingsError);
        }
      }
    }

    const response = NextResponse.json({
      message: "Reel generation started",
      reel: result.reel,
      script: result.script,
      variants,
      storyboard,
      caption,
      hashtags,
      thumbnailPrompt,
    });
    applyCookies(response);
    return response;
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    const message = (error as Error)?.message || "Unable to start reel generation.";
    console.error("reels/generate failed", error);
    const response = NextResponse.json({ error: message }, { status });
    applyCookies(response);
    return response;
  }
}
