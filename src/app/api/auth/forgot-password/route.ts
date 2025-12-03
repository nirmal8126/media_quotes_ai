import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase-client";
import { validateEmail } from "@/lib/validation";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const emailResult = validateEmail(body?.email);

  if (!emailResult.valid || !emailResult.value) {
    return NextResponse.json({ error: emailResult.message ?? "Valid email is required." }, { status: 422 });
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.auth.resetPasswordForEmail(emailResult.value, {
    redirectTo: `${SITE_URL}/reset-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  return NextResponse.json({ message: 'Password reset email sent.', data });
}
