import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { DEFAULT_LANGUAGE } from '@/lib/languages';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { user, applyCookies } = session;
  const { data, error } = await supabaseAdmin
    .from('personas')
    .select('id, name, description, tone, language, tags, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    const response = NextResponse.json({ error: 'Unable to load personas' }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ personas: data ?? [] });
  applyCookies(response);
  return response;
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const tone = typeof body?.tone === 'string' ? body.tone.trim() : null;
  const language = typeof body?.language === 'string' ? body.language.trim() : DEFAULT_LANGUAGE;
  const tags = Array.isArray(body?.tags) ? body.tags.map((t: unknown) => String(t).trim()).filter(Boolean) : [];

  if (!name) {
    const response = NextResponse.json({ error: 'Name is required' }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from('personas')
    .insert({
      user_id: user.id,
      name,
      description,
      tone,
      language,
      tags,
      created_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();

  if (error) {
    const response = NextResponse.json({ error: 'Unable to create persona' }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ personaId: data?.id, message: 'Persona created' });
  applyCookies(response);
  return response;
}
