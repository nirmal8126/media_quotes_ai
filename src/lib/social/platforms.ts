import { supabaseAdmin } from "@/lib/supabase";

export async function isPlatformEnabled(platform: string): Promise<boolean> {
  const normalized = platform.trim().toLowerCase();
  const { data, error } = await supabaseAdmin
    .from("social_platforms")
    .select("enabled")
    .eq("platform", normalized)
    .maybeSingle();

  if (error || !data) {
    return false;
  }

  return Boolean(data.enabled);
}
