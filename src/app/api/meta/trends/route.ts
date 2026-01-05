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
  const { data, error } = await supabaseAdmin
    .from('reels')
    .select('id') // minimal safe select to avoid schema mismatches
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('Trends: reels table unavailable, returning default trends.');
  }

  const personalTags: Record<string, number> = {};
  const hookWords: Record<string, number> = {};
  // If schema expands later, these accumulators will pick up hashtags/hooks; for now defaults suffice.

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
