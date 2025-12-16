import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { pickProvider } from "@/lib/llm-provider";
import { defaultProvider } from "@/lib/openai";
import {
  fetchUserQuota,
  generateCaptionContent,
  generateHashtagList,
  generateScriptAssets,
  generateThumbnailPrompt,
  incrementUserQuota,
  storeGeneratedReel,
} from "@/lib/reel-service";

const bestTimes = ["6:30 PM", "12:00 PM", "8:00 PM", "7:15 PM", "9:45 AM"];

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const provider = pickProvider({ user, fallback: defaultProvider });

  // Fetch channels with auto_generate enabled
  const { data: channels, error } = await supabaseAdmin
    .from("channels")
    .select("id, name, platform, tone, auto_generate, auto_generate_count, topic, posting_frequency")
    .eq("user_id", user.id)
    .eq("auto_generate", true);

  if (error) {
    const response = NextResponse.json({ error: "Unable to load channels for auto-run" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const results: Array<{ channelId: string; generated: number }> = [];

  for (const channel of channels ?? []) {
    const count = Math.max(1, Math.min(Number(channel.auto_generate_count) || 5, 30));
    const { quota } = await fetchUserQuota(user.id);
    const remaining = Math.max(0, quota.remaining);
    const toGenerate = Math.min(count, remaining);
    if (toGenerate <= 0) {
      results.push({ channelId: channel.id, generated: 0 });
      continue;
    }

    const now = new Date();
    for (let i = 0; i < toGenerate; i += 1) {
      const tone = channel.tone || "motivational";
      const platform = channel.platform || "instagram";
      const scriptAssets = await generateScriptAssets(tone, platform, provider);
      const caption = await generateCaptionContent(tone, platform, provider);
      const thumbnailPrompt = await generateThumbnailPrompt(tone, platform, provider);
      const hashtags = await generateHashtagList(tone, platform, provider);

      const record = await storeGeneratedReel({
        userId: user.id,
        channelId: channel.id,
        tone,
        platform,
        script: scriptAssets.script,
        shotBreakdown: scriptAssets.shotBreakdown,
        hook: scriptAssets.hook,
        caption: `${caption.caption} ${caption.callToAction}`.trim(),
        hashtags,
        thumbnailPrompt,
        status: "generated",
      });

      if (record?.id) {
        const scheduledDate = new Date(now);
        scheduledDate.setDate(now.getDate() + i);
        await supabaseAdmin.from("content_calendar").insert({
          user_id: user.id,
          channel_id: channel.id,
          reel_id: record.id,
          scheduled_date: scheduledDate.toISOString().split("T")[0],
          best_time: bestTimes[i % bestTimes.length],
          status: "planned",
          platform,
        });
        await incrementUserQuota(user.id);
      }
    }

    results.push({ channelId: channel.id, generated: toGenerate });
  }

  const response = NextResponse.json({ message: "Auto-run complete", results });
  applyCookies(response);
  return response;
}
