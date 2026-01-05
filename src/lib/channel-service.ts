import { supabaseAdmin } from '@/lib/supabase';

export type ChannelRecord = {
  id: string;
  userId: string;
  name: string;
  platform?: string | null;
  handle?: string | null;
  personaId?: string | null;
  tone?: string | null;
  style?: string | null;
  topic?: string | null;
  characterName?: string | null;
  characterImages?: string[] | null;
  logoUrl?: string | null;
  audience?: string | null;
  contentType?: string | null;
  language?: string | null;
  styleRules?: string | null;
  visualStyle?: string | null;
  postingFrequency?: string | null;
  brandColors?: string[] | null;
  brandFonts?: string[] | null;
  endScreenTemplate?: string | null;
  durationDefault?: number | null;
  ctaDefault?: string | null;
  baseHashtags?: string[] | null;
  defaults?: Record<string, unknown> | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function mapChannel(row: Record<string, any>): ChannelRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    platform: row.platform ?? null,
    handle: row.handle ?? row.url ?? null,
    personaId: row.persona_id ?? null,
    tone: row.tone ?? null,
    style: row.style ?? null,
    topic: row.topic ?? null,
    characterName: row.character_name ?? null,
    characterImages: row.character_images ?? null,
    logoUrl: row.logo_url ?? null,
    audience: row.audience ?? null,
    contentType: row.content_type ?? null,
    language: row.language ?? null,
    styleRules: row.style_rules ?? null,
    visualStyle: row.visual_style ?? null,
    postingFrequency: row.posting_frequency ?? null,
    brandColors: row.brand_colors ?? null,
    brandFonts: row.brand_fonts ?? null,
    endScreenTemplate: row.end_screen_template ?? null,
    durationDefault: row.duration_default ?? null,
    ctaDefault: row.cta_default ?? null,
    baseHashtags: row.base_hashtags ?? null,
    defaults: (row.defaults as Record<string, unknown>) ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function missingTableMessage() {
  return 'Table "channels" is missing. Add it in Supabase before using channel-specific reels.';
}

function isMissingLanguageColumn(error?: { message?: string | null }) {
  const message = error?.message?.toLowerCase() ?? '';
  return message.includes('language') && message.includes('channel');
}

export async function listChannels(userId: string): Promise<ChannelRecord[]> {
  const { data, error } = await supabaseAdmin
    .from('channels')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('relation') && message.includes('channels')) {
      throw new Error(missingTableMessage());
    }
    throw new Error(error.message || 'Unable to load channels');
  }

  return (data ?? []).map(mapChannel);
}

export async function getChannel(userId: string, channelId: string): Promise<ChannelRecord | null> {
  const { data, error } = await supabaseAdmin
    .from('channels')
    .select('*')
    .eq('user_id', userId)
    .eq('id', channelId)
    .maybeSingle();

  if (error) {
    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('relation') && message.includes('channels')) {
      throw new Error(missingTableMessage());
    }
    throw new Error(error.message || 'Unable to load channel');
  }

  return data ? mapChannel(data) : null;
}

export async function createChannel(userId: string, payload: {
  name: string;
  platform?: string | null;
  handle?: string | null;
  personaId?: string | null;
  tone?: string | null;
  style?: string | null;
  topic?: string | null;
  characterName?: string | null;
  characterImages?: string[] | null;
  logoUrl?: string | null;
  audience?: string | null;
  contentType?: string | null;
  language?: string | null;
  styleRules?: string | null;
  visualStyle?: string | null;
  postingFrequency?: string | null;
  brandColors?: string[] | null;
  brandFonts?: string[] | null;
  endScreenTemplate?: string | null;
  durationDefault?: number | null;
  ctaDefault?: string | null;
  baseHashtags?: string[] | null;
  defaults?: Record<string, unknown> | null;
}): Promise<ChannelRecord> {
  const now = new Date().toISOString();
  const baseInsert = {
    user_id: userId,
    name: payload.name.trim(),
    platform: payload.platform || null,
    handle: payload.handle || null,
    persona_id: payload.personaId || null,
    tone: payload.tone || null,
    style: payload.style || null,
    topic: payload.topic || null,
    character_name: payload.characterName || null,
    character_images: payload.characterImages || null,
    logo_url: payload.logoUrl || null,
    audience: payload.audience || null,
    content_type: payload.contentType || null,
    language: payload.language || null,
    style_rules: payload.styleRules || null,
    visual_style: payload.visualStyle || null,
    posting_frequency: payload.postingFrequency || null,
    brand_colors: payload.brandColors || null,
    brand_fonts: payload.brandFonts || null,
    end_screen_template: payload.endScreenTemplate || null,
    duration_default: payload.durationDefault ?? null,
    cta_default: payload.ctaDefault || null,
    base_hashtags: payload.baseHashtags || null,
    defaults: payload.defaults || null,
    created_at: now,
    updated_at: now,
  };

  let { data, error } = await supabaseAdmin.from('channels').insert(baseInsert).select('*').maybeSingle();

  if (error && isMissingLanguageColumn(error)) {
    // Fallback for environments that have not yet added the language column
    const { language, ...withoutLanguage } = baseInsert;
    ({ data, error } = await supabaseAdmin.from('channels').insert(withoutLanguage).select('*').maybeSingle());
  }

  if (error) {
    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('relation') && message.includes('channels')) {
      throw new Error(missingTableMessage());
    }
    const missingColumns = ['style_rules', 'visual_style', 'posting_frequency', 'brand_colors', 'brand_fonts', 'end_screen_template', 'language'];
    if (missingColumns.some((col) => message.includes(col))) {
      throw new Error('Channels table is missing identity/brand columns. Run docs/sql/channels.sql in Supabase.');
    }
    throw new Error(error.message || 'Unable to create channel');
  }

  if (!data) {
    throw new Error('No channel returned after create');
  }

  return mapChannel(data);
}

