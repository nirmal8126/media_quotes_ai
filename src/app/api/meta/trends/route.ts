import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) return session.errorResponse;
  const { user, applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const platform = (searchParams.get('platform') ?? '').trim() || 'instagram';
  const niche = (searchParams.get('niche') ?? '').trim() || 'general';

  // Pull recent hashtags/hooks from user’s generated reels to build "personalized" trends
  const { data } = await supabaseAdmin
    .from('generated_reels')
    .select('hashtags, hook')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const personalTags: Record<string, number> = {};
  const hookWords: Record<string, number> = {};
  (data ?? []).forEach((row: any) => {
    (row.hashtags ?? []).forEach((tag: string) => {
      const key = String(tag || '').trim().toLowerCase();
      if (!key) return;
      personalTags[key] = (personalTags[key] || 0) + 1;
    });
    if (row.hook) {
      const words = String(row.hook)
        .toLowerCase()
        .replace(/[^a-z0-9\s#]/g, '')
        .split(/\s+/)
        .filter((w: string) => w.length > 3);
      words.forEach((w: string) => {
        hookWords[w] = (hookWords[w] || 0) + 1;
      });
    }
  });

  const personalizedHashtags = Object.entries(personalTags)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag)
    .slice(0, 8);
  const personalizedTopics = Object.entries(hookWords)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 5)
    .map((w) => `${niche} ${w}`);

  // Placeholder platform trends blended with niche
  const trendingSounds = [
    `${platform}-sound-1`,
    `${platform}-sound-2`,
    `${platform}-sound-3`,
  ];
  const trendingTopics = [
    `${niche} trend 1`,
    `${niche} trend 2`,
    `${niche} trend 3`,
    ...personalizedTopics,
  ];
  const trendingHashtags = [
    '#viral',
    '#trending',
    `#${platform}`,
    `#${niche.replace(/\s+/g, '')}`,
    ...personalizedHashtags,
  ].slice(0, 10);

  const response = NextResponse.json({
    platform,
    niche,
    trendingSounds,
    trendingTopics,
    trendingHashtags,
    personalizedHashtags,
  });
  applyCookies(response);
  return response;
}
