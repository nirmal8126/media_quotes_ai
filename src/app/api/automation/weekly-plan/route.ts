import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { evaluateQuota, normalizePlanTier } from '@/lib/plan';
import {
  generateCaptionContent,
  generateHashtagList,
  generateScriptAssets,
  generateThumbnailPrompt,
  incrementUserQuota,
  storeGeneratedReel,
} from '@/lib/reel-service';
import { requireUser } from '@/lib/api-auth';
import { pickProvider } from '@/lib/llm-provider';
import { defaultProvider } from '@/lib/openai';

const bestTimes = ['6:30 PM', '12:00 PM', '8:00 PM', '7:15 PM', '9:45 AM'];
const tones = ['funny', 'educational', 'emotional'];

function pickTone(index: number) {
  return tones[index % tones.length];
}

export async function POST(request: Request) {
  const sessionResult = await requireUser(request);
  if ('errorResponse' in sessionResult) {
    return sessionResult.errorResponse;
  }

  const { user: sessionUser, applyCookies } = sessionResult;
  const payload = await request.json().catch(() => ({}));
  const requestedUserId = payload.userId;
  const userId = requestedUserId && requestedUserId !== sessionUser.id ? null : sessionUser.id;
  const provider = pickProvider({ bodyProvider: payload.provider, user: sessionUser, fallback: defaultProvider });

  if (!userId) {
    const response = NextResponse.json({ error: 'Unauthorized to run automation for another user' }, { status: 403 });
    applyCookies(response);
    return response;
  }

  const { data: userRow, error } = await supabaseAdmin
    .from('users')
    .select('id, plan_tier, quota_used')
    .eq('id', userId)
    .maybeSingle();

  if (error || !userRow) {
    const response = NextResponse.json({ error: 'Unable to load user' }, { status: 404 });
    applyCookies(response);
    return response;
  }

  const planTier = normalizePlanTier(userRow.plan_tier);
  const quotaStatus = evaluateQuota(planTier, userRow.quota_used);
  const targetBatch = planTier === 'pro' ? 60 : 30;
  const toGenerate = Math.min(Math.max(targetBatch - quotaStatus.used, 0), quotaStatus.remaining);

  if (toGenerate <= 0) {
    const response = NextResponse.json({ message: 'Quota already fulfilled for this cycle', planTier, quotaStatus });
    applyCookies(response);
    return response;
  }

  const generatedEntries: { reelId: string; title: string; scheduledDate: string }[] = [];
  const now = new Date();

  for (let index = 0; index < toGenerate; index += 1) {
    const tone = pickTone(index);
    const platform = 'instagram';

    const scriptAssets = await generateScriptAssets(tone, platform, provider);
    const caption = await generateCaptionContent(tone, platform, provider);
    const thumbnailPrompt = await generateThumbnailPrompt(tone, platform, provider);
    const hashtags = await generateHashtagList(tone, platform, provider);

    const record = await storeGeneratedReel({
      userId,
      tone,
      platform,
      script: scriptAssets.script,
      shotBreakdown: scriptAssets.shotBreakdown,
      hook: scriptAssets.hook,
      caption: caption.caption,
      hashtags,
      thumbnailPrompt,
    });

    if (!record?.id) {
      continue;
    }

    const scheduledDate = new Date(now);
    scheduledDate.setDate(now.getDate() + index * 2);

    await supabaseAdmin.from('content_calendar').insert({
      user_id: userId,
      reel_id: record.id,
      scheduled_date: scheduledDate.toISOString().split('T')[0],
      best_time: bestTimes[index % bestTimes.length],
      status: 'generated',
      platform,
    });

    generatedEntries.push({
      reelId: record.id,
      title: scriptAssets.hook,
      scheduledDate: scheduledDate.toISOString(),
    });

    await incrementUserQuota(userId);
  }

  const nextAuto = new Date(now);
  nextAuto.setDate(now.getDate() + 7);
  await supabaseAdmin.from('users').update({ next_auto_generation: nextAuto.toISOString() }).eq('id', userId);

  const response = NextResponse.json({
    message: 'Auto-plan generated',
    generated: generatedEntries.length,
    planTier,
    nextAutoGeneration: nextAuto.toISOString(),
    entries: generatedEntries,
  });
  applyCookies(response);
  return response;
}
