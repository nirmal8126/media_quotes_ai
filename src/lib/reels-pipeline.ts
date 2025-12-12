import { supabaseAdmin } from '@/lib/supabase';
import { generateCompletion, type LlmProvider } from '@/lib/openai';
import { pickProvider } from '@/lib/llm-provider';
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
  durationSec?: number | null;
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
  personaId?: string | null;
  durationSec?: number;
  withVoiceover?: boolean;
  reelType?: string;
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
  platform: string;
  durationSec: number;
  personaId?: string | null;
  provider?: LlmProvider;
}): Promise<string> {
  const { idea, tone, platform, durationSec, provider } = options;
  const prompt = [
    `Write a ${durationSec}-second vertical video script for ${platform}.`,
    `Tone: ${tone}.`,
    `Idea: ${idea}.`,
    'Return the script as plain text with clear voiceover lines.',
    'Avoid scene numbers; keep it concise and punchy.',
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
  durationSec?: number | null;
  channelId?: string | null;
  inputPrompt?: string | null;
  text: string;
}): Promise<ScriptRecord> {
  const { data, error } = await supabaseAdmin
    .from('scripts')
    .insert({
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
    })
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      throw new HttpError(
        'Table "scripts" is missing. Run the ai_reels_tables.sql migration in docs/sql to create it.',
        500,
      );
    }
    throw new HttpError(error.message || 'Unable to save script', 500);
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
  durationSec?: number | null;
  channelId?: string | null;
  status: ReelStatus;
  rendererJobId?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  errorMessage?: string | null;
}): Promise<ReelRecord> {
  const { data, error } = await supabaseAdmin
    .from('reels')
    .insert({
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
    })
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingTable(error)) {
      throw new HttpError(
        'Table "reels" is missing. Run the ai_reels_tables.sql migration in docs/sql to create it.',
        500,
      );
    }
    throw new HttpError(error.message || 'Unable to save reel record', 500);
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

async function triggerRenderer(options: {
  scriptText: string;
  style?: string | null;
  durationSec: number;
  withVoiceover?: boolean;
}) {
  const jobId = `renderer_${Date.now()}`;
  // Placeholder: replace with real renderer call. For now, we mark as ready immediately.
  const assets = defaultAssets(jobId);
  return {
    id: jobId,
    status: 'ready' as const,
    videoUrl: assets.videoUrl,
    thumbnailUrl: assets.thumbnailUrl,
    error: null as string | null,
  };
}

export async function startReelGeneration(user: User, payload: GeneratePayload): Promise<ReelGenerationResult> {
  const idea = normalizeText(payload.idea);
  const scriptTextInput = normalizeText(payload.scriptText);
  const tone = normalizeTone(payload.tone);
  const platform = normalizePlatform(payload.platform);
  const durationSec = clampDuration(payload.durationSec);
  const style = normalizeText(payload.style) || null;
  const personaId = normalizeText(payload.personaId) || null;
  const channelId = normalizeText(payload.channelId) || null;
  const provider = pickProvider({ bodyProvider: null, user });

  if (!idea && !scriptTextInput) {
    throw new HttpError('Provide either an idea or a script to generate a reel.', 422);
  }

  let finalScript = scriptTextInput;
  if (!finalScript) {
    finalScript = await generateScriptFromIdea({
      idea,
      tone,
      platform,
      durationSec,
      personaId: personaId || undefined,
      provider,
    });
  }

  const script = await insertScriptRecord({
    userId: user.id,
    channelId,
    personaId,
    platform,
    tone,
    style,
    durationSec,
    inputPrompt: idea || null,
    text: finalScript,
  });

  const rendererJob = await triggerRenderer({
    scriptText: finalScript,
    style,
    durationSec,
    withVoiceover: payload.withVoiceover !== false,
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
