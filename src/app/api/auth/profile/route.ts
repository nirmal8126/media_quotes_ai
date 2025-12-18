import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/api-auth';

function isUrl(value?: string | null) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isPhone(value?: string | null) {
  if (!value) return true;
  const normalized = value.replace(/[^\d+]/g, '');
  return normalized.length >= 7 && normalized.length <= 18;
}

function isUsername(value?: string | null) {
  if (!value) return true;
  return /^[a-zA-Z0-9_.-]{3,30}$/.test(value);
}

function sanitizeSocialLinks(raw: Record<string, unknown> | undefined) {
  const allowed = ['facebook', 'x', 'twitter', 'linkedin', 'github', 'website', 'dribbble', 'instagram'];
  const result: Record<string, string> = {};
  if (!raw) return result;
  for (const key of allowed) {
    const val = raw[key];
    if (typeof val === 'string' && val.trim() && isUrl(val.trim())) {
      result[key] = val.trim();
    }
  }
  return result;
}

function mapProfile(user: any) {
  const meta = user?.user_metadata ?? {};
  return {
    id: user?.id,
    email: user?.email ?? '',
    fullName: meta.full_name || meta.name || '',
    phone: meta.phone || '',
    username: meta.username || '',
    bio: meta.bio || '',
    avatarUrl: meta.avatar_url || meta.avatar || '',
    coverUrl: meta.cover_url || '',
    socialLinks: meta.social_links || {},
  };
}

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const response = NextResponse.json({ profile: mapProfile(user) });
  applyCookies(response);
  return response;
}

export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { supabase, applyCookies, user } = session;
  const body = await request.json().catch(() => ({}));

  const fullName = typeof body?.fullName === 'string' ? body.fullName.trim() : undefined;
  const bio = typeof body?.bio === 'string' ? body.bio.trim() : undefined;
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : undefined;
  const username = typeof body?.username === 'string' ? body.username.trim() : undefined;
  const avatarUrl = typeof body?.avatarUrl === 'string' ? body.avatarUrl.trim() : undefined;
  const coverUrl = typeof body?.coverUrl === 'string' ? body.coverUrl.trim() : undefined;
  const socialLinks = sanitizeSocialLinks(body?.socialLinks);

  const errors: string[] = [];
  if (fullName !== undefined && (fullName.length < 2 || fullName.length > 80)) {
    errors.push('Full name must be between 2 and 80 characters.');
  }
  if (bio !== undefined && bio.length > 500) {
    errors.push('Bio must be 500 characters or fewer.');
  }
  if (username !== undefined && !isUsername(username)) {
    errors.push('Username must be 3-30 characters (letters, numbers, underscore, dot, dash).');
  }
  if (!isPhone(phone)) {
    errors.push('Phone number format is invalid.');
  }
  if (!isUrl(avatarUrl)) {
    errors.push('Avatar URL must be a valid http/https URL.');
  }
  if (!isUrl(coverUrl)) {
    errors.push('Cover URL must be a valid http/https URL.');
  }

  if (errors.length) {
    const response = NextResponse.json({ error: errors.join(' ') }, { status: 422 });
    applyCookies(response);
    return response;
  }

  const currentMeta = user.user_metadata || {};
  const updatedMeta = {
    ...currentMeta,
    ...(fullName !== undefined ? { full_name: fullName } : {}),
    ...(bio !== undefined ? { bio } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(username !== undefined ? { username } : {}),
    ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
    ...(coverUrl !== undefined ? { cover_url: coverUrl } : {}),
    ...(Object.keys(socialLinks).length ? { social_links: socialLinks } : {}),
  };

  const { data, error } = await supabase.auth.updateUser({
    data: updatedMeta,
  });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ profile: mapProfile(data.user) });
  applyCookies(response);
  return response;
}
