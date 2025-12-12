import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { requireSuperAdmin } from "@/lib/api-auth";

export async function GET(request: Request) {
  const session = await requireSuperAdmin(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;

  const { searchParams } = new URL(request.url);
  const perPage = Math.max(1, Math.min(500, Number(searchParams.get("limit")) || 200));

  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage });
    if (error) {
      const response = NextResponse.json({ error: error.message || "Unable to load users" }, { status: 500 });
      applyCookies(response);
      return response;
    }

    const users =
      data?.users?.map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        app_metadata: u.app_metadata,
        user_metadata: u.user_metadata,
      })) ?? [];

    const response = NextResponse.json({ users });
    applyCookies(response);
    return response;
  } catch (err) {
    const response = NextResponse.json(
      { error: (err as Error).message || "Unable to load users" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
