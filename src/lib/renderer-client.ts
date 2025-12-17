type RenderPayload = {
  projectId: string;
  scenes: Array<{
    index: number;
    script: string;
    durationMs: number;
    prompt?: string | null;
    media?: Array<{ url: string; type: "video" | "image" | "audio"; source?: string | null }>;
  }>;
  language?: string | null;
  voiceId?: string | null;
  captions?: Array<{ startMs: number; endMs: number; text: string }>;
  audioUrl?: string;
};

type RenderResult = {
  jobId: string;
  status: string;
  previewUrl?: string;
  outputUrl?: string;
  thumbnailUrl?: string;
};

function getRendererConfig() {
  const url = process.env.RENDERER_API_URL || "http://localhost:4001";
  const apiKey = process.env.RENDERER_API_KEY || "dev-renderer-key";
  return { url, apiKey };
}

export async function triggerRenderer(payload: RenderPayload): Promise<RenderResult> {
  const { url, apiKey } = getRendererConfig();
  const target = `${url.replace(/\/$/, "")}/render`;
  const res = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => res.statusText);
    throw new Error(`Renderer request failed (${res.status}): ${errorText}`);
  }

  const data = (await res.json().catch(() => ({}))) as RenderResult;
  if (!data.jobId) {
    throw new Error("Renderer response missing jobId");
  }
  return data;
}
