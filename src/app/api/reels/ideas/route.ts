import { NextResponse } from 'next/server';
import { fetchUserQuota, generateIdeaList, storeGeneratedReel } from '@/lib/reel-service';
import { requireUser } from '@/lib/api-auth';
import { pickProvider } from '@/lib/llm-provider';
import { defaultProvider } from '@/lib/openai';

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const body = await request.json().catch(() => ({}));

  const tone = body.tone ?? 'educational';
  const platform = body.platform ?? 'instagram';
  const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });
  const { quota } = await fetchUserQuota(user.id);

  if (!quota.allowsGeneration) {
    return NextResponse.json({ error: 'Quota exceeded for this plan', quota }, { status: 403 });
  }

  const ideas = await generateIdeaList(tone, platform, provider);
  await storeGeneratedReel({ userId: user.id, tone, platform, hook: ideas[0]?.hook, script: ideas[0]?.title });

  const response = NextResponse.json({
    message: 'Ideas generated',
    quota,
    ideas,
  });
  applyCookies(response);
  return response;
}
