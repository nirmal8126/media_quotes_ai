import OpenAI from 'openai';

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  throw new Error('Missing OPENAI_API_KEY environment variable in Next.js environment.');
}

const openai = new OpenAI({ apiKey: openaiApiKey });

export async function generateCompletion(
  prompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 400,
  });

  const text = response.choices?.[0]?.message?.content ?? '';
  return text.trim();
}
