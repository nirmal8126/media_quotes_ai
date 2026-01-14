type FacebookPublishInput = {
  pageId: string;
  pageAccessToken: string;
  message: string;
  imageDataUrl?: string | null;
  imageUrl?: string | null;
};

type FacebookPageAccess = {
  pageId: string;
  accessToken: string;
  name?: string;
};

const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function parseImageDataUrl(dataUrl: string) {
  const [meta, base64] = dataUrl.split(",");
  const mimeMatch = /data:(.*?);base64/.exec(meta || "");
  const mimeType = mimeMatch?.[1] || "image/png";
  const buffer = Buffer.from(base64 || "", "base64");
  const extension = mimeType.split("/")[1] || "png";
  return { buffer, mimeType, extension };
}

async function publishTextPost(input: FacebookPublishInput) {
  const params = new URLSearchParams();
  params.set("message", input.message);
  params.set("access_token", input.pageAccessToken);

  const res = await fetch(`${GRAPH_BASE}/${input.pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error?.message || "Failed to publish Facebook post");
  }
  return json;
}

async function publishImagePost(input: FacebookPublishInput) {
  if (input.imageDataUrl && input.imageDataUrl.startsWith("data:image/")) {
    const parsed = parseImageDataUrl(input.imageDataUrl);
    const blob = new Blob([parsed.buffer], { type: parsed.mimeType });
    const form = new FormData();
    form.append("source", blob, `quote.${parsed.extension}`);
    form.append("caption", input.message || "");

    const res = await fetch(`${GRAPH_BASE}/${input.pageId}/photos?access_token=${input.pageAccessToken}`, {
      method: "POST",
      body: form,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || "Failed to publish Facebook image");
    }
    return json;
  }

  if (input.imageUrl) {
    const params = new URLSearchParams();
    params.set("url", input.imageUrl);
    params.set("caption", input.message || "");
    params.set("access_token", input.pageAccessToken);

    const res = await fetch(`${GRAPH_BASE}/${input.pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || "Failed to publish Facebook image");
    }
    return json;
  }

  return publishTextPost(input);
}

export async function resolveFacebookPageAccessToken(options: {
  userAccessToken: string;
  pageId?: string | null;
}): Promise<FacebookPageAccess> {
  if (options.pageId) {
    const url = new URL(`${GRAPH_BASE}/${options.pageId}`);
    url.searchParams.set("fields", "access_token,name,id");
    url.searchParams.set("access_token", options.userAccessToken);
    const res = await fetch(url.toString(), { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(json.error?.message || "Failed to load Facebook page access token");
    }
    return { pageId: json.id as string, accessToken: json.access_token as string, name: json.name as string };
  }

  const listUrl = new URL(`${GRAPH_BASE}/me/accounts`);
  listUrl.searchParams.set("access_token", options.userAccessToken);
  const res = await fetch(listUrl.toString(), { method: "GET" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(json.data) || json.data.length === 0) {
    throw new Error(json.error?.message || "No managed Facebook Pages found");
  }
  const page = json.data[0];
  return {
    pageId: page.id as string,
    accessToken: page.access_token as string,
    name: page.name as string,
  };
}

export async function publishToFacebook(input: FacebookPublishInput) {
  if (!input.message && !input.imageDataUrl && !input.imageUrl) {
    throw new Error("Facebook publish requires a message or image.");
  }

  if (input.imageDataUrl || input.imageUrl) {
    return publishImagePost(input);
  }

  return publishTextPost(input);
}
