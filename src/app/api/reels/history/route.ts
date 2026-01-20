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
  const channelId = (searchParams.get('channelId') ?? searchParams.get('channel_id') ?? '').trim();
  const platform = (searchParams.get('platform') ?? '').trim();
  const tone = (searchParams.get('tone') ?? '').trim();
  const status = (searchParams.get('status') ?? '').trim();
  const dateFrom = (searchParams.get('from') ?? searchParams.get('dateFrom') ?? '').trim();
  const dateTo = (searchParams.get('to') ?? searchParams.get('dateTo') ?? '').trim();
  const limit = Math.max(1, Math.min(Number(searchParams.get('limit')) || 50, 200));

  let query = supabaseAdmin
    .from('reels')
    .select(
      `
      id, status, platform, tone, style, duration_sec, renderer_job_id, video_url, thumbnail_url, error_message,
      channel_id, script_id, created_at, updated_at, custom_settings,
      scripts:script_id ( id, text, input_prompt )
    `,
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (channelId) query = query.eq('channel_id', channelId);
  if (platform) query = query.ilike('platform', `%${platform}%`);
  if (tone) query = query.ilike('tone', `%${tone}%`);
  if (status) query = query.eq('status', status);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo);

  let { data, error } = await query;

  const normalizedError = (error?.message ?? '').toLowerCase();

  if (
    error &&
    (normalizedError.includes('scripts') ||
      normalizedError.includes('schema cache') ||
      normalizedError.includes('custom_settings'))
  ) {
    const { data: fallbackData, error: fallbackError } = await supabaseAdmin
      .from('reels')
      .select(
        'id, status, platform, tone, style, duration_sec, renderer_job_id, video_url, thumbnail_url, error_message, channel_id, script_id, created_at, updated_at',
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fallbackError) {
      const response = NextResponse.json({ error: 'Failed to load reels history' }, { status: 500 });
      applyCookies(response);
      return response;
    }

    const reels =
      fallbackData?.map((row: any) => ({
        id: row.id,
        status: row.status,
        platform: row.platform,
        tone: row.tone,
        style: row.style,
        durationSec: row.duration_sec,
        rendererJobId: row.renderer_job_id,
        videoUrl: row.video_url,
        thumbnailUrl: row.thumbnail_url,
        errorMessage: row.error_message,
        channelId: row.channel_id,
        scriptId: row.script_id,
        scriptText: null,
        inputPrompt: null,
        customSettings: null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })) ?? [];

    const response = NextResponse.json({ reels });
    applyCookies(response);
    return response;
  }

  // If reels table is missing (older deployments), fall back to legacy shape
  if (error && normalizedError.includes('relation "reels"')) {
    const fallbackSelect = 'id, tone, platform, script, caption, hashtags, thumbnail_prompt, channel_id, created_at, status';
    let fallback = await supabaseAdmin
      .from('reels')
      .select(fallbackSelect)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (fallback.error && (fallback.error.message ?? '').toLowerCase().includes('status')) {
      fallback = await supabaseAdmin
        .from('reels')
        .select('id, tone, platform, script, caption, hashtags, thumbnail_prompt, channel_id, created_at, status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);
    }

    if (fallback.error) {
      const response = NextResponse.json({ error: 'Failed to load reels history' }, { status: 500 });
      applyCookies(response);
      return response;
    }

    const response = NextResponse.json({ reels: fallback.data ?? [] });
    applyCookies(response);
    return response;
  }

  if (error) {
    const response = NextResponse.json({ error: 'Failed to load reels history' }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const reels =
    data?.map((row: any) => ({
      id: row.id,
      status: row.status,
      platform: row.platform,
      tone: row.tone,
      style: row.style,
      durationSec: row.duration_sec,
      rendererJobId: row.renderer_job_id,
      videoUrl: row.video_url,
      thumbnailUrl: row.thumbnail_url,
      errorMessage: row.error_message,
      channelId: row.channel_id,
      scriptId: row.script_id,
      scriptText: row.scripts?.text ?? row.scripts?.[0]?.text ?? null,
      inputPrompt: row.scripts?.input_prompt ?? row.scripts?.[0]?.input_prompt ?? null,
      customSettings: row.custom_settings ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) ?? [];

  const response = NextResponse.json({ reels });
  applyCookies(response);
  return response;
}
