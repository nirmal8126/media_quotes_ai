import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import { createChannel, deleteChannel, listChannels, updateChannel } from '@/lib/channel-service';

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;

  try {
    const channels = await listChannels(user.id);
    const response = NextResponse.json({ channels });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || 'Unable to load channels' },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const body = await request.json().catch(() => ({}));
  const name = (body.name ?? '').trim();
  if (!name) {
    const response = NextResponse.json({ error: 'Channel name is required' }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const channel = await createChannel(user.id, {
      name,
      platform: body.platform ?? null,
      handle: body.handle ?? null,
      personaId: body.personaId ?? null,
      tone: body.tone ?? null,
      style: body.style ?? null,
      topic: body.topic ?? null,
      language: body.language ?? null,
      styleRules: body.styleRules ?? null,
      visualStyle: body.visualStyle ?? null,
      postingFrequency: body.postingFrequency ?? null,
      characterName: body.characterName ?? null,
      characterImages: Array.isArray(body.characterImages)
        ? body.characterImages
        : typeof body.characterImages === 'string'
          ? body.characterImages.split(',').map((v: string) => v.trim()).filter(Boolean)
        : null,
      logoUrl: body.logoUrl ?? null,
      audience: body.audience ?? null,
      contentType: body.contentType ?? null,
      brandColors: Array.isArray(body.brandColors)
        ? body.brandColors
        : typeof body.brandColors === 'string'
          ? body.brandColors.split(',').map((v: string) => v.trim()).filter(Boolean)
          : null,
      brandFonts: Array.isArray(body.brandFonts)
        ? body.brandFonts
        : typeof body.brandFonts === 'string'
          ? body.brandFonts.split(',').map((v: string) => v.trim()).filter(Boolean)
          : null,
      endScreenTemplate: body.endScreenTemplate ?? null,
      durationDefault:
        typeof body.durationDefault === 'number'
          ? body.durationDefault
          : Number.isFinite(Number(body.durationDefault))
            ? Number(body.durationDefault)
            : null,
      ctaDefault: body.ctaDefault ?? null,
      baseHashtags: Array.isArray(body.baseHashtags)
        ? body.baseHashtags
        : typeof body.baseHashtags === 'string'
          ? body.baseHashtags.split(',').map((v: string) => v.trim()).filter(Boolean)
          : null,
      defaults: body.defaults ?? null,
    });
    const response = NextResponse.json({ channel });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || 'Unable to create channel' },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}

export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const body = await request.json().catch(() => ({}));
  const channelId = (body.id ?? body.channelId ?? '').trim();
  if (!channelId) {
    const response = NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const channel = await updateChannel(user.id, channelId, {
      name: body.name,
      platform: body.platform,
      handle: body.handle,
      personaId: body.personaId,
      tone: body.tone,
      style: body.style,
      topic: body.topic,
      language: body.language,
      styleRules: body.styleRules,
      visualStyle: body.visualStyle,
      postingFrequency: body.postingFrequency,
      characterName: body.characterName,
      characterImages: Array.isArray(body.characterImages)
        ? body.characterImages
        : typeof body.characterImages === 'string'
          ? body.characterImages.split(',').map((v: string) => v.trim()).filter(Boolean)
          : undefined,
      logoUrl: body.logoUrl,
      audience: body.audience,
      contentType: body.contentType,
      brandColors: Array.isArray(body.brandColors)
        ? body.brandColors
        : typeof body.brandColors === 'string'
          ? body.brandColors.split(',').map((v: string) => v.trim()).filter(Boolean)
          : undefined,
      brandFonts: Array.isArray(body.brandFonts)
        ? body.brandFonts
        : typeof body.brandFonts === 'string'
          ? body.brandFonts.split(',').map((v: string) => v.trim()).filter(Boolean)
          : undefined,
      endScreenTemplate: body.endScreenTemplate,
      durationDefault:
        typeof body.durationDefault === 'number'
          ? body.durationDefault
          : Number.isFinite(Number(body.durationDefault))
            ? Number(body.durationDefault)
            : undefined,
      ctaDefault: body.ctaDefault,
      baseHashtags: Array.isArray(body.baseHashtags)
        ? body.baseHashtags
        : typeof body.baseHashtags === 'string'
          ? body.baseHashtags.split(',').map((v: string) => v.trim()).filter(Boolean)
          : undefined,
      defaults: body.defaults,
    });
    const response = NextResponse.json({ channel });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || 'Unable to update channel' },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}

export async function DELETE(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const channelId = searchParams.get('channelId') || searchParams.get('id');
  if (!channelId) {
    const response = NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    await deleteChannel(user.id, channelId);
    const response = NextResponse.json({ success: true });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || 'Unable to delete channel' },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
