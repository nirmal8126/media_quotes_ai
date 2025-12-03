import type { User } from '@supabase/supabase-js';
import type { LlmProvider } from './openai';

function normalize(value?: unknown): LlmProvider | undefined {
  if (!value) return undefined;
  const normalized = String(value).toLowerCase();
  if (normalized === 'gemini') return 'gemini';
  if (normalized === 'openai') return 'openai';
  return undefined;
}

export function pickProvider(options: {
  bodyProvider?: unknown;
  user?: User;
  fallback?: LlmProvider;
}): LlmProvider | undefined {
  return (
    normalize(options.bodyProvider) ??
    normalize(options.user?.user_metadata?.ai_provider ?? options.user?.user_metadata?.llm_provider) ??
    normalize(options.user?.app_metadata?.ai_provider ?? options.user?.app_metadata?.llm_provider) ??
    options.fallback
  );
}
