import { supabaseAdmin } from '@/lib/supabase';
import { evaluateQuota, normalizePlanTier, type PlanTier } from '@/lib/plan';
import { generateCompletion, type LlmProvider } from '@/lib/openai';

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
        created_at: new Date().toISOString(),
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
    status: record.status ?? 'generated',
    script_id: scriptId,
    created_at: new Date().toISOString(),
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

function tryParseJson(input: string): any | null {
  try {
    return JSON.parse(input);
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
    topic ? `Topic: ${topic}.` : "",
    hookHint ? `Use this hook or angle: ${hookHint}.` : "",
    `Return plain text only (no JSON). Format as:`,
    `Hook: <one engaging line>\nIntro: <1-2 lines>\nValue: <2-3 lines>\nCTA: <1 line>`,
  ]
    .filter(Boolean)
    .join(" ");
  const raw = await generateCompletion(prompt, { temperature: 0.65, maxTokens: 450, provider });

  const cleaned = cleanJsonLike(raw);
  const parsed = tryParseJson(cleaned);

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
    topic ? `Topic: ${topic}.` : "",
    hookHint ? `Hook: ${hookHint}.` : "",
    `Return plain text (no JSON). Include a short CTA at the end.`,
  ]
    .filter(Boolean)
    .join(" ");
  const raw = await generateCompletion(prompt, { temperature: 0.7, maxTokens: 180, provider });

  const cleaned = cleanJsonLike(raw);
  const parsed = tryParseJson(cleaned);

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

  try {
    const parsed = JSON.parse(raw) as {
      hooks?: unknown[];
      titles?: unknown[];
      scripts?: unknown[];
      hashtags?: unknown[];
    };
    const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.map((h) => String(h || '')).filter(Boolean) : [];
    const titles = Array.isArray(parsed.titles) ? parsed.titles.map((h) => String(h || '')).filter(Boolean) : [];
    const scripts = Array.isArray(parsed.scripts) ? parsed.scripts.map((h) => String(h || '')).filter(Boolean) : [];
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((set) =>
          Array.isArray(set) ? set.map((t) => String(t || '')).filter(Boolean) : String(set || '').split(/[,\n]/).map((t) => t.trim()).filter(Boolean),
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
  } catch {
    return fallback;
  }
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

  try {
    const parsed = JSON.parse(raw) as Array<{
      label?: string;
      text?: string;
      durationMs?: number;
      visualSuggestion?: string;
    }>;
    if (Array.isArray(parsed)) {
      const normalized = normalize(parsed);
      if (normalized.length) return normalized;
    }
  } catch {
    // fall through
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

export async function resolvePlanTier(planTier?: string): Promise<PlanTier> {
  return normalizePlanTier(planTier);
}
