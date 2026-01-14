import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { supabaseAdmin } from "@/lib/supabase";
import { publishToFacebook } from "@/lib/social/facebookPublish";
import { decryptToken } from "@/lib/crypto/tokenVault";
import { isPlatformEnabled } from "@/lib/social/platforms";

type RunNowBody = {
  quote_id?: string;
};

type QuoteRecord = {
  id: string;
  topic: string | null;
  hook: string | null;
  persona: string | null;
  tone: string | null;
  style: string | null;
  language: string | null;
  quotes: string[] | null;
  image_quotes: Array<{ text?: string | null; image_url?: string | null }> | null;
};

function toHashtagTokens(value?: string | null) {
  if (!value) return [];
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function buildHashtags(quote: QuoteRecord) {
  const tokens = [
    ...toHashtagTokens(quote.topic),
    ...toHashtagTokens(quote.persona),
    ...toHashtagTokens(quote.tone),
    ...toHashtagTokens(quote.style),
    ...toHashtagTokens(quote.language),
  ];
  const unique = Array.from(new Set(tokens)).filter(Boolean).slice(0, 8);
  if (unique.length === 0) return [];
  return unique.map((word) => `#${word.replace(/[^a-z0-9]/gi, "") || "quote"}`);
}

function resolveMessage(quote: QuoteRecord) {
  const imageQuote = quote.image_quotes?.find((item) => typeof item?.text === "string" && item.text.trim());
  const listQuote = quote.quotes?.find((item) => typeof item === "string" && item.trim());
  const raw = imageQuote?.text || listQuote || quote.hook || quote.topic || "";
  const message = raw.trim();
  if (!message) return message;
  if (/#\w+/.test(message)) return message;
  const tags = buildHashtags(quote);
  return tags.length ? `${message}\n\n${tags.join(" ")}` : message;
}

function resolveImageUrl(quote: QuoteRecord) {
  const imageQuote = quote.image_quotes?.find((item) => typeof item?.image_url === "string" && item.image_url.trim());
  return imageQuote?.image_url ?? null;
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) {
    return session.errorResponse;
  }

  const enabled = await isPlatformEnabled("facebook");
  if (!enabled) {
    const response = NextResponse.json({ error: "Facebook is currently disabled." }, { status: 403 });
    session.applyCookies(response);
    return response;
  }

  const body = (await request.json().catch(() => ({}))) as RunNowBody;
  const quoteId = typeof body.quote_id === "string" ? body.quote_id.trim() : "";

  const jobsQuery = supabaseAdmin
    .from("publish_jobs")
    .select("id, user_id, platform, quote_id, status, scheduled_at")
    .eq("user_id", session.user.id)
    .eq("platform", "facebook")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  const { data: jobs, error: jobsError } = quoteId ? await jobsQuery.eq("quote_id", quoteId) : await jobsQuery;

  if (jobsError) {
    const response = NextResponse.json({ error: "Unable to load publish jobs." }, { status: 500 });
    session.applyCookies(response);
    return response;
  }

  if (!jobs || jobs.length === 0) {
    const response = NextResponse.json({ error: "No queued publish job found." }, { status: 404 });
    session.applyCookies(response);
    return response;
  }

  const job = jobs[0];
  const { data: claimed } = await supabaseAdmin
    .from("publish_jobs")
    .update({ status: "publishing", updated_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "queued")
    .select("id")
    .maybeSingle();

  if (!claimed) {
    const response = NextResponse.json({ error: "Publish job is already being processed." }, { status: 409 });
    session.applyCookies(response);
    return response;
  }

  try {
    const { data: account, error: accountError } = await supabaseAdmin
      .from("social_accounts")
      .select("id, user_id, platform, page_id, page_name, page_access_token_encrypted, token_expires_at, updated_at")
      .eq("user_id", session.user.id)
      .eq("platform", "facebook")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (accountError || !account) {
      throw new Error("Facebook account not connected.");
    }

    if (!account.page_id || !account.page_access_token_encrypted) {
      throw new Error("Facebook page token missing.");
    }

    const pageAccessToken = decryptToken(account.page_access_token_encrypted);

    const { data: quote, error: quoteError } = await supabaseAdmin
      .from("quotes")
      .select("id, topic, hook, persona, tone, style, language, quotes, image_quotes")
      .eq("id", job.quote_id)
      .eq("user_id", session.user.id)
      .maybeSingle();

    if (quoteError || !quote) {
      throw new Error("Quote not found.");
    }

    const message = resolveMessage(quote as QuoteRecord);
    const imageUrl = resolveImageUrl(quote as QuoteRecord);

    if (!message && !imageUrl) {
      throw new Error("Quote message is empty.");
    }

    const result = await publishToFacebook({
      pageId: account.page_id,
      pageAccessToken,
      message,
      imageUrl,
    });

    const resultId = result.post_id || result.id || null;

    const { error: updateError } = await supabaseAdmin
      .from("publish_jobs")
      .update({
        status: "published",
        result_post_id: resultId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    const response = NextResponse.json({ success: true, result_post_id: resultId });
    session.applyCookies(response);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed.";
    await supabaseAdmin
      .from("publish_jobs")
      .update({
        status: "failed",
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    const response = NextResponse.json({ error: message }, { status: 500 });
    session.applyCookies(response);
    return response;
  }
}
