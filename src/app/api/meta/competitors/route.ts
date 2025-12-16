import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';

type Competitor = {
  handle: string;
  platform: string;
};

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) return session.errorResponse;
  const { applyCookies } = session;
  const body = await request.json().catch(() => ({}));
  const list: Competitor[] = Array.isArray(body.competitors)
    ? body.competitors
    : Array.isArray(body?.handles)
      ? body.handles
      : [];

  if (!list.length) {
    const response = NextResponse.json({ error: 'Provide competitors as an array of { handle, platform }' }, { status: 400 });
    applyCookies(response);
    return response;
  }

  // Stubbed competitor insights. Replace with real scrape/API later.
  const insights = list.map((item) => {
    const handle = item.handle || 'unknown';
    const platform = (item.platform || 'instagram').toLowerCase();
    return {
      handle,
      platform,
      bestPostingTimes: ['Mon 7pm', 'Wed 6pm', 'Sat 10am'],
      topHooks: [`${handle}: hook 1`, `${handle}: hook 2`],
      topHashtags: ['#viral', '#growth', `#${platform}`],
      viralTopics: ['topic 1', 'topic 2'],
    };
  });

  const response = NextResponse.json({ insights });
  applyCookies(response);
  return response;
}
