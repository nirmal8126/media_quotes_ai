export type VideoProviderKey = "runway" | "pika" | "luma" | "heygen" | "local_stub";

type ProviderEnvConfig = {
  apiKey?: string;
  apiBaseUrl?: string;
  apiVersion?: string;
  model?: string;
};

const PROVIDER_DEFAULTS: Record<Exclude<VideoProviderKey, "local_stub">, { baseUrl: string }> = {
  runway: { baseUrl: "https://api.runwayml.com" },
  pika: { baseUrl: "https://api.pika.art" },
  luma: { baseUrl: "https://api.luma.ai" },
  heygen: { baseUrl: "https://api.heygen.com" },
};

export function resolveProviderKey(value?: string | null): VideoProviderKey {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "runway") return "runway";
  if (normalized === "pika") return "pika";
  if (normalized === "luma") return "luma";
  if (normalized === "heygen") return "heygen";
  return "local_stub";
}

function readEnv(prefix: string): ProviderEnvConfig {
  return {
    apiKey: process.env[`${prefix}_API_KEY`],
    apiBaseUrl: process.env[`${prefix}_API_BASE_URL`],
    apiVersion: process.env[`${prefix}_API_VERSION`],
    model: process.env[`${prefix}_MODEL`],
  };
}

export function getProviderEnv(provider: VideoProviderKey): ProviderEnvConfig {
  if (provider === "local_stub") return {};
  const prefix = provider.toUpperCase();
  const config = readEnv(prefix);
  if (provider === "runway") {
    return {
      apiKey: config.apiKey || process.env.AI_VIDEO_API_KEY,
      apiBaseUrl: config.apiBaseUrl || process.env.AI_VIDEO_API_URL || PROVIDER_DEFAULTS.runway.baseUrl,
      apiVersion: config.apiVersion || process.env.AI_VIDEO_API_VERSION,
      model: config.model || process.env.RUNWAY_MODEL,
    };
  }
  return {
    ...config,
    apiBaseUrl: config.apiBaseUrl || PROVIDER_DEFAULTS[provider].baseUrl,
  };
}
