import { NextResponse } from 'next/server';
import { evaluateQuota } from '@/lib/plan';
import { fetchUserQuota, generateScriptAssets, incrementUserQuota, storeGeneratedReel } from '@/lib/reel-service';
import { requireUser } from '@/lib/api-auth';
import { pickProvider } from '@/lib/llm-provider';
import { defaultProvider } from '@/lib/openai';

export async function POST(request: Request) {
  try {
    const session = await requireUser(request);
    if ('errorResponse' in session) {
      return session.errorResponse;
    }

    const { user, applyCookies } = session;
    const body = await request.json().catch(() => ({}));

    const tone = body.tone ?? 'educational';
    const platform = body.platform ?? 'instagram';
    const channelId = (body.channelId ?? body.channel_id ?? '').trim() || null;
    const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });
    const { user: quotaUser } = await fetchUserQuota(user.id);
    const quota = evaluateQuota(quotaUser.plan_tier, quotaUser.quota_used);

    if (!quota.allowsGeneration) {
      return NextResponse.json({ error: 'Quota exceeded for this plan', quota }, { status: 403 });
    }

    const assets = await generateScriptAssets(tone, platform, provider);
    await storeGeneratedReel({
      userId: user.id,
      channelId,
      tone,
      platform,
      script: assets.script,
      shotBreakdown: assets.shotBreakdown,
      hook: assets.hook,
    });

    const newUsed = await incrementUserQuota(user.id);
    const refreshedQuota = evaluateQuota(quotaUser.plan_tier, newUsed);

    const response = NextResponse.json({
      message: 'Script generated',
      quota: refreshedQuota,
      script: assets.script,
      shotBreakdown: assets.shotBreakdown,
      hook: assets.hook,
    });
    applyCookies(response);
    return response;
  } catch (error) {
    const message = (error as Error).message || 'Unable to generate script';
    console.error('reels/script failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
