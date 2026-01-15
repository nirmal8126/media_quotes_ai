type FacebookPublishInput = {
  pageId: string;
  pageAccessToken: string;
  message: string;
  imageUrl?: string | null;
  imageDataUrl?: string | null;
  videoUrl?: string | null;
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
  if (input.imageDataUrl) {
    const form = new FormData();
    const blob = await fetch(input.imageDataUrl).then((res) => res.blob());
    form.set("source", blob, "quote.png");
    form.set("caption", input.message || "");
    form.set("access_token", input.pageAccessToken);

    const res = await fetch(`${GRAPH_BASE}/${input.pageId}/photos`, {
      method: "POST",
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as FacebookPublishResult & { error?: { message?: string } };
    if (!res.ok) {
      throw new Error(json.error?.message || "Failed to publish Facebook image");
    }
    return json;
  }

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

async function publishVideoPost(input: FacebookPublishInput): Promise<FacebookPublishResult> {
  if (!input.videoUrl) {
    return publishTextPost(input);
  }

  const params = new URLSearchParams();
  params.set("file_url", input.videoUrl);
  if (input.message) {
    params.set("description", input.message);
  }
  params.set("access_token", input.pageAccessToken);

  const res = await fetch(`${GRAPH_BASE}/${input.pageId}/videos`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = (await res.json().catch(() => ({}))) as FacebookPublishResult & { error?: { message?: string } };
  if (res.ok) {
    return json;
  }

  const fetchRes = await fetch(input.videoUrl);
  if (!fetchRes.ok) {
    throw new Error(json.error?.message || "Failed to fetch video for Facebook upload");
  }

  const blob = await fetchRes.blob();
  const form = new FormData();
  form.append("source", blob, "reel.mp4");
  if (input.message) {
    form.append("description", input.message);
  }
  form.append("access_token", input.pageAccessToken);

  const fallbackRes = await fetch(`${GRAPH_BASE}/${input.pageId}/videos`, {
    method: "POST",
    body: form,
  });
  const fallbackJson = (await fallbackRes.json().catch(() => ({}))) as FacebookPublishResult & {
    error?: { message?: string };
  };
  if (!fallbackRes.ok) {
    throw new Error(fallbackJson.error?.message || json.error?.message || "Failed to publish Facebook video");
  }
  return fallbackJson;
}

export async function publishToFacebook(input: FacebookPublishInput): Promise<FacebookPublishResult> {
  if (!input.message && !input.imageUrl && !input.imageDataUrl && !input.videoUrl) {
    throw new Error("Facebook publish requires a message, image, or video.");
  }

  if (input.videoUrl) {
    return publishVideoPost(input);
  }

  if (input.imageDataUrl || input.imageUrl) {
    return publishImagePost(input);
  }

  return publishTextPost(input);
}
