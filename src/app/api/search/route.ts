import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";

type SearchResult = {
  id: string;
  type: "reel" | "quote" | "channel" | "video" | "script";
  title: string;
  subtitle?: string | null;
  href: string;
};

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesTerm(values: Array<string | null | undefined>, term: string) {
  return values.some((value) => normalizeText(value).includes(term));
}

function isMissingTable(error: { message?: string | null }, table: string) {
  const msg = error?.message?.toLowerCase() ?? "";
  return msg.includes("relation") && msg.includes(table);
}

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }
  const { user, applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const query = normalizeQuery(searchParams.get("q") ?? "");

  if (!query || query.length < 2) {
    const response = NextResponse.json({ results: [] });
    applyCookies(response);
    return response;
  }

  const term = normalizeText(query);
  const results: SearchResult[] = [];

  const channelsReq = supabaseAdmin
    .from("channels")
    .select("id, name, topic, platform")
    .eq("user_id", user.id)
    .or(`name.ilike.${term},topic.ilike.${term}`)
    .limit(5);

  const quotesReq = supabaseAdmin
    .from("quotes")
    .select("id, topic, tone, language, hook, persona, quotes, image_quotes")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const scriptsReq = supabaseAdmin
    .from("scripts")
    .select("id, input_prompt, text, platform, tone")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const reelsReq = supabaseAdmin
    .from("reels")
    .select("id, platform, tone, status, scripts(text)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const videosReq = supabaseAdmin
    .from("video_projects")
    .select("id, title, topic, video_type")
    .eq("user_id", user.id)
    .or(`title.ilike.${term},topic.ilike.${term}`)
    .limit(5);

  const [channelsRes, quotesRes, scriptsRes, reelsRes, videosRes] = await Promise.all([
    channelsReq,
    quotesReq,
    scriptsReq,
    reelsReq,
    videosReq,
  ]);

  if (!channelsRes.error && channelsRes.data) {
    channelsRes.data.forEach((row) => {
      results.push({
        id: row.id,
        type: "channel",
        title: row.name || "Channel",
        subtitle: row.platform || row.topic || null,
        href: `/channels?detail=${encodeURIComponent(row.id)}`,
      });
    });
  }

  if (!quotesRes.error && quotesRes.data) {
    quotesRes.data.forEach((row) => {
      const quoteTexts = Array.isArray(row.quotes) ? row.quotes : [];
      const imageTexts = Array.isArray(row.image_quotes)
        ? row.image_quotes.map((item: { text?: string }) => item?.text).filter(Boolean)
        : [];
      const matches = matchesTerm(
        [row.topic, row.hook, row.persona, row.tone, row.language, ...quoteTexts, ...imageTexts],
        term,
      );
      if (!matches) return;
      results.push({
        id: row.id,
        type: "quote",
        title: row.topic || "Quote pack",
        subtitle: row.tone || row.language || null,
        href: `/quotes?detail=${encodeURIComponent(row.id)}`,
      });
    });
  }

  if (!scriptsRes.error && scriptsRes.data) {
    scriptsRes.data.forEach((row) => {
      const matches = matchesTerm([row.input_prompt, row.text, row.platform, row.tone], term);
      if (!matches) return;
      const topic = row.input_prompt || row.text || "Script";
      results.push({
        id: row.id,
        type: "script",
        title: topic.length > 80 ? `${topic.slice(0, 77)}...` : topic,
        subtitle: row.platform || row.tone || null,
        href: `/scripts-captions?detail=${encodeURIComponent(row.id)}`,
      });
    });
  }

  if (!reelsRes.error && reelsRes.data) {
    reelsRes.data.forEach((row) => {
      const scriptText =
        (row as { scripts?: { text?: string | null } | Array<{ text?: string | null }> }).scripts;
      const scriptValue = Array.isArray(scriptText) ? scriptText?.[0]?.text : scriptText?.text;
      const matches = matchesTerm([row.platform, row.tone, row.status, scriptValue], term);
      if (!matches) return;
      const subtitleParts = [row.platform, row.tone, row.status].filter(Boolean);
      results.push({
        id: row.id,
        type: "reel",
        title: "AI Reel",
        subtitle: subtitleParts.length ? subtitleParts.join(" · ") : null,
        href: `/ai-reels/${encodeURIComponent(row.id)}`,
      });
    });
  }

  if (!videosRes.error && videosRes.data) {
    videosRes.data.forEach((row) => {
      results.push({
        id: row.id,
        type: "video",
        title: row.title || row.topic || "AI Video",
        subtitle: row.video_type || null,
        href: `/ai-videos/${encodeURIComponent(row.id)}`,
      });
    });
  }

  if (
    (channelsRes.error && !isMissingTable(channelsRes.error, "channels")) ||
    (quotesRes.error && !isMissingTable(quotesRes.error, "quotes")) ||
    (scriptsRes.error && !isMissingTable(scriptsRes.error, "scripts")) ||
    (reelsRes.error && !isMissingTable(reelsRes.error, "reels")) ||
    (videosRes.error && !isMissingTable(videosRes.error, "video_projects"))
  ) {
    const response = NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ results: results.slice(0, 15) });
  applyCookies(response);
  return response;
}
