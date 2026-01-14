import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

type SocialPlatform = {
  platform: string;
  name: string;
  overview: string | null;
  enabled: boolean;
};

type SocialAccount = {
  platform: string;
  page_id: string | null;
  page_name: string | null;
};

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const [{ data: platforms, error: platformError }, { data: accounts, error: accountError }] = await Promise.all([
    supabaseAdmin
      .from("social_platforms")
      .select("platform, name, overview, enabled")
      .eq("enabled", true)
      .order("name", { ascending: true }),
    supabaseAdmin
      .from("social_accounts")
      .select("platform, page_id, page_name")
      .eq("user_id", session.user.id),
  ]);

  if (platformError || accountError) {
    const response = NextResponse.json({ error: "Unable to load social platforms." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }

  const accountMap = new Map(
    (accounts ?? []).map((account) => [account.platform, account as SocialAccount]),
  );

  const result = (platforms as SocialPlatform[] | null)?.map((platform) => {
    const account = accountMap.get(platform.platform);
    return {
      platform: platform.platform,
      name: platform.name,
      overview: platform.overview,
      enabled: platform.enabled,
      connected: Boolean(account),
      connected_profile: account?.page_name ?? null,
      connected_id: account?.page_id ?? null,
    };
  });

  const response = NextResponse.json({ platforms: result ?? [] });
  session.applyCookies(response);
  return response;
}
