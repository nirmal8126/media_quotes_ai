import { supabaseAdmin } from '@/lib/supabase';
import { evaluateQuota, normalizePlanTier } from '@/lib/plan';
import { generateCompletion, type LlmProvider } from '@/lib/openai';
import { pickProvider } from '@/lib/llm-provider';
import { getChannel, type ChannelRecord } from '@/lib/channel-service';
import { labelForLanguage } from '@/lib/languages';
import { getRendererStatus, triggerRenderer } from '@/lib/reels-pipeline';
import type { User } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';

export interface GeneratedReelRecord {
  userId: string;
  channelId?: string | null;
  tone?: string;
  platform?: string;
  script?: string;
  shotBreakdown?: string[];
  caption?: string;
  hashtags?: string[];
  thumbnailPrompt?: string;
  hook?: string;
  status?: string;
  scheduledDate?: string;
  publishedAt?: string;
}

export async function fetchUserQuota(userId: string) {
  if (!userId) {
    throw new Error('Missing userId to evaluate quota.');
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, plan_tier, quota_used')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error('User not found in Supabase.');
  }

  const planTier = normalizePlanTier(data.plan_tier);
  const quota = evaluateQuota(planTier, data.quota_used);
  return { user: data, quota };
}

export async function incrementUserQuota(userId: string, amount = 1) {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('quota_used')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('Unable to load quota for user while incrementing.');
  }

  const newUsed = (data.quota_used ?? 0) + amount;
  await supabaseAdmin.from('users').update({ quota_used: newUsed }).eq('id', userId);
  return newUsed;
}

export async function storeGeneratedReel(record: GeneratedReelRecord) {
  const now = new Date().toISOString();
  let scriptId: string | null = null;
  if (record.script) {
    const { data: scriptRow, error: scriptErr } = await supabaseAdmin
      .from('scripts')
      .insert({
        user_id: record.userId,
        platform: record.platform ?? null,
        tone: record.tone ?? null,
        input_prompt: record.thumbnailPrompt ?? record.hook ?? null,
        text: record.script,
        created_at: now,
      })
      .select('id')
      .maybeSingle();
    if (!scriptErr) {
      scriptId = scriptRow?.id ?? null;
    }
  }

  const reelPayload = {
    user_id: record.userId,
    channel_id: record.channelId ?? null,
    platform: record.platform ?? null,
    tone: record.tone ?? null,
    status: record.status ?? 'READY',
    script_id: scriptId,
    created_at: now,
  };

  const { data, error } = await supabaseAdmin
    .from('reels')
    .insert(reelPayload)
    .select('id')
    .maybeSingle();

  if (error) {
    console.warn('Reel persistence skipped; using scripts-only fallback.', error.message || error);
    return scriptId ? { id: scriptId } : null;
  }

  return { id: data?.id ?? scriptId ?? null };
}

export async function generateIdeaList(tone: string, platform: string, provider?: LlmProvider) {
  const prompt = `You are a creative copywriter for short-form video. Create 10 Instagram or YouTube Shorts reel ideas in a ${tone} tone for ${platform}. Return a numbered list (1-10) with a short hook or logline.`;
  const raw = await generateCompletion(prompt, { temperature: 0.8, maxTokens: 300, provider });
  const ideas = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 2)
    .map((line) => {
      const clean = line.replace(/^\d+\.\s*/, '').replace(/^[-–]\s*/, '');
      return {
        title: clean,
        tone,
        platform,
        hook: clean,
      };
    });

  return ideas;
}

function cleanJsonLike(input: string) {
  return input
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .replace(/^\s*json\s*/i, '')
    .trim();
}

function parseJsonMaybe<T = any>(input: string): T | null {
  try {
    return JSON.parse(input) as T;
  } catch {
    return null;
  }
}

