import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiApiKey) {
    throw new Error('Missing OPENAI_API_KEY environment variable in Next.js environment.');
  }

  if (!openai) {
    openai = new OpenAI({ apiKey: openaiApiKey });
  }

  return openai;
}

export async function generateCompletion(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const client = getOpenAI();
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 400,
  });

  const text = response.choices?.[0]?.message?.content ?? '';
  return text.trim();
}
