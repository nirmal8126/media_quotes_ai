import { supabaseAdmin } from '@/lib/supabase';
import { generateCompletion, type LlmProvider } from '@/lib/openai';
import { getChannel } from '@/lib/channel-service';

export type ChannelIdea = {
  id: string;
  userId: string;
  channelId: string;
  idea: string;
  source?: string | null;
  tags?: string[] | null;
  createdAt?: string | null;
};

function mapIdea(row: Record<string, any>): ChannelIdea {
  return {
    id: row.id,
    userId: row.user_id,
    channelId: row.channel_id,
    idea: row.idea,
    source: row.source ?? null,
    tags: row.tags ?? null,
    createdAt: row.created_at ?? null,
  };
}

export async function listChannelIdeas(userId: string, channelId: string): Promise<ChannelIdea[]> {
  const { data, error } = await supabaseAdmin
    .from('channel_ideas')
    .select('*')
    .eq('user_id', userId)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message || 'Unable to load channel ideas');
  }
  return (data ?? []).map(mapIdea);
}

export async function addChannelIdea(params: {
  userId: string;
  channelId: string;
  idea: string;
  source?: string;
  tags?: string[];
}) {
  const { data, error } = await supabaseAdmin
    .from('channel_ideas')
    .insert({
      user_id: params.userId,
      channel_id: params.channelId,
      idea: params.idea.trim(),
      source: params.source ?? 'user',
      tags: params.tags ?? null,
      created_at: new Date().toISOString(),
    })
    .select('*')
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message || 'Unable to save channel idea');
  }

  return mapIdea(data);
}

export async function deleteChannelIdea(userId: string, ideaId: string) {
  const { error } = await supabaseAdmin
    .from('channel_ideas')
    .delete()
    .eq('user_id', userId)
    .eq('id', ideaId);

  if (error) {
    throw new Error(error.message || 'Unable to delete channel idea');
  }
}

export async function generateChannelIdeas(options: {
  userId: string;
  channelId: string;
  count?: number;
  provider?: LlmProvider;
}) {
  const { userId, channelId, count = 8, provider } = options;
  const channel = await getChannel(userId, channelId);
  if (!channel) {
    throw new Error('Channel not found for this user');
  }

  const topic = channel.topic || channel.name;
  const style = channel.style || channel.visualStyle || channel.tone || 'default';
  const audience = channel.audience || 'general';
  const prompt = [
    `Generate ${Math.max(3, Math.min(count, 20))} short, punchy reel ideas for the channel "${channel.name}".`,
    `Topic/niche: ${topic}. Audience: ${audience}. Style: ${style}.`,
    channel.styleRules ? `Content rules: ${channel.styleRules}.` : '',
    'Keep ideas on-topic and varied; avoid duplicates.',
    'Return a JSON array of idea strings only.',
  ]
    .filter(Boolean)
    .join(' ');

  const raw = await generateCompletion(prompt, { temperature: 0.85, maxTokens: 400, provider });
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean)
        .slice(0, Math.max(3, Math.min(count, 20)));
    }
  } catch {
    // fall through to line split
  }

  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean)
    .slice(0, Math.max(3, Math.min(count, 20)));
}
