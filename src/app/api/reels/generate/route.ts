import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { startReelGeneration } from "@/lib/reels-pipeline";
import { generateScriptVariants, generateStoryboard } from "@/lib/reel-service";
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

    let variants: null | {
      hooks: string[];
      titles: string[];
      scripts: string[];
      hashtags: string[][];
    } = null;
    let storyboard: null | Array<{ label?: string; text: string; durationMs?: number; visualSuggestion?: string }> = null;

    if (body.multiVariants) {
      variants = await generateScriptVariants({
        topic: body.idea || channel?.topic || channel?.name || "Untitled",
        tone: body.tone || channel?.tone || "motivational",
        platform: body.platform || channel?.platform || "INSTAGRAM",
        count: Number(body.variantCount) || 3,
        provider,
      });
    }

    if (body.storyboard) {
      storyboard = await generateStoryboard({
        script: result.script.text,
        tone: body.tone || channel?.tone || "motivational",
        platform: body.platform || channel?.platform || "INSTAGRAM",
        provider,
      });
      if (result.reel?.id && storyboard?.length) {
        const { error: settingsError } = await supabaseAdmin
          .from("reels")
          .update({ custom_settings: { storyboard } })
          .eq("id", result.reel.id)
          .eq("user_id", user.id);
        if (settingsError && !settingsError.message?.toLowerCase().includes("custom_settings")) {
          console.warn("Unable to persist storyboard in custom_settings:", settingsError.message || settingsError);
        }
      }
    }

    const response = NextResponse.json({
      message: "Reel generation started",
      reel: result.reel,
      script: result.script,
      variants,
      storyboard,
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
