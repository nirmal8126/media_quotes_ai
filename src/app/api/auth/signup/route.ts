import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';

type SignupPayload = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= 2;
}

function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && value.includes('@');
}

function isValidPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SignupPayload;
  const name = isValidName(body.name) ? body.name.trim() : '';
  const email = isValidEmail(body.email) ? body.email.trim() : '';
  const password = isValidPassword(body.password) ? body.password : '';

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: 'Provide a valid name, email, and password (min 8 characters).' },
      { status: 422 },
    );
  }

  const supabase = createSupabaseClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: name },
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
  }

  if (data.user?.id) {
    try {
      await supabaseAdmin
        .from('users')
        .upsert(
          {
            id: data.user.id,
            email: data.user.email,
            full_name: name,
            plan_tier: 'standard',
            quota_used: 0,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' },
        );
    } catch (insertError) {
      console.error('Failed to sync Supabase auth user to public.users', insertError);
    }
  }

  return NextResponse.json({ user: data.user });
}
