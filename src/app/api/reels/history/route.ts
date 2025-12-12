import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireUser } from '@/lib/api-auth';

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const channelParam = searchParams.get('channelId') || searchParams.get('channel_id');

  const query = supabaseAdmin
    .from("reels")
    .select("id, status, video_url, thumbnail_url, renderer_job_id, script_id, channel_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const channelFilter = channelParam?.trim();
  if (channelFilter) {
    if (channelFilter.toLowerCase() === 'none' || channelFilter.toLowerCase() === 'null') {
      query.is('channel_id', null);
    } else {
      query.eq('channel_id', channelFilter);
    }
  }

  const { data, error } = await query;

  if (error) {
    const missing =
      error.message?.toLowerCase().includes("relation") && error.message?.toLowerCase().includes("reels");
    const response = NextResponse.json(
      {
        error: missing
          ? 'Missing "reels" table. Run web/docs/sql/ai_reels_tables.sql in Supabase.'
          : "Failed to load reels history",
      },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }

  // Optionally fetch script snippets to show in detail modals
  const scriptIds = Array.from(new Set((data ?? []).map((row) => row.script_id).filter(Boolean))) as string[];
  let scripts: Record<string, string> = {};
  if (scriptIds.length > 0) {
    const { data: scriptRows } = await supabaseAdmin.from('scripts').select('id, text').in('id', scriptIds);
    scripts =
      scriptRows?.reduce((acc, row) => {
        acc[row.id] = row.text ?? '';
        return acc;
      }, {} as Record<string, string>) ?? {};
  }

  const response = NextResponse.json({
    reels: (data ?? []).map((row) => ({
      id: row.id,
      status: row.status,
      videoUrl: row.video_url,
      thumbnailUrl: row.thumbnail_url,
      rendererJobId: row.renderer_job_id,
      scriptId: row.script_id,
      scriptText: row.script_id ? scripts[row.script_id] ?? "" : undefined,
      channelId: (row as any).channel_id ?? null,
      createdAt: row.created_at,
    })),
  });
  applyCookies(response);
  return response;
}
