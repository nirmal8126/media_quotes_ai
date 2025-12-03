import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin } from "@/lib/supabase";
import { buildSupabaseCookies } from "@/lib/supabase-cookies";
import { normalizeEmail, validateEmail, validateName, validatePasswordStrong } from "@/lib/validation";

type SignupPayload = {
  name?: unknown;
  email?: unknown;
  password?: unknown;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase credentials are missing." }, { status: 500 });
  }

  const body = (await request.json().catch(() => ({}))) as SignupPayload;
  const nameResult = validateName(body.name);
  const emailResult = validateEmail(body.email);
  const passwordResult = validatePasswordStrong(body.password);

  if (!nameResult.valid || !emailResult.valid || !passwordResult.valid || !nameResult.value || !emailResult.value || !passwordResult.value) {
    return NextResponse.json(
      { error: nameResult.message || emailResult.message || passwordResult.message || "Invalid sign-up data." },
      { status: 422 },
    );
  }

  const supabaseCookies = buildSupabaseCookies(request);
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: supabaseCookies.cookies,
  });

  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(emailResult.value),
    password: passwordResult.value,
    options: {
      data: { full_name: nameResult.value },
    },
  });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    supabaseCookies.applyToResponse(response);
    return response;
  }

  if (data.user?.id) {
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .upsert(
        {
          id: data.user.id,
          email: data.user.email,
          full_name: nameResult.value,
          plan_tier: "standard",
          quota_used: 0,
          created_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

    if (insertError) {
      const status = (insertError as { status?: number }).status;
      console.error('Failed to sync Supabase auth user to public.users', insertError);
      const response = NextResponse.json(
        { error: 'Database error saving new user', details: insertError.message },
        { status: status ?? 500 },
      );
      supabaseCookies.applyToResponse(response);
      return response;
    }
  }

  const response = NextResponse.json({ user: data.user, session: data.session });
  supabaseCookies.applyToResponse(response);
  return response;
}
