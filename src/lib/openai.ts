import OpenAI from 'openai';

export type LlmProvider = 'openai' | 'gemini';

const openaiApiKey = process.env.OPENAI_API_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const configuredProvider =
  (process.env.AI_PROVIDER?.toLowerCase() as LlmProvider | undefined) ??
  (process.env.LLM_PROVIDER?.toLowerCase() as LlmProvider | undefined);
export const defaultProvider: LlmProvider = configuredProvider ?? (geminiApiKey ? 'gemini' : 'openai');
const fallbackFlag = (process.env.LLM_FALLBACK || process.env.AI_FALLBACK || 'on').toLowerCase();
const allowFallback = fallbackFlag !== 'off';

let openai: OpenAI | null = null;

function resolveProvider(provider?: string | null): LlmProvider {
  const normalized = provider?.toLowerCase();
  return normalized === 'gemini' ? 'gemini' : 'openai';
}

function getOpenAI(): OpenAI {
  if (!openaiApiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable in Next.js environment.');
  }

  if (!openai) {
    openai = new OpenAI({ apiKey: openaiApiKey });
  }

  return openai;
}

async function generateWithOpenAI(prompt: string, options?: { temperature?: number; maxTokens?: number }) {
  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 400,
  });

  const text = response.choices?.[0]?.message?.content ?? '';
  return text.trim();
}

// async function generateWithGemini(prompt: string, options?: { temperature?: number; maxTokens?: number }) {
//   if (!geminiApiKey) {
//     throw new Error('Missing GEMINI_API_KEY environment variable.');
//   }

//   const configuredModel = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
//   const modelsToTry: string[] = [configuredModel];
//   if (!configuredModel.endsWith('-latest')) {
//     modelsToTry.push(`${configuredModel}-latest`);
//   }
//   if (!modelsToTry.includes('gemini-1.5-flash-latest')) {
//     modelsToTry.push('gemini-1.5-flash-latest');
//   }

//   const body = {
//     contents: [{ role: 'user', parts: [{ text: prompt }] }],
//     generationConfig: {
//       temperature: options?.temperature ?? 0.7,
//       maxOutputTokens: options?.maxTokens ?? 400,
//     },
//   };

//   let lastErrorText = '';

//   for (const model of modelsToTry) {
//     const apiVersions = ['v1beta', 'v1'];
//     for (const version of apiVersions) {
//       const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${geminiApiKey}`;
//       const res = await fetch(url, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify(body),
//       });

//       if (!res.ok) {
//         const errorText = await res.text().catch(() => res.statusText);
//         lastErrorText = `Gemini (${model}, ${version}) failed (${res.status}): ${errorText}`;
//         if (res.status === 404) {
//           continue; // try next api version or next model
//         }
//         throw new Error(lastErrorText);
//       }

//       const data = (await res.json().catch(() => ({}))) as {
//         candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
//       };
//       const parts = data?.candidates?.[0]?.content?.parts ?? [];
//       const text = parts.map((p) => p.text?.trim()).filter(Boolean).join('\n');
//       if (text) {
//         return text.trim();
//       }
//       lastErrorText = `Gemini (${model}, ${version}) returned no text`;
//     }
//   }

//   throw new Error(lastErrorText || 'Gemini request failed for all models tried.');
// }

async function generateWithGemini(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
) {
  if (!geminiApiKey) {
    throw new Error('Missing GEMINI_API_KEY environment variable.');
  }

  // Default to a modern, supported model
  const configuredModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  // If you want a simple fallback, list only *valid* models here
  const modelsToTry: string[] = [
    configuredModel,
    // optional: fallback
    'gemini-2.5-flash-lite',
  ];

  const body = {
    contents: [
      {
        // role is optional; safe to keep or remove
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: options?.temperature ?? 0.7,
      maxOutputTokens: options?.maxTokens ?? 400,
    },
  };

  let lastErrorText = '';

  for (const model of modelsToTry) {
    const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${geminiApiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => res.statusText);
      lastErrorText = `Gemini (${model}) failed (${res.status}): ${errorText}`;

      // If it's a 404, try next model; otherwise, throw immediately
      if (res.status === 404) {
        continue;
      }
      throw new Error(lastErrorText);
    }

    const data = (await res.json().catch(() => ({}))) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .map((p) => p.text?.trim())
      .filter(Boolean)
      .join('\n');

    if (text) {
      return text.trim();
    }

    lastErrorText = `Gemini (${model}) returned no text`;
  }

  throw new Error(lastErrorText || 'Gemini request failed for all models tried.');
}


export async function generateCompletion(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number; provider?: LlmProvider }
): Promise<string> {
  const provider = resolveProvider(options?.provider ?? defaultProvider);
  const providerExplicit = Boolean(options?.provider);
  if (provider === 'gemini') {
    try {
      return await generateWithGemini(prompt, options);
    } catch (error) {
      // If Gemini fails and OpenAI is configured, silently fall back to OpenAI so the request still succeeds.
      if (!providerExplicit && allowFallback && openaiApiKey) {
        console.warn('Gemini failed, falling back to OpenAI:', (error as Error).message);
        return generateWithOpenAI(prompt, options);
      }
      throw error;
    }
  }
  return generateWithOpenAI(prompt, options);
}