function normalizeGeneratedField(text: string, key: 'script' | 'caption') {
  if (!text) return '';
  let cleaned = cleanJsonLike(text);
  // strip leading key labels
  cleaned = cleaned.replace(new RegExp(`^\\s*["']?${key}["']?\\s*:\\s*`, 'i'), '');
  // remove enclosing braces if simple
  if (/^\{[\s\S]*\}$/.test(cleaned)) {
    cleaned = cleaned.replace(/^\{|\}$/g, '');
  }
  cleaned = cleaned.replace(/["{}]/g, ' ').replace(/\s+/g, ' ').trim();
  return cleaned;
}

export async function generateScriptAssets(
  tone: string,
  platform: string,
  topic?: string,
  hookHint?: string,
  provider?: LlmProvider,
) {
  const prompt = [
    `Write a short ${tone} script for a ${platform} reel.`,
    topic ? `Topic: ${topic}.` : null,
    hookHint ? `Use this hook or angle: ${hookHint}.` : null,
    `Return plain text only (no JSON). Format as:`,
    `Hook: <one engaging line>\nIntro: <1-2 lines>\nValue: <2-3 lines>\nCTA: <1 line>`,
  ]
    .filter(Boolean)
    .join(" ");
  const raw = await generateCompletion(prompt, { temperature: 0.65, maxTokens: 450, provider });

  const cleaned = cleanJsonLike(raw);
  const parsed = parseJsonMaybe<{
    script?: string;
    shots?: string[];
    hook?: string;
  }>(cleaned);

  let script = normalizeGeneratedField(parsed?.script ?? cleaned, 'script');
  let shotBreakdown: string[] = Array.isArray(parsed?.shots) ? parsed!.shots : [];
  let hook = parsed?.hook ?? hookHint ?? cleaned.split('\n')[0]?.trim() ?? '';

  if (!shotBreakdown.length) {
    shotBreakdown = cleaned.split(/\n|\.|!|\?/).filter((line) => line.trim().length > 3).slice(0, 3);
  }

  return { script: script.trim(), shotBreakdown, hook: hook.trim() };
}

export async function generateCaptionContent(
  tone: string,
  platform: string,
  topic?: string,
  hookHint?: string,
  provider?: LlmProvider,
) {
  const prompt = [
    `Generate a ${tone} caption for a ${platform} reel.`,
    topic ? `Topic: ${topic}.` : null,
    hookHint ? `Hook: ${hookHint}.` : null,
    `Return plain text (no JSON). Include a short CTA at the end.`,
  ]
    .filter(Boolean)
    .join(" ");
  const raw = await generateCompletion(prompt, { temperature: 0.7, maxTokens: 180, provider });

  const cleaned = cleanJsonLike(raw);
  const parsed = parseJsonMaybe<{
    caption?: string;
    callToAction?: string;
  }>(cleaned);

  let caption = normalizeGeneratedField(parsed?.caption ?? cleaned, 'caption');
  let callToAction = parsed?.callToAction ?? 'Drop a comment.';

  if (!parsed) {
    const sentences = caption.split(/[.!?]\s+/);
    callToAction = sentences.pop()?.trim() || callToAction;
  }

  return { caption: caption.trim(), callToAction: callToAction.trim() };
}

export async function generateThumbnailPrompt(tone: string, platform: string, provider?: LlmProvider) {
  const prompt = `Describe a bold thumbnail idea for a ${platform} reel with a ${tone} tone. Mention key colors, face/pose, text overlay, and energy.`;
  const raw = await generateCompletion(prompt, { temperature: 0.75, maxTokens: 150, provider });
  return raw;
}

export async function generateScriptVariants(options: {
  topic: string;
  tone: string;
  platform: string;
  count?: number;
  provider?: LlmProvider;
}) {
  const { topic, tone, platform, provider } = options;
  const count = Math.max(3, Math.min(options.count ?? 3, 5));
  const prompt = [
    `Generate ${count} hooks, ${count} titles, ${count} scripts, and ${count} hashtag sets for a ${platform} reel.`,
    `Topic: ${topic}. Tone: ${tone}. Keep them distinct and on-topic.`,
    'Return JSON with keys: hooks (array of strings), titles (array), scripts (array), hashtags (array of arrays).',
  ].join(' ');

  const fallback = { hooks: [], titles: [], scripts: [], hashtags: [] as string[][] };
  const raw = await generateCompletion(prompt, { temperature: 0.85, maxTokens: 900, provider });

  const parsed = parseJsonMaybe<{
    hooks?: unknown[];
    titles?: unknown[];
    scripts?: unknown[];
    hashtags?: unknown[];
  }>(raw);
  if (!parsed) {
    return fallback;
  }
  const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.map((h) => String(h || '')).filter(Boolean) : [];
  const titles = Array.isArray(parsed.titles) ? parsed.titles.map((h) => String(h || '')).filter(Boolean) : [];
  const scripts = Array.isArray(parsed.scripts) ? parsed.scripts.map((h) => String(h || '')).filter(Boolean) : [];
  const hashtags = Array.isArray(parsed.hashtags)
    ? parsed.hashtags.map((set) =>
        Array.isArray(set)
          ? set.map((t) => String(t || '')).filter(Boolean)
          : String(set || '')
              .split(/[,\n]/)
              .map((t) => t.trim())
              .filter(Boolean),
      )
    : [];

  return {
    hooks: hooks.slice(0, count),
    titles: titles.slice(0, count),
    scripts: scripts.slice(0, count),
    hashtags: hashtags.slice(0, count).map((set) =>
      set.map((tag) => (tag.startsWith('#') ? tag : `#${tag}`)).slice(0, 8),
    ),
  };
}

export async function generateStoryboard(options: {
  script: string;
  tone: string;
  platform: string;
  provider?: LlmProvider;
}) {
  const { script, tone, platform, provider } = options;
  const prompt = [
    `Create a storyboard for this ${platform} script in a ${tone} tone.`,
    'Return JSON array of scenes, each with: label (hook/body/outro/etc), text, durationMs, and optional visualSuggestion.',
    'Keep 4-8 scenes max. Use concise text.',
    'Script:',
    script,
  ].join('\n');

  const raw = await generateCompletion(prompt, { temperature: 0.6, maxTokens: 600, provider });

  const normalize = (items: Array<any>) =>
    items
      .map((scene) => {
        if (typeof scene === 'string') {
          return { label: undefined, text: scene.trim() };
        }
        if (scene && typeof scene === 'object') {
          return {
            label: (scene.label || '').trim() || undefined,
            text: (scene.text || '').trim(),
            durationMs: scene.durationMs ?? undefined,
            visualSuggestion: (scene.visualSuggestion || '').trim() || undefined,
          };
        }
        return null;
      })
      .filter((s) => s && s.text && s.text.length > 6)
      .slice(0, 8) as Array<{ label?: string; text: string; durationMs?: number; visualSuggestion?: string }>;

  const parsed = parseJsonMaybe<
    Array<{
      label?: string;
      text?: string;
      durationMs?: number;
      visualSuggestion?: string;
    }>
  >(raw);
  if (Array.isArray(parsed)) {
    const normalized = normalize(parsed);
    if (normalized.length) return normalized;
  }

  const splitFallback = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 6);
  return normalize(splitFallback);
}

export async function generateHashtagList(tone: string, platform: string, provider?: LlmProvider) {
  const prompt = `List 12 relevant, high-engagement hashtags for a ${tone} ${platform} reel. Output as a comma-separated list.`;
  const raw = await generateCompletion(prompt, { temperature: 0.6, maxTokens: 120, provider });
  const tags = raw
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`));
  return tags.slice(0, 12);
}

export type ReelStatus = 'RENDERING' | 'READY' | 'FAILED';

export type ReelRecord = {
  id: string;
  userId: string;
  scriptId: string;
  channelId?: string | null;
  personaId?: string | null;
  platform?: string | null;
  language?: string | null;
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
  customSettings?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type ScriptRecord = {
  id: string;
  userId: string;
  channelId?: string | null;
  personaId?: string | null;
  platform?: string | null;
  language?: string | null;
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
    language: row.language ?? null,
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
    language: row.language ?? null,
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
    customSettings: row.custom_settings ?? null,
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

  const basePrompt = [
    'Generate a COMPLETE Hindi voiceover script.',
    '',
    `Topic: ${idea}`,
    `Target duration: ${durationSec} seconds`,
    '',
    'Rules:',
    '- Single continuous paragraph',
    '- No bullet points',
    '- No markdown',
    '- No emojis',
    '- No truncation',
    '- Must end with a full sentence',
    '- Approx length:',
    '  15s ≈ 40–50 words',
    '  30s ≈ 90–110 words',
    '  45s ≈ 140–160 words',
    '',
    'Return ONLY the script text.',
    ...channelLines,
  ]
    .filter(Boolean)
    .join('\n');

  const text = await generateCompletion(basePrompt, { temperature: 0.6, maxTokens: 800, provider });
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
  language?: string | null;
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
  const now = new Date().toISOString();
  const fullPayload = {
    user_id: payload.userId,
    channel_id: payload.channelId || null,
    persona_id: payload.personaId || null,
    platform: payload.platform || null,
    language: payload.language || null,
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
    created_at: now,
    updated_at: now,
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
    if (
      msg.includes('brand_colors') ||
      msg.includes('template') ||
      msg.includes('logo_url') ||
      msg.includes('audio') ||
      msg.includes('language')
    ) {
      const trimmed = {
        user_id: payload.userId,
        channel_id: payload.channelId || null,
        persona_id: payload.personaId || null,
        platform: payload.platform || null,
        language: payload.language || null,
        tone: payload.tone || null,
        style: payload.style || null,
        duration_sec: payload.durationSec ?? null,
        input_prompt: payload.inputPrompt || null,
        text: payload.text,
        created_at: now,
        updated_at: now,
      };
      let retry = await supabaseAdmin.from('scripts').insert(trimmed).select('*').maybeSingle();
      if (retry.error && (retry.error.message || '').toLowerCase().includes('language')) {
        const { language, ...trimmedWithoutLanguage } = trimmed;
        retry = await supabaseAdmin
          .from('scripts')
          .insert(trimmedWithoutLanguage)
          .select('*')
          .maybeSingle();
      }
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
  language?: string | null;
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
  const now = new Date().toISOString();
  const fullInsert = {
    user_id: payload.userId,
    script_id: payload.scriptId,
    channel_id: payload.channelId || null,
    persona_id: payload.personaId || null,
    platform: payload.platform || null,
    language: payload.language || null,
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
    created_at: now,
    updated_at: now,
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
    if (
      msg.includes('brand_colors') ||
      msg.includes('template') ||
      msg.includes('logo_url') ||
      msg.includes('audio') ||
      msg.includes('language')
    ) {
      const trimmed = {
        user_id: payload.userId,
        script_id: payload.scriptId,
        channel_id: payload.channelId || null,
        persona_id: payload.personaId || null,
        platform: payload.platform || null,
        language: payload.language || null,
        tone: payload.tone || null,
        style: payload.style || null,
        duration_sec: payload.durationSec ?? null,
        status: payload.status,
        renderer_job_id: payload.rendererJobId || null,
        video_url: payload.videoUrl || null,
        thumbnail_url: payload.thumbnailUrl || null,
        error_message: payload.errorMessage || null,
        created_at: now,
        updated_at: now,
      };
      let retry = await supabaseAdmin.from('reels').insert(trimmed).select('*').maybeSingle();
      if (retry.error && (retry.error.message || '').toLowerCase().includes('language')) {
        const { language, ...trimmedWithoutLanguage } = trimmed;
        retry = await supabaseAdmin
          .from('reels')
          .insert(trimmedWithoutLanguage)
          .select('*')
          .maybeSingle();
      }
      if (!retry.error && retry.data) {
        data = retry.data;
        error = null;
      } else {
        if ((retry.error?.message || '').toLowerCase().includes('template')) {
          throw new HttpError(
            'Supabase schema cache is missing optional columns (template/brand/audio). Please run the migration web/docs/sql/ai_reels_tables.sql or refresh Supabase schema cache.',
            500,
          );
        }
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

  if (!idea && !scriptTextInput) {
    throw new HttpError('Provide either an idea or a script to generate a reel.', 422);
  }

  let finalScript = scriptTextInput;
  if (!finalScript) {
    finalScript = await generateScriptFromIdea({
      idea,
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
    language,
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
    inputPrompt: idea || null,
    text: finalScript,
  });

  const rendererJob = await triggerRenderer({
    scriptText: finalScript,
    style,
    template,
    durationSec,
    language,
    withVoiceover: payload.withVoiceover !== false,
  });

  const reelStatus: ReelStatus =
    rendererJob.status === 'ready' ? 'READY' : rendererJob.status === 'failed' ? 'FAILED' : 'RENDERING';
  const reel = await insertReelRecord({
    userId: user.id,
    channelId,
    scriptId: script.id,
    personaId,
    platform,
    language,
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
    rendererJobId: rendererJob.jobId,
    videoUrl: rendererJob.videoUrl ?? null,
    thumbnailUrl: rendererJob.thumbnailUrl ?? null,
    errorMessage: rendererJob.error || null,
  });

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

  if (data.status === 'RENDERING' && data.renderer_job_id) {
    const rendererStatus = await getRendererStatus(data.renderer_job_id);
    if (rendererStatus) {
      if (rendererStatus.status === 'ready') {
        if (!rendererStatus.videoUrl || !rendererStatus.thumbnailUrl) {
          return await updateReelStatus(reelId, userId, {
            status: 'FAILED',
            errorMessage: 'Renderer returned ready without assets',
          });
        }
        return await updateReelStatus(reelId, userId, {
          status: 'READY',
          videoUrl: rendererStatus.videoUrl,
          thumbnailUrl: rendererStatus.thumbnailUrl,
          errorMessage: rendererStatus.error || null,
        });
      }
      if (rendererStatus.status === 'failed') {
        return await updateReelStatus(reelId, userId, {
          status: 'FAILED',
          errorMessage: rendererStatus.error || 'Renderer job failed',
        });
      }
    }
  }

  return mapReel(data);
}
