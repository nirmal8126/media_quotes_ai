import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { buildSupabaseCookies } from "@/lib/supabase-cookies";
import { normalizeEmail, validateEmail, validatePasswordBasic } from "@/lib/validation";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.json({ error: "Supabase credentials are missing." }, { status: 500 });
  }

  const body = await request.json();
  const emailResult = validateEmail(body?.email);
  const passwordResult = validatePasswordBasic(body?.password);

  if (!emailResult.valid || !passwordResult.valid || !emailResult.value || !passwordResult.value) {
    return NextResponse.json(
      { error: emailResult.message || passwordResult.message || "Enter a valid email and password." },
      { status: 422 },
    );
  }

  const supabaseCookies = buildSupabaseCookies(request);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: supabaseCookies.cookies,
  });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(emailResult.value),
    password: passwordResult.value,
  });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    supabaseCookies.applyToResponse(response);
    return response;
  }

  const response = NextResponse.json({ session: data.session, user: data.user });
  supabaseCookies.applyToResponse(response);
  return response;
}
