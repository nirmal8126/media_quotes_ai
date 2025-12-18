export type ContentKind = "quote" | "script" | "caption" | "reel" | "video" | "other";

export type MediaSource = "user_upload" | "stock" | "ai_generated" | "unknown";

export type ContentUnit = {
  id?: string;
  type: ContentKind;
  text?: string | null;
  originalText?: string | null;
  previousTexts?: string[];
  generatedCount?: number;
  mediaSources?: MediaSource[];
  hasTrendingAudio?: boolean;
  metadata?: Record<string, unknown>;
};

export type IntegrityIssue = {
  code: string;
  severity: "safe" | "warn" | "risk";
  message: string;
};

export type IntegrityFix = {
  action: "REGENERATE" | "REWRITE" | "REPLACE_AUDIO" | "REPLACE_MEDIA" | string;
  label: string;
};

export type IntegrityReport = {
  status: "safe" | "warn" | "risk";
  score: number;
  issues: IntegrityIssue[];
  fixes: IntegrityFix[];
};

