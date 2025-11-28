import { NextResponse } from 'next/server';
import { fetchUserQuota, generateHashtagList, storeGeneratedReel } from '@/lib/reel-service';

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

  const hashtags = await generateHashtagList(tone, platform);
  await storeGeneratedReel({ userId, tone, platform, hashtags });

  return NextResponse.json({
    message: 'Hashtags generated',
    quota,
    hashtags,
  });
}
