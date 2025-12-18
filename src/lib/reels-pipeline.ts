import { supabaseAdmin } from '@/lib/supabase';
import { generateCompletion, type LlmProvider } from '@/lib/openai';
import { pickProvider } from '@/lib/llm-provider';
import { getChannel, type ChannelRecord } from '@/lib/channel-service';
import { synthesizeWithElevenLabs } from '@/lib/tts';
import type { User } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';

export type ReelStatus = 'RENDERING' | 'READY' | 'FAILED';

export type ReelRecord = {
  id: string;
  userId: string;
  scriptId: string;
  channelId?: string | null;
  personaId?: string | null;
  platform?: string | null;
  tone?: string | null;
  style?: string | null;
  template?: string | null;
  brandColors?: string[] | null;
  brandFonts?: string[] | null;
  logoUrl?: string | null;
  endScreenTemplate?: string | null;
  durationSec?: number | null;
  audioVoiceId?: string | null;
  musicTrackId?: string | null;
  trendingAudioId?: string | null;
  status: ReelStatus;
  rendererJobId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ScriptRecord = {
  id: string;
  userId: string;
  channelId?: string | null;
  personaId?: string | null;
  platform?: string | null;
  tone?: string | null;
  style?: string | null;
  template?: string | null;
  brandColors?: string[] | null;
  brandFonts?: string[] | null;
  logoUrl?: string | null;
  endScreenTemplate?: string | null;
  durationSec?: number | null;
  inputPrompt?: string | null;
  text: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ReelGenerationResult = {
  script: ScriptRecord;
  reel: ReelRecord;
};

type GeneratePayload = {
  idea?: string;
  scriptText?: string;
  platform?: string;
  tone?: string;
  style?: string;
  language?: string;
  personaId?: string | null;
  durationSec?: number;
  withVoiceover?: boolean;
  reelType?: string;
  template?: string;
  visual?: {
    videoStyle?: string;
    background?: string;
    font?: string;
    textAnimation?: string;
  };
  audio?: {
    aiVoiceId?: string | null;
    musicUploadId?: string | null;
    trendingAudioId?: string | null;
  };
  brand?: {
    colors?: string[];
    fonts?: string[];
    logoUrl?: string | null;
    endScreenTemplate?: string | null;
  };
  channelId?: string | null;
};

class HttpError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function clampDuration(value?: number | null) {
  if (!Number.isFinite(value as number)) return 30;
  const num = Math.max(10, Math.min(Math.round(Number(value)), 180));
  return num;
}

function normalizeText(value?: string | null) {
  return value?.trim() || '';
}

function normalizePlatform(value?: string | null) {
  const normalized = normalizeText(value).toUpperCase();
  return normalized || 'INSTAGRAM';
}

function normalizeTone(value?: string | null) {
  const normalized = normalizeText(value);
  return normalized || 'motivational';
}

function isMissingTable(error?: PostgrestError | null) {
  if (!error?.message) return false;
  const text = error.message.toLowerCase();
  return text.includes('relation') && text.includes('does not exist');
}

function mapScript(row: Record<string, any>): ScriptRecord {
  return {
    id: row.id,
    userId: row.user_id,
    channelId: row.channel_id ?? null,
    personaId: row.persona_id ?? null,
    platform: row.platform ?? null,
    tone: row.tone ?? null,
    style: row.style ?? null,
    template: row.template ?? null,
    brandColors: row.brand_colors ?? null,
    brandFonts: row.brand_fonts ?? null,
    logoUrl: row.logo_url ?? null,
    endScreenTemplate: row.end_screen_template ?? null,
    durationSec: row.duration_sec ?? null,
    inputPrompt: row.input_prompt ?? null,
    text: row.text ?? row.script ?? '',
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function mapReel(row: Record<string, any>): ReelRecord {
  return {
    id: row.id,
    userId: row.user_id,
    scriptId: row.script_id,
    channelId: row.channel_id ?? null,
    personaId: row.persona_id ?? null,
    platform: row.platform ?? null,
    tone: row.tone ?? null,
    style: row.style ?? null,
    template: row.template ?? null,
    brandColors: row.brand_colors ?? null,
    brandFonts: row.brand_fonts ?? null,
    logoUrl: row.logo_url ?? null,
    endScreenTemplate: row.end_screen_template ?? null,
    durationSec: row.duration_sec ?? null,
    status: (row.status as ReelStatus) ?? 'RENDERING',
    rendererJobId: row.renderer_job_id ?? null,
    videoUrl: row.video_url ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    errorMessage: row.error_message ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

async function generateScriptFromIdea(options: {
  idea: string;
  tone: string;
  language?: string;
  platform: string;
  durationSec: number;
  personaId?: string | null;
  provider?: LlmProvider;
  channel?: ChannelRecord | null;
}): Promise<string> {
  const { idea, tone, platform, durationSec, provider, channel, language } = options;
  const channelLines: string[] = [];
  if (channel) {
    channelLines.push(`Channel: ${channel.name}`);
    if (channel.topic) channelLines.push(`Channel topic/niche: ${channel.topic}`);
    if (channel.audience) channelLines.push(`Audience: ${channel.audience}`);
    if (channel.styleRules) channelLines.push(`Content rules: ${channel.styleRules}`);
    if (channel.visualStyle) channelLines.push(`Visual style: ${channel.visualStyle}`);
    if (channel.baseHashtags?.length) channelLines.push(`Preferred hashtags: ${channel.baseHashtags.join(', ')}`);
    if (channel.ctaDefault) channelLines.push(`Preferred CTA: ${channel.ctaDefault}`);
  }

  const prompt = [
    `Write a ${durationSec}-second vertical video script for ${platform}.`,
    `Tone: ${tone}.`,
    language ? `Language: ${language}.` : '',
    `Idea: ${idea}.`,
    'Keep it on-topic for the channel and avoid going off-theme.',
    'Return the script as plain text with clear voiceover lines.',
    'Avoid scene numbers; keep it concise and punchy.',
    ...channelLines,
  ].join(' ');

  const text = await generateCompletion(prompt, { temperature: 0.65, maxTokens: 500, provider });
  const cleaned = normalizeText(text);
  if (!cleaned) {
    throw new HttpError('AI did not return a script. Try again with a clearer idea.', 500);
  }
  return cleaned;
}

async function insertScriptRecord(payload: {
  userId: string;
  personaId?: string | null;
  platform?: string | null;
  tone?: string | null;
  style?: string | null;
  template?: string | null;
  brandColors?: string[] | null;
  brandFonts?: string[] | null;
  logoUrl?: string | null;
  endScreenTemplate?: string | null;
  audioVoiceId?: string | null;
  musicTrackId?: string | null;
  trendingAudioId?: string | null;
  durationSec?: number | null;
  channelId?: string | null;
  inputPrompt?: string | null;
  text: string;
}): Promise<ScriptRecord> {
  const fullPayload = {
    user_id: payload.userId,
    channel_id: payload.channelId || null,
    persona_id: payload.personaId || null,
    platform: payload.platform || null,
    tone: payload.tone || null,
    style: payload.style || null,
    template: payload.template || null,
    brand_colors: payload.brandColors || null,
    brand_fonts: payload.brandFonts || null,
    logo_url: payload.logoUrl || null,
    end_screen_template: payload.endScreenTemplate || null,
    audio_voice_id: payload.audioVoiceId || null,
    music_track_id: payload.musicTrackId || null,
    trending_audio_id: payload.trendingAudioId || null,
    duration_sec: payload.durationSec ?? null,
    input_prompt: payload.inputPrompt || null,
    text: payload.text,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabaseAdmin.from('scripts').insert(fullPayload).select('*').maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      throw new HttpError(
        'Table "scripts" is missing. Run the ai_reels_tables.sql migration in docs/sql to create it.',
        500,
      );
    }
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('brand_colors') || msg.includes('template') || msg.includes('logo_url') || msg.includes('audio')) {
      // Retry without optional columns to keep flow working even if migration not applied
      const trimmed = {
        user_id: payload.userId,
        channel_id: payload.channelId || null,
        persona_id: payload.personaId || null,
        platform: payload.platform || null,
        tone: payload.tone || null,
        style: payload.style || null,
        duration_sec: payload.durationSec ?? null,
        input_prompt: payload.inputPrompt || null,
        text: payload.text,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const retry = await supabaseAdmin.from('scripts').insert(trimmed).select('*').maybeSingle();
      if (!retry.error && retry.data) {
        data = retry.data;
        error = null;
      } else {
        throw new HttpError(retry.error?.message || 'Unable to save script', 500);
      }
    } else {
      throw new HttpError(error.message || 'Unable to save script', 500);
    }
  }

  if (!data) {
    throw new HttpError('No script returned from database.', 500);
  }

  return mapScript(data);
}

async function insertReelRecord(payload: {
  userId: string;
  scriptId: string;
  personaId?: string | null;
  platform?: string | null;
  tone?: string | null;
  style?: string | null;
  template?: string | null;
  brandColors?: string[] | null;
  brandFonts?: string[] | null;
  logoUrl?: string | null;
  endScreenTemplate?: string | null;
  audioVoiceId?: string | null;
  musicTrackId?: string | null;
  trendingAudioId?: string | null;
  durationSec?: number | null;
  channelId?: string | null;
  status: ReelStatus;
  rendererJobId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
}): Promise<ReelRecord> {
  const fullInsert = {
    user_id: payload.userId,
    script_id: payload.scriptId,
    channel_id: payload.channelId || null,
    persona_id: payload.personaId || null,
    platform: payload.platform || null,
    tone: payload.tone || null,
    style: payload.style || null,
    template: payload.template || null,
    brand_colors: payload.brandColors || null,
    brand_fonts: payload.brandFonts || null,
    logo_url: payload.logoUrl || null,
    end_screen_template: payload.endScreenTemplate || null,
    audio_voice_id: payload.audioVoiceId || null,
    music_track_id: payload.musicTrackId || null,
    trending_audio_id: payload.trendingAudioId || null,
    duration_sec: payload.durationSec ?? null,
    status: payload.status,
    renderer_job_id: payload.rendererJobId || null,
    video_url: payload.videoUrl || null,
    thumbnail_url: payload.thumbnailUrl || null,
    error_message: payload.errorMessage || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let { data, error } = await supabaseAdmin.from('reels').insert(fullInsert).select('*').maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      throw new HttpError(
        'Table "reels" is missing. Run the ai_reels_tables.sql migration in docs/sql to create it.',
        500,
      );
    }
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('brand_colors') || msg.includes('template') || msg.includes('logo_url') || msg.includes('audio')) {
      // Retry without optional columns if migration not applied
      const trimmed = {
        user_id: payload.userId,
        script_id: payload.scriptId,
        channel_id: payload.channelId || null,
        persona_id: payload.personaId || null,
        platform: payload.platform || null,
        tone: payload.tone || null,
        style: payload.style || null,
        duration_sec: payload.durationSec ?? null,
        status: payload.status,
        renderer_job_id: payload.rendererJobId || null,
        video_url: payload.videoUrl || null,
        thumbnail_url: payload.thumbnailUrl || null,
        error_message: payload.errorMessage || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const retry = await supabaseAdmin.from('reels').insert(trimmed).select('*').maybeSingle();
      if (!retry.error && retry.data) {
        data = retry.data;
        error = null;
      } else {
        throw new HttpError(retry.error?.message || 'Unable to save reel record', 500);
      }
    } else {
      throw new HttpError(error.message || 'Unable to save reel record', 500);
    }
  }

  if (!data) {
    throw new HttpError('No reel returned from database.', 500);
  }

  return mapReel(data);
}

async function updateReelStatus(reelId: string, userId: string, updates: Partial<ReelRecord>): Promise<ReelRecord> {
  const { data, error } = await supabaseAdmin
    .from('reels')
    .update({
      status: updates.status,
      video_url: updates.videoUrl,
      thumbnail_url: updates.thumbnailUrl,
      error_message: updates.errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', reelId)
    .eq('user_id', userId)
    .select('*')
    .maybeSingle();

  if (error) {
    throw new HttpError(error.message || 'Unable to update reel status', 500);
  }
  if (!data) {
    throw new HttpError('Reel not found for update.', 404);
  }
  return mapReel(data);
}

function defaultAssets(jobId: string) {
  const mediaCdn = process.env.MEDIA_CDN_BASE_URL?.replace(/\/$/, '');
  if (mediaCdn) {
    return {
      videoUrl: `${mediaCdn}/renders/${jobId}.mp4`,
      thumbnailUrl: `${mediaCdn}/renders/${jobId}.jpg`,
    };
  }
  const fallbackVideo =
    process.env.DEFAULT_REEL_VIDEO_URL ??
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
  const fallbackThumb =
    process.env.DEFAULT_REEL_THUMB_URL ??
    'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=720&auto=format&fit=crop';
  return {
    videoUrl: `${fallbackVideo}?job=${jobId}`,
    thumbnailUrl: `${fallbackThumb}&job=${jobId}`,
  };
}

function formatRendererError(error: unknown): string {
  if (error instanceof Error) {
    const code = typeof (error as any)?.cause?.code === 'string' ? (error as any).cause.code : null;
    return code ? `${error.message} (${code})` : error.message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function triggerRenderer(options: {
  scriptText: string;
  language?: string | null;
  style?: string | null;
  template?: string | null;
  brand?: {
    colors?: string[] | null;
    fonts?: string[] | null;
    logoUrl?: string | null;
    endScreenTemplate?: string | null;
  } | null;
  durationSec: number;
  withVoiceover?: boolean;
  audio?: {
    aiVoiceId?: string | null;
    musicUploadId?: string | null;
    trendingAudioId?: string | null;
  } | null;
}) {
  const jobId = `renderer_${Date.now()}`;
  let audioUrl: string | null = null;
  let renderError: string | null = null;

  // Attempt TTS via ElevenLabs
  if (options.withVoiceover !== false) {
    const ttsKey = process.env.TTS_PROVIDER_API_KEY;
    const defaultVoice = process.env.TTS_VOICE_DEFAULT;
    const voiceId = options.audio?.aiVoiceId || defaultVoice;
    if (ttsKey && voiceId) {
      try {
        audioUrl = await synthesizeWithElevenLabs({
          text: options.scriptText,
          voiceId,
          apiKey: ttsKey,
          mediaBaseUrl: process.env.MEDIA_CDN_BASE_URL,
          mediaDir: process.env.MEDIA_DIR || undefined,
          language: options.language || undefined,
        });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('TTS synthesis failed, continuing without audio:', err);
      }
    }
  }

  const rendererUrl = process.env.RENDERER_API_URL;
  const rendererKey = process.env.RENDERER_API_KEY;
  if (rendererUrl && rendererKey) {
    try {
      const res = await fetch(`${rendererUrl.replace(/\/$/, '')}/render`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${rendererKey}`,
        },
        body: JSON.stringify({
          script: options.scriptText,
          style: options.style,
          template: options.template,
          durationSec: options.durationSec,
          brand: options.brand,
          audioUrl,
        }),
      });

      if (res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          jobId?: string;
          status?: string;
          videoUrl?: string;
          thumbnailUrl?: string;
          error?: string | null;
        };
        const status = body.status === 'ready' ? 'ready' : 'rendering';
        return {
          id: body.jobId || jobId,
          status,
          videoUrl: body.videoUrl || defaultAssets(jobId).videoUrl,
          thumbnailUrl: body.thumbnailUrl || defaultAssets(jobId).thumbnailUrl,
          audioUrl,
          error: body.error || null,
        };
      }
    } catch (err) {
      renderError = formatRendererError(err);
      // eslint-disable-next-line no-console
      console.warn('Renderer call failed, falling back to defaults:', renderError);
    }
  }

  // Fallback to placeholder assets
  const assets = defaultAssets(jobId);
  return {
    id: jobId,
    status: 'ready' as const,
    videoUrl: assets.videoUrl,
    thumbnailUrl: assets.thumbnailUrl,
    audioUrl,
    error: renderError,
  };
}

export async function startReelGeneration(user: User, payload: GeneratePayload): Promise<ReelGenerationResult> {
  const idea = normalizeText(payload.idea);
  const scriptTextInput = normalizeText(payload.scriptText);
  const channelId = normalizeText(payload.channelId) || null;
  const provider = pickProvider({ bodyProvider: null, user });

  const channel = channelId ? await getChannel(user.id, channelId) : null;
  if (channelId && !channel) {
    throw new HttpError('Channel not found for this user.', 404);
  }

  const platform = normalizePlatform(payload.platform ?? channel?.platform ?? null);
  const tone = normalizeTone(payload.tone ?? channel?.tone ?? null);
  const style = normalizeText(payload.style ?? channel?.visualStyle ?? channel?.style ?? null) || null;
  const language = normalizeText(payload.language ?? channel?.language ?? null) || null;
  const durationSec = clampDuration(payload.durationSec ?? channel?.durationDefault ?? null);
  const personaId = normalizeText(payload.personaId ?? channel?.personaId ?? null) || null;
  const template = normalizeText(payload.template ?? channel?.style ?? null) || null;
  const brandColors = payload.brand?.colors ?? channel?.brandColors ?? null;
  const brandFonts = payload.brand?.fonts ?? channel?.brandFonts ?? null;
  const logoUrl = payload.brand?.logoUrl ?? channel?.logoUrl ?? null;
  const endScreenTemplate = payload.brand?.endScreenTemplate ?? channel?.endScreenTemplate ?? null;
  const audioVoiceId = payload.audio?.aiVoiceId ?? null;
  const musicTrackId = payload.audio?.musicUploadId ?? null;
  const trendingAudioId = payload.audio?.trendingAudioId ?? null;

  const ideaSeed = idea || channel?.topic || '';
  const ideaForPrompt =
    channel?.topic && idea && !idea.toLowerCase().includes(channel.topic.toLowerCase())
      ? `${idea}. Keep it aligned to: ${channel.topic}`
      : ideaSeed;

  if (!ideaForPrompt && !scriptTextInput) {
    throw new HttpError('Provide either an idea, a channel topic, or a script to generate a reel.', 422);
  }

  let finalScript = scriptTextInput;
  if (!finalScript) {
    finalScript = await generateScriptFromIdea({
      idea: ideaForPrompt,
      tone,
      language: language || undefined,
      platform,
      durationSec,
      personaId: personaId || undefined,
      provider,
      channel,
    });
  }

  const script = await insertScriptRecord({
    userId: user.id,
    channelId,
    personaId,
    platform,
    tone,
    style,
    language: language || null,
    template,
    brandColors,
    brandFonts,
    logoUrl,
    endScreenTemplate,
    audioVoiceId,
    musicTrackId,
    trendingAudioId,
    durationSec,
    inputPrompt: idea || channel?.topic || null,
    text: finalScript,
  });

  const rendererJob = await triggerRenderer({
    scriptText: finalScript,
    language,
    style,
    template,
    brand: { colors: brandColors, fonts: brandFonts, logoUrl, endScreenTemplate },
    durationSec,
    withVoiceover: payload.withVoiceover !== false,
    audio: {
      aiVoiceId: audioVoiceId,
      musicUploadId: musicTrackId,
      trendingAudioId,
    },
  });

  const reelStatus: ReelStatus = rendererJob.status === 'ready' ? 'READY' : 'RENDERING';
  let reel = await insertReelRecord({
    userId: user.id,
    channelId,
    scriptId: script.id,
    personaId,
    platform,
    tone,
    style,
    template,
    brandColors,
    brandFonts,
    logoUrl,
    endScreenTemplate,
    audioVoiceId,
    musicTrackId,
    trendingAudioId,
    durationSec,
    status: reelStatus,
    rendererJobId: rendererJob.id,
    videoUrl: rendererJob.videoUrl ?? null,
    thumbnailUrl: rendererJob.thumbnailUrl ?? null,
    errorMessage: rendererJob.error,
  });

  if (rendererJob.status === 'ready') {
    return { script, reel };
  }

  // If renderer is async, you could return a queued job here. For now, everything is ready.
  return { script, reel };
}

export async function fetchReelStatus(userId: string, reelId: string): Promise<ReelRecord> {
  const { data, error } = await supabaseAdmin
    .from('reels')
    .select('*')
    .eq('id', reelId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      throw new HttpError(
        'Table "reels" is missing. Run the ai_reels_tables.sql migration in docs/sql to create it.',
        500,
      );
    }
    throw new HttpError(error.message || 'Unable to load reel status', 500);
  }

  if (!data) {
    throw new HttpError('Reel not found', 404);
  }

  // If you have a real renderer, poll it here when status === RENDERING
  return mapReel(data);
}
