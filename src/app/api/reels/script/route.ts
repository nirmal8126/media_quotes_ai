import { NextResponse } from 'next/server';
import { evaluateQuota } from '@/lib/plan';
import { fetchUserQuota, generateScriptAssets, incrementUserQuota, storeGeneratedReel } from '@/lib/reel-service';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = body.userId;

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const tone = body.tone ?? 'educational';
    const platform = body.platform ?? 'instagram';
    const { user } = await fetchUserQuota(userId);
    const quota = evaluateQuota(user.plan_tier, user.quota_used);

    if (!quota.allowsGeneration) {
      return NextResponse.json({ error: 'Quota exceeded for this plan', quota }, { status: 403 });
    }

    const assets = await generateScriptAssets(tone, platform);
    await storeGeneratedReel({
      userId,
      tone,
      platform,
      script: assets.script,
      shotBreakdown: assets.shotBreakdown,
      hook: assets.hook,
    });

    const newUsed = await incrementUserQuota(userId);
    const refreshedQuota = evaluateQuota(user.plan_tier, newUsed);

    return NextResponse.json({
      message: 'Script generated',
      quota: refreshedQuota,
      script: assets.script,
      shotBreakdown: assets.shotBreakdown,
      hook: assets.hook,
    });
  } catch (error) {
    const message = (error as Error).message || 'Unable to generate script';
    console.error('reels/script failed', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
