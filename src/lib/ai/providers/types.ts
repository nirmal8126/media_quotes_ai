export type ProviderName = "gemini" | "openai" | string;

export type GenerateTextParams = {
  prompt: string;
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  stop?: string[];
};

export type TextProvider = {
  name: ProviderName;
  generateText: (params: GenerateTextParams) => Promise<string>;
};
