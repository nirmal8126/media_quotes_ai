import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { getChannel } from '@/lib/channel-service';
import { pickProvider } from '@/lib/llm-provider';
import { defaultProvider } from '@/lib/openai';
import {
  fetchUserQuota,
  generateCaptionContent,
  generateHashtagList,
  generateScriptAssets,
  generateThumbnailPrompt,
  incrementUserQuota,
  storeGeneratedReel,
} from '@/lib/reel-service';
import { supabaseAdmin } from '@/lib/supabase';

const bestTimes = ['6:30 PM', '12:00 PM', '8:00 PM', '7:15 PM', '9:45 AM'];

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const body = await request.json().catch(() => ({}));

  const channelId = (body.channelId ?? body.channel_id ?? '').trim();
  const requestedCount = Number(body.count) || 5;
  const spacingDays = Math.max(1, Math.min(Number(body.spacingDays) || 1, 14));
  const startDateInput = (body.startDate ?? body.start_date ?? '').trim();
  const startDate = startDateInput ? new Date(startDateInput) : new Date();

  if (!channelId) {
    const response = NextResponse.json({ error: 'channelId is required for bulk generation' }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const channel = await getChannel(user.id, channelId);
  if (!channel) {
    const response = NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    applyCookies(response);
    return response;
  }

  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });
  const { quota } = await fetchUserQuota(user.id);
  const remaining = Math.max(quota.remaining, 0);
  const toGenerate = Math.max(0, Math.min(requestedCount, remaining || requestedCount, 50));
  if (toGenerate <= 0) {
    const response = NextResponse.json({ message: 'Quota exhausted', generated: 0 });
    applyCookies(response);
    return response;
  }

  const generatedEntries: Array<{ reelId: string; title: string; scheduledDate: string }> = [];
  let currentDate = startDate;

  for (let i = 0; i < toGenerate; i += 1) {
    const tone = body.tone || channel.tone || 'motivational';
    const platform = body.platform || channel.platform || 'instagram';

    const scriptAssets = await generateScriptAssets(tone, platform, provider);
    const caption = await generateCaptionContent(tone, platform, provider);
    const thumbnailPrompt = await generateThumbnailPrompt(tone, platform, provider);
    const hashtags = await generateHashtagList(tone, platform, provider);

    const saved = await storeGeneratedReel({
      userId: user.id,
      channelId,
      tone,
      platform,
      hook: scriptAssets.hook,
      script: scriptAssets.script,
      shotBreakdown: scriptAssets.shotBreakdown,
      caption: `${caption.caption} ${caption.callToAction}`.trim(),
      hashtags,
      thumbnailPrompt,
      status: 'generated',
      scheduledDate: currentDate.toISOString().split('T')[0],
    });

    if (saved?.id) {
      const bestTime = bestTimes[i % bestTimes.length];
      await supabaseAdmin.from('content_calendar').insert({
        user_id: user.id,
        reel_id: saved.id,
        channel_id: channelId,
        scheduled_date: currentDate.toISOString().split('T')[0],
        best_time: bestTime,
        status: 'planned',
        platform,
      });

      generatedEntries.push({
        reelId: saved.id,
        title: scriptAssets.hook,
        scheduledDate: currentDate.toISOString(),
      });
      await incrementUserQuota(user.id);
    }

    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + spacingDays);
  }

  const response = NextResponse.json({
    message: 'Bulk generation complete',
    requested: requestedCount,
    generated: generatedEntries.length,
    entries: generatedEntries,
  });
  applyCookies(response);
  return response;
}
