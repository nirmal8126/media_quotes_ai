import type { GenerateTextParams, TextProvider } from "./types";

const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function buildBody(params: GenerateTextParams) {
  const combinedPrompt = params.system ? `${params.system.trim()}\n\n${params.prompt}` : params.prompt;
  return {
    contents: [
      {
        role: "user",
        parts: [{ text: combinedPrompt }],
      },
    ],
    generationConfig: {
      temperature: params.temperature ?? 0.35,
      maxOutputTokens: params.maxTokens ?? 900,
      ...(params.stop ? { stopSequences: params.stop } : {}),
    },
  };
}

async function callGemini(apiKey: string, model: string, body: any) {
  const versions = ["v1", "v1beta"];
  let lastError: Error | null = null;

  for (const version of versions) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      lastError = new Error(`Gemini (${model}, ${version}) failed (${res.status}): ${errorText}`);
      if (res.status === 404) continue; // try the next version
      throw lastError;
    }

    const data = (await res.json().catch(() => ({}))) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const text = (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text?.trim())
      .filter(Boolean)
      .join("\n");

    if (text) return text.trim();
    lastError = new Error(`Gemini (${model}, ${version}) returned no text`);
  }

  throw lastError ?? new Error("Gemini request failed");
}

export function createGeminiProvider(): TextProvider | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  return {
    name: "gemini",
    async generateText(params: GenerateTextParams) {
      const model = params.model || DEFAULT_MODEL;
      const body = buildBody(params);
      // Try configured model, then a lite fallback
      const modelsToTry = [model];
      if (model !== "gemini-2.5-flash-lite") modelsToTry.push("gemini-2.5-flash-lite");

      let lastError: Error | null = null;
      for (const mdl of modelsToTry) {
        try {
          return await callGemini(apiKey, mdl, body);
        } catch (error) {
          lastError = error as Error;
          continue;
        }
      }

      throw lastError ?? new Error("Gemini generation failed");
    },
  };
}
