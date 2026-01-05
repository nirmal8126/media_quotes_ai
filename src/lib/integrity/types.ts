export type ContentKind = "reel" | "video" | "quote" | "script" | "caption" | "other";

export type PlatformKind = "youtube_shorts" | "instagram_reels" | "tiktok" | "generic";

export type MediaAssetRef = {
  source?: "user_upload" | "stock" | "ai_generated" | "unknown";
  url?: string;
  metadata?: Record<string, unknown>;
};

export type AudioRef = {
  source?: "trending" | "royalty_free" | "user_upload" | "stock" | "unknown";
  url?: string;
};

export type ContentUnit = {
  id?: string;
  type: ContentKind;
  platform?: PlatformKind;
  textContent?: string | null;
  mediaAssets?: MediaAssetRef[];
  audio?: AudioRef | null;
  metadata?: Record<string, unknown>;
  versions?: Array<{ name?: string; text?: string; payload?: unknown }>;
  previousTexts?: string[];
  generatedCount?: number;
};

export type IntegrityIssue = {
  code: string;
  severity: "safe" | "warn" | "risk";
  message: string;
};

export type IntegrityFix = {
  action: "REGENERATE" | "REWRITE" | "REPLACE_AUDIO" | "REPLACE_MEDIA" | string;
  label: string;
  payload?: Record<string, unknown>;
};

export type IntegrityReport = {
  status: "safe" | "warn" | "risk";
  score: number;
  issues: IntegrityIssue[];
  fixes: IntegrityFix[];
};

