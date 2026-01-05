import OpenAI from "openai";
import type { GenerateTextParams, TextProvider } from "./types";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

export function createOpenAIProvider(): TextProvider | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const client = new OpenAI({ apiKey });

  return {
    name: "openai",
    async generateText(params: GenerateTextParams) {
      const model = params.model || DEFAULT_MODEL;
      const messages: Array<{ role: "system" | "user"; content: string }> = [];
      if (params.system) messages.push({ role: "system", content: params.system });
      messages.push({ role: "user", content: params.prompt });

      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: params.temperature ?? 0.35,
        max_tokens: params.maxTokens ?? 900,
        response_format: { type: "json_object" },
        stop: params.stop,
      });

      const text = response.choices?.[0]?.message?.content ?? "";
      return text.trim();
    },
  };
}