export async function updateChannel(userId: string, channelId: string, payload: Partial<{
  name: string;
  platform: string | null;
  handle: string | null;
  personaId: string | null;
  tone: string | null;
  style: string | null;
  topic: string | null;
  characterName: string | null;
  characterImages: string[] | null;
  logoUrl: string | null;
  audience: string | null;
  contentType: string | null;
  language: string | null;
  styleRules: string | null;
  visualStyle: string | null;
  postingFrequency: string | null;
  brandColors: string[] | null;
  brandFonts: string[] | null;
  endScreenTemplate: string | null;
  durationDefault: number | null;
  ctaDefault: string | null;
  baseHashtags: string[] | null;
  defaults: Record<string, unknown> | null;
}>): Promise<ChannelRecord> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (payload.name !== undefined) updates.name = payload.name.trim();
  if (payload.platform !== undefined) updates.platform = payload.platform;
  if (payload.handle !== undefined) updates.handle = payload.handle;
  if (payload.personaId !== undefined) updates.persona_id = payload.personaId;
  if (payload.tone !== undefined) updates.tone = payload.tone;
  if (payload.style !== undefined) updates.style = payload.style;
  if (payload.topic !== undefined) updates.topic = payload.topic;
  if (payload.characterName !== undefined) updates.character_name = payload.characterName;
  if (payload.characterImages !== undefined) updates.character_images = payload.characterImages;
  if (payload.logoUrl !== undefined) updates.logo_url = payload.logoUrl;
  if (payload.audience !== undefined) updates.audience = payload.audience;
  if (payload.contentType !== undefined) updates.content_type = payload.contentType;
  if (payload.language !== undefined) updates.language = payload.language;
  if (payload.styleRules !== undefined) updates.style_rules = payload.styleRules;
  if (payload.visualStyle !== undefined) updates.visual_style = payload.visualStyle;
  if (payload.postingFrequency !== undefined) updates.posting_frequency = payload.postingFrequency;
  if (payload.brandColors !== undefined) updates.brand_colors = payload.brandColors;
  if (payload.brandFonts !== undefined) updates.brand_fonts = payload.brandFonts;
  if (payload.endScreenTemplate !== undefined) updates.end_screen_template = payload.endScreenTemplate;
  if (payload.durationDefault !== undefined) updates.duration_default = payload.durationDefault;
  if (payload.ctaDefault !== undefined) updates.cta_default = payload.ctaDefault;
  if (payload.baseHashtags !== undefined) updates.base_hashtags = payload.baseHashtags;
  if (payload.defaults !== undefined) updates.defaults = payload.defaults;

  let { data, error } = await supabaseAdmin
    .from('channels')
    .update(updates)
    .eq('user_id', userId)
    .eq('id', channelId)
    .select('*')
    .maybeSingle();

  if (error && isMissingLanguageColumn(error)) {
    const { language, ...withoutLanguage } = updates;
    ({ data, error } = await supabaseAdmin
      .from('channels')
      .update(withoutLanguage)
      .eq('user_id', userId)
      .eq('id', channelId)
      .select('*')
      .maybeSingle());
  }

  if (error) {
    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('relation') && message.includes('channels')) {
      throw new Error(missingTableMessage());
    }
    const missingColumns = ['style_rules', 'visual_style', 'posting_frequency', 'brand_colors', 'brand_fonts', 'end_screen_template', 'language'];
    if (missingColumns.some((col) => message.includes(col))) {
      throw new Error('Channels table is missing identity/brand columns. Run docs/sql/channels.sql in Supabase.');
    }
    throw new Error(error.message || 'Unable to update channel');
  }

  if (!data) {
    throw new Error('Channel not found for update');
  }

  return mapChannel(data);
}

export async function deleteChannel(userId: string, channelId: string) {
  const { error } = await supabaseAdmin
    .from('channels')
    .delete()
    .eq('user_id', userId)
    .eq('id', channelId);

  if (error) {
    const message = error.message?.toLowerCase() ?? '';
    if (message.includes('relation') && message.includes('channels')) {
      throw new Error(missingTableMessage());
    }
    throw new Error(error.message || 'Unable to delete channel');
  }
}
