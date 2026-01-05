import { createGeminiProvider } from "./gemini";
import { createOpenAIProvider } from "./openai";
import type { ProviderName, TextProvider } from "./types";

type ProviderOptions = {
  primary?: ProviderName;
};

export function getTextProviders(options?: ProviderOptions): {
  primary: TextProvider | null;
  fallback: TextProvider | null;
} {
  const gemini = createGeminiProvider();
  const openai = createOpenAIProvider();

  const preferOpenAI = options?.primary === "openai";
  const preferGemini = options?.primary === "gemini";

  // Default: Gemini primary, OpenAI fallback
  let primary: TextProvider | null = gemini ?? openai ?? null;
  let fallback: TextProvider | null = primary === gemini ? openai : gemini;

  if (preferOpenAI && openai) {
    primary = openai;
    fallback = gemini;
  } else if (preferGemini && gemini) {
    primary = gemini;
    fallback = openai;
  }

  return { primary, fallback };
}

export type { TextProvider, ProviderName } from "./types";
