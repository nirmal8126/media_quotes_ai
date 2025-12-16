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
  const payload = {
    user_id: record.userId,
    channel_id: record.channelId || null,
    tone: record.tone || null,
    platform: record.platform || null,
    script: record.script || null,
    shot_breakdown: record.shotBreakdown || null,
    caption: record.caption || null,
    hashtags: record.hashtags || null,
    thumbnail_prompt: record.thumbnailPrompt || null,
    hook: record.hook || null,
    status: record.status || 'generated',
    scheduled_date: record.scheduledDate || null,
    published_at: record.publishedAt || null,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from('generated_reels')
    .insert(payload)
    .select('id')
    .maybeSingle();

  if (error) {
    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('status') || message.includes('generated_reels')) {
      console.error('Failed to persist generated reel. Ensure generated_reels has status/scheduled/published columns.', error);
    } else {
      console.error('Failed to persist generated reel', error);
    }
    return null;
  }

  return data;
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

export async function generateScriptAssets(tone: string, platform: string, provider?: LlmProvider) {
  const prompt = `Write a 45-60 second ${tone} ${platform} reel script with Hook, Intro, Value, and CTA sections. Also list 3 shot directions (Camera, Movement) after the script. Return a JSON object: {"script":string, "shots":string[], "hook":string}.`;
  const raw = await generateCompletion(prompt, { temperature: 0.65, maxTokens: 450, provider });

  let script = raw;
  let shotBreakdown: string[] = [];
  let hook = raw.split('\n')[0]?.trim() ?? '';

  try {
    const parsed = JSON.parse(raw);
    script = parsed.script ?? script;
    shotBreakdown = Array.isArray(parsed.shots) ? parsed.shots : [];
    hook = parsed.hook ?? hook;
  } catch {
    // fallback: split lines
    shotBreakdown = raw.split(/\n|\.|!|\?/).filter((line) => line.trim().length > 3).slice(0, 3);
  }

  return { script: script.trim(), shotBreakdown, hook: hook.trim() };
}

export async function generateCaptionContent(tone: string, platform: string, provider?: LlmProvider) {
  const prompt = `Generate a single ${platform} caption in a ${tone} tone that teases the video, invites engagement, and includes a clear CTA. Return JSON {"caption":string, "callToAction":string}.`;
  const raw = await generateCompletion(prompt, { temperature: 0.7, maxTokens: 180, provider });

  let caption = raw;
  let callToAction = 'Drop a comment.';

  try {
    const parsed = JSON.parse(raw);
    caption = parsed.caption ?? caption;
    callToAction = parsed.callToAction ?? callToAction;
  } catch {
    // try splitting
    const sentences = caption.split(/[.!?]\s+/);
    callToAction = sentences.pop() ?? callToAction;
  }

  return { caption: caption.trim(), callToAction: callToAction.trim() };
}

export async function generateThumbnailPrompt(tone: string, platform: string, provider?: LlmProvider) {
  const prompt = `Describe a bold thumbnail idea for a ${platform} reel with a ${tone} tone. Mention key colors, face/pose, text overlay, and energy.`;
  const raw = await generateCompletion(prompt, { temperature: 0.75, maxTokens: 150, provider });
  return raw;
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
