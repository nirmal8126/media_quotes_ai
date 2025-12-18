import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { supabaseAdmin } from '@/lib/supabase';

type ReelRow = {
  id: string;
  platform?: string | null;
  tone?: string | null;
  hook?: string | null;
  hashtags?: string[] | null;
  status?: string | null;
  created_at?: string | null;
};

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) return session.errorResponse;
  const { user, applyCookies } = session;

  // Fetch recent reels
  const { data, error } = await supabaseAdmin
    .from('reels')
    .select('id, platform, tone, status, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('Insights: reels table unavailable, returning empty stats.');
  }

  const reels = ((data ?? []) as ReelRow[]).map((row) => ({
    ...row,
    hook: row.hook ?? null,
    hashtags: row.hashtags ?? [],
  }));
  const byPlatform: Record<string, number> = {};
  const byTone: Record<string, number> = {};
  const hooks: string[] = [];
  const tagCounts: Record<string, number> = {};

  reels.forEach((row) => {
    const platform = (row.platform || 'unknown').toLowerCase();
    const tone = (row.tone || 'unknown').toLowerCase();
    byPlatform[platform] = (byPlatform[platform] || 0) + 1;
    byTone[tone] = (byTone[tone] || 0) + 1;
    if (row.hook) hooks.push(row.hook);
    (row.hashtags || []).forEach((tag) => {
      const key = String(tag || '').trim().toLowerCase();
      if (!key) return;
      tagCounts[key] = (tagCounts[key] || 0) + 1;
    });
  });

  const topHashtags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const response = NextResponse.json({
    totals: { reels: reels.length },
    byPlatform,
    byTone,
    topHashtags,
    sampleHooks: hooks.slice(0, 5),
  });
  applyCookies(response);
  return response;
}
