import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { validatePasswordStrong } from "@/lib/validation";

export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ('errorResponse' in session) {
    return session.errorResponse;
  }

  const { supabase, applyCookies } = session;
  const body = await request.json().catch(() => ({}));
  const passwordResult = validatePasswordStrong(body?.password);

  if (!passwordResult.valid || !passwordResult.value) {
    const response = NextResponse.json(
      { error: passwordResult.message ?? "Password must meet the complexity requirements." },
      { status: 422 },
    );
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabase.auth.updateUser({ password: passwordResult.value });

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: error.status });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ user: data.user });
  applyCookies(response);
  return response;
}
