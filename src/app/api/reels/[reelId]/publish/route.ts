import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

function normalizeHashtags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((tag) => String(tag || "").trim()).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(/[,\n]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

function ensureHashtags(list: string[]): string[] {
  if (list.length >= 8) return list;
  return [
    "reels",
    "shorts",
    "contentcreator",
    "socialmedia",
    "videomarketing",
    "creator",
    "instareels",
    "youtubeshorts",
    "videoideas",
    "contentmarketing",
    "ai",
    "mediacontent",
  ];
}

function withHashes(list: string[]): string[] {
  return list.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
}

function deriveCaption(scriptText: string | null, fallback: string | null) {
  const base = (fallback || scriptText || "").replace(/\s+/g, " ").trim();
  if (!base) return "New reel ready to publish.";
  const firstSentence = base.split(/[.!?]/).map((s) => s.trim()).find(Boolean) || base;
  const trimmed = firstSentence.length > 220 ? `${firstSentence.slice(0, 217)}...` : firstSentence;
  return `${trimmed}\n\nFollow for more.`;
}

function ensureTag(tags: string[], tag: string) {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.includes(tag.toLowerCase())) return tags;
  return [...tags, tag];
}

function formatCaption(platform: "instagram" | "youtube" | "facebook", caption: string, tags: string[]) {
  if (platform === "youtube") {
    return `${caption}\n\n${ensureTag(tags, "#shorts").join(" ")}`;
  }
  if (platform === "facebook") {
    return `${caption}\n\n${tags.slice(0, 8).join(" ")}`;
  }
  return `${caption}\n\n${tags.join(" ")}`;
}

export async function GET(request: Request, context: { params: Promise<{ reelId?: string }> }) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const params = await context.params;
  const reelId = (params?.reelId ?? "").trim();

  if (!reelId) {
    const response = NextResponse.json({ error: "reelId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const selectBase = `
    id, caption, hashtags, video_url, custom_settings, script_id
  `;

  let { data, error } = await supabaseAdmin
    .from("reels")
    .select(selectBase)
    .eq("id", reelId)
    .eq("user_id", user.id)
    .maybeSingle();

  const errorMsg = (error?.message ?? "").toLowerCase();
  if (error && (errorMsg.includes("caption") || errorMsg.includes("hashtags") || errorMsg.includes("custom_settings"))) {
    const fallbackSelect = `
      id, video_url, script_id
    `;
    ({ data, error } = await supabaseAdmin
      .from("reels")
      .select(fallbackSelect)
      .eq("id", reelId)
      .eq("user_id", user.id)
      .maybeSingle());
  }

  if (error || !data) {
    const response = NextResponse.json({ error: error?.message || "Unable to load reel" }, { status: 500 });
    applyCookies(response);
    return response;
  }

  let scriptText: string | null = null;
  if (data.script_id) {
    const { data: scriptRow } = await supabaseAdmin
      .from("scripts")
      .select("text")
      .eq("id", data.script_id)
      .maybeSingle();
    scriptText = scriptRow?.text ?? null;
  }

  const storedCaption =
    (data as Record<string, any>).caption ??
    (data as Record<string, any>)?.custom_settings?.caption?.text ??
    null;
  const caption = deriveCaption(scriptText, storedCaption);
  const hashtags = ensureHashtags(
    normalizeHashtags((data as Record<string, any>).hashtags ?? (data as Record<string, any>)?.custom_settings?.hashtags),
  );
  const formattedTags = withHashes(hashtags);

  const platformCaptions = {
    instagram: formatCaption("instagram", caption, formattedTags),
    youtube: formatCaption("youtube", caption, formattedTags),
    facebook: formatCaption("facebook", caption, formattedTags),
  };

  const response = NextResponse.json({
    reelId: data.id,
    videoUrl: data.video_url ?? null,
    caption,
    hashtags: formattedTags,
    platformCaptions,
  });
  applyCookies(response);
  return response;
}
