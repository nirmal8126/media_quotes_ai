import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';
import {
  addChannelIdea,
  deleteChannelIdea,
  generateChannelIdeas,
  listChannelIdeas,
} from '@/lib/channel-ideas';
import { getChannel } from '@/lib/channel-service';
import { defaultProvider } from '@/lib/openai';
import { pickProvider } from '@/lib/llm-provider';

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) return session.errorResponse;
  const { user, applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const channelId = (searchParams.get('channelId') ?? '').trim();
  if (!channelId) {
    const response = NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const ideas = await listChannelIdeas(user.id, channelId);
    const response = NextResponse.json({ ideas });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json({ error: (error as Error).message || 'Unable to load ideas' }, { status: 500 });
    applyCookies(response);
    return response;
  }
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) return session.errorResponse;
  const { user, applyCookies } = session;
  const body = await request.json().catch(() => ({}));
  const channelId = (body.channelId ?? '').trim();
  if (!channelId) {
    const response = NextResponse.json({ error: 'channelId is required' }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const channel = await getChannel(user.id, channelId);
    if (!channel) {
      const response = NextResponse.json({ error: 'Channel not found' }, { status: 404 });
      applyCookies(response);
      return response;
    }

    const provider = pickProvider({ bodyProvider: body.provider, user, fallback: defaultProvider });

    if (body.generate === true || body.generate === 'true') {
      const ideas = await generateChannelIdeas({
        userId: user.id,
        channelId,
        count: Number(body.count) || 8,
        provider,
      });
      const stored = [];
      for (const idea of ideas) {
        const saved = await addChannelIdea({
          userId: user.id,
          channelId,
          idea,
          source: 'ai',
        });
        stored.push(saved);
      }
      const response = NextResponse.json({ ideas: stored });
      applyCookies(response);
      return response;
    }

    const idea = (body.idea ?? '').trim();
    if (!idea) {
      const response = NextResponse.json({ error: 'idea is required' }, { status: 400 });
      applyCookies(response);
      return response;
    }

    const saved = await addChannelIdea({
      userId: user.id,
      channelId,
      idea,
      source: body.source ?? 'user',
      tags: Array.isArray(body.tags) ? body.tags : undefined,
    });
    const response = NextResponse.json({ idea: saved });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json({ error: (error as Error).message || 'Unable to save idea' }, { status: 500 });
    applyCookies(response);
    return response;
  }
}

export async function DELETE(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) return session.errorResponse;
  const { user, applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const ideaId = (searchParams.get('id') ?? '').trim();
  if (!ideaId) {
    const response = NextResponse.json({ error: 'id is required' }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    await deleteChannelIdea(user.id, ideaId);
    const response = NextResponse.json({ success: true });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json({ error: (error as Error).message || 'Unable to delete idea' }, { status: 500 });
    applyCookies(response);
    return response;
  }
}
