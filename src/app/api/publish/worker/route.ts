import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { publishToFacebook, resolveFacebookPageAccessToken } from "@/lib/publish/facebook";
import { isPlatformEnabled } from "@/lib/social/platforms";

type PublishJob = {
  id: string;
  user_id: string;
  platform: string;
  entity_type: string;
  entity_id: string;
  status: string;
  scheduled_at: string | null;
  attempts: number | null;
};

type SocialAccount = {
  id: string;
  user_id: string;
  platform: string;
  access_token: string;
  page_id: string | null;
  page_access_token: string | null;
  metadata: Record<string, unknown> | null;
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
  image_quotes: Array<{ text?: string | null }> | null;
};

const MAX_ATTEMPTS = 5;

function normalizeQuoteText(input: string) {
  return input
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\s*[-–•]\s*/, "")
    .replace(/^\s*\d+[.)]\s*/, "")
    .replace(/^['"`]+/, "")
    .replace(/['"`]+$/, "")
    .trim();
}

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

function buildMessage(quote: QuoteRecord) {
  const imageQuote = quote.image_quotes?.find((q) => typeof q?.text === "string" && q.text.trim());
  const listQuote = quote.quotes?.find((q) => typeof q === "string" && q.trim());
  const raw = imageQuote?.text || listQuote || quote.hook || quote.topic || "";
  let message = normalizeQuoteText(raw || "");
  if (!message) return "";
  if (quote.hook && message !== quote.hook) {
    message = `${message}\n\n${quote.hook}`;
  }
  if (/#\w+/.test(message)) return message;
  const tags = buildHashtags(quote);
  return tags.length ? `${message}\n\n${tags.join(" ")}` : message;
}

async function markJobFailure(job: PublishJob, reason: string) {
  const attempts = (job.attempts ?? 0) + 1;
  const nextStatus = attempts >= MAX_ATTEMPTS ? "failed" : "queued";
  const { error } = await supabaseAdmin
    .from("publish_jobs")
    .update({
      status: nextStatus,
      attempts,
      last_error: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  if (error) {
    throw new Error(error.message);
  }
  return nextStatus;
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 500 });
  }

  const headerSecret = request.headers.get("x-cron-secret");
  if (!headerSecret || headerSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const enabled = await isPlatformEnabled("facebook");
  if (!enabled) {
    return NextResponse.json({ success: true, processed: 0, disabled: true });
  }

  const nowIso = new Date().toISOString();
  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from("publish_jobs")
    .select("id, user_id, platform, entity_type, entity_id, status, scheduled_at, attempts")
    .eq("status", "queued")
    .eq("platform", "facebook")
    .eq("entity_type", "quote")
    .lt("attempts", MAX_ATTEMPTS)
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(10);

  if (jobsError) {
    return NextResponse.json({ error: "Unable to load publish jobs." }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  let processed = 0;

  for (const job of jobs as PublishJob[]) {
    const { data: locked } = await supabaseAdmin
      .from("publish_jobs")
      .update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();

    if (!locked) {
      continue;
    }

    try {
      const { data: account, error: accountError } = await supabaseAdmin
        .from("social_accounts")
        .select("id, user_id, platform, access_token, page_id, page_access_token, metadata")
        .eq("user_id", job.user_id)
        .eq("platform", "facebook")
        .maybeSingle();

      if (accountError || !account) {
        await markJobFailure(job, "Facebook account not connected.");
        continue;
      }

      const { data: quote, error: quoteError } = await supabaseAdmin
        .from("quotes")
        .select("id, topic, hook, persona, tone, style, language, quotes, image_quotes")
        .eq("id", job.entity_id)
        .eq("user_id", job.user_id)
        .maybeSingle();

      if (quoteError || !quote) {
        await markJobFailure(job, "Quote not found.");
        continue;
      }

      const message = buildMessage(quote as QuoteRecord);
      if (!message) {
        await markJobFailure(job, "Quote message is empty.");
        continue;
      }

      let pageId = (account as SocialAccount).page_id;
      let pageAccessToken = (account as SocialAccount).page_access_token;

      if (!pageId || !pageAccessToken) {
        const resolved = await resolveFacebookPageAccessToken({
          userAccessToken: (account as SocialAccount).access_token,
          pageId: pageId,
        });
        pageId = resolved.pageId;
        pageAccessToken = resolved.accessToken;
        await supabaseAdmin
          .from("social_accounts")
          .update({
            page_id: pageId,
            page_access_token: pageAccessToken,
            updated_at: new Date().toISOString(),
          })
          .eq("id", (account as SocialAccount).id);
      }

      await publishToFacebook({
        pageId: pageId as string,
        pageAccessToken: pageAccessToken as string,
        message,
      });

      const { error: publishError } = await supabaseAdmin
        .from("publish_jobs")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (publishError) {
        throw new Error(publishError.message);
      }

      processed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Publish failed.";
      await markJobFailure(job, message);
    }
  }

  return NextResponse.json({ success: true, processed });
}
