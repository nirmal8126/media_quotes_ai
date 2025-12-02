import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const fallback = {
  platforms: ['instagram', 'tiktok', 'youtube', 'twitter', 'linkedin'],
  niches: ['fitness', 'business', 'travel', 'spirituality', 'aesthetic'],
  formats: ['quote', 'caption', 'short script', 'long script', 'hook', 'post'],
  tones: ['motivational', 'professional', 'funny', 'dark aesthetic', 'friendly'],
};

export async function GET() {
  const result = { ...fallback };

  const queries = [
    supabaseAdmin.from('default_platforms').select('name'),
    supabaseAdmin.from('default_niches').select('name'),
    supabaseAdmin.from('default_formats').select('name'),
    supabaseAdmin.from('default_tones').select('name'),
  ];

  try {
    const [platforms, niches, formats, tones] = await Promise.all(queries);

    if (!platforms.error && platforms.data) result.platforms = platforms.data.map((row) => row.name).filter(Boolean);
    if (!niches.error && niches.data) result.niches = niches.data.map((row) => row.name).filter(Boolean);
    if (!formats.error && formats.data) result.formats = formats.data.map((row) => row.name).filter(Boolean);
    if (!tones.error && tones.data) result.tones = tones.data.map((row) => row.name).filter(Boolean);
  } catch (error) {
    console.error('Failed to load meta defaults', error);
  }

  return NextResponse.json(result);
}
