import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { publishToFacebook } from "@/lib/social/facebookPublish";
import { decryptToken } from "@/lib/crypto/tokenVault";
import { isPlatformEnabled } from "@/lib/social/platforms";

const MAX_BATCH = 10;

type PublishJob = {
  id: string;
  user_id: string;
  platform: string;
  quote_id: string;
  reel_id?: string | null;
  status: string;
  scheduled_at: string | null;
};

type SocialAccount = {
  id: string;
  user_id: string;
  platform: string;
  page_id: string | null;
  page_name: string | null;
  page_access_token_encrypted: string | null;
  token_expires_at: string | null;
  updated_at: string | null;
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

type ReelRecord = {
  id: string;
  caption: string | null;
  hashtags: string[] | string | null;
  video_url: string | null;
  custom_settings?: { caption?: { text?: string | null } | null; hashtags?: string[] | string | null } | null;
  script_id?: string | null;
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

const emojiRules: Array<{ tokens: string[]; emojis: string[] }> = [
  { tokens: ["motivation", "motivational", "inspire", "inspiration"], emojis: ["🔥", "✨", "💪"] },
  { tokens: ["mindset", "focus", "discipline"], emojis: ["🧠", "🎯"] },
  { tokens: ["startup", "business", "entrepreneur", "founder"], emojis: ["🚀", "💡"] },
  { tokens: ["success", "achievement", "win", "victory"], emojis: ["🏆", "🎉"] },
  { tokens: ["calm", "peace", "relax"], emojis: ["🌿", "🕊️"] },
];

function buildAutoEmojis(quote: QuoteRecord) {
  const tokens = new Set([
    ...toHashtagTokens(quote.topic),
    ...toHashtagTokens(quote.tone),
    ...toHashtagTokens(quote.persona),
    ...toHashtagTokens(quote.style),
  ]);
  const picks: string[] = [];
  emojiRules.forEach((rule) => {
    if (rule.tokens.some((token) => tokens.has(token))) {
      picks.push(...rule.emojis);
    }
  });
  return Array.from(new Set(picks)).slice(0, 4);
}

function resolveMessage(quote: QuoteRecord) {
  const imageQuote = quote.image_quotes?.find((item) => typeof item?.text === "string" && item.text.trim());
  const listQuote = quote.quotes?.find((item) => typeof item === "string" && item.trim());
  const raw = imageQuote?.text || listQuote || quote.hook || quote.topic || "";
  const message = raw.trim();
  if (!message) return message;
  const emojis = buildAutoEmojis(quote);
  const tags = /#\w+/.test(message) ? [] : buildHashtags(quote);
  const parts = [message, emojis.length ? emojis.join(" ") : "", tags.length ? tags.join(" ") : ""].filter(Boolean);
  return parts.join("\n\n");
}

function resolveImageUrl(quote: QuoteRecord) {
  const imageQuote = quote.image_quotes?.find((item) => typeof item?.image_url === "string" && item.image_url.trim());
  return imageQuote?.image_url ?? null;
}

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

function withHashes(list: string[]) {
  return list.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
}

function resolveReelCaption(reel: ReelRecord, scriptText: string | null) {
  const storedCaption = reel.caption ?? reel.custom_settings?.caption?.text ?? "";
  const base = (storedCaption || scriptText || "").replace(/\s+/g, " ").trim();
  const caption = base || "New reel ready to share.";
  const tags = normalizeHashtags(reel.hashtags ?? reel.custom_settings?.hashtags);
  const formattedTags = withHashes(tags).slice(0, 8);
  return formattedTags.length ? `${caption}\n\n${formattedTags.join(" ")}` : caption;
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
    .select("id, user_id, platform, quote_id, reel_id, status, scheduled_at")
    .eq("status", "queued")
    .eq("platform", "facebook")
    .or(`scheduled_at.is.null,scheduled_at.lte.${nowIso}`)
    .order("created_at", { ascending: true })
    .limit(MAX_BATCH);

  if (jobsError) {
    return NextResponse.json({ error: "Unable to load publish jobs." }, { status: 500 });
  }

  if (!jobs || jobs.length === 0) {
    return NextResponse.json({ success: true, processed: 0 });
  }

  let processed = 0;

  for (const job of jobs as PublishJob[]) {
    const { data: claimed } = await supabaseAdmin
      .from("publish_jobs")
      .update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "queued")
      .select("id")
      .maybeSingle();

    if (!claimed) {
      continue;
    }

    try {
      const { data: account, error: accountError } = await supabaseAdmin
        .from("social_accounts")
        .select("id, user_id, platform, page_id, page_name, page_access_token_encrypted, token_expires_at, updated_at")
        .eq("user_id", job.user_id)
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

      if (job.reel_id) {
        const { data: reel, error: reelError } = await supabaseAdmin
          .from("reels")
          .select("id, caption, hashtags, video_url, custom_settings, script_id")
          .eq("id", job.reel_id)
          .eq("user_id", job.user_id)
          .maybeSingle();

        if (reelError || !reel) {
          throw new Error("Reel not found.");
        }

        let scriptText: string | null = null;
        if ((reel as ReelRecord).script_id) {
          const { data: scriptRow } = await supabaseAdmin
            .from("scripts")
            .select("text")
            .eq("id", (reel as ReelRecord).script_id as string)
            .maybeSingle();
          scriptText = scriptRow?.text ?? null;
        }

        const message = resolveReelCaption(reel as ReelRecord, scriptText);
        const videoUrl = (reel as ReelRecord).video_url;

        if (!videoUrl) {
          throw new Error("Reel video is missing.");
        }

        const result = await publishToFacebook({
          pageId: account.page_id,
          pageAccessToken,
          message,
          videoUrl,
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

        processed += 1;
        continue;
      }

      const { data: quote, error: quoteError } = await supabaseAdmin
        .from("quotes")
        .select("id, topic, hook, persona, tone, style, language, quotes, image_quotes")
        .eq("id", job.quote_id)
        .eq("user_id", job.user_id)
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

      processed += 1;
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
    }
  }

  return NextResponse.json({ success: true, processed });
}
