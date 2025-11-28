import { NextResponse } from 'next/server';
import { fetchUserQuota, generateIdeaList, storeGeneratedReel } from '@/lib/reel-service';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = body.userId;

  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }

  const tone = body.tone ?? 'educational';
  const platform = body.platform ?? 'instagram';
  const { quota } = await fetchUserQuota(userId);

  if (!quota.allowsGeneration) {
    return NextResponse.json({ error: 'Quota exceeded for this plan', quota }, { status: 403 });
  }

  const ideas = await generateIdeaList(tone, platform);
  await storeGeneratedReel({ userId, tone, platform, hook: ideas[0]?.hook, script: ideas[0]?.title });

  return NextResponse.json({
    message: 'Ideas generated',
    quota,
    ideas,
  });
}
