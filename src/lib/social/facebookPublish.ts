type FacebookPublishInput = {
  pageId: string;
  pageAccessToken: string;
  message: string;
  imageUrl?: string | null;
};

type FacebookPublishResult = {
  id?: string;
  post_id?: string;
};

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

async function publishTextPost(input: FacebookPublishInput): Promise<FacebookPublishResult> {
  const params = new URLSearchParams();
  params.set("message", input.message);
  params.set("access_token", input.pageAccessToken);

  const res = await fetch(`${GRAPH_BASE}/${input.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as FacebookPublishResult & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || "Failed to publish Facebook post");
  }
  return json;
}

async function publishImagePost(input: FacebookPublishInput): Promise<FacebookPublishResult> {
  if (!input.imageUrl) {
    return publishTextPost(input);
  }

  const params = new URLSearchParams();
  params.set("url", input.imageUrl);
  params.set("caption", input.message || "");
  params.set("access_token", input.pageAccessToken);

  const res = await fetch(`${GRAPH_BASE}/${input.pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as FacebookPublishResult & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || "Failed to publish Facebook image");
  }
  return json;
}

export async function publishToFacebook(input: FacebookPublishInput): Promise<FacebookPublishResult> {
  if (!input.message && !input.imageUrl) {
    throw new Error("Facebook publish requires a message or image URL.");
  }

  if (input.imageUrl) {
    return publishImagePost(input);
  }

  return publishTextPost(input);
}
