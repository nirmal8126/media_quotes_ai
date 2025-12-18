export type SafetyLevel = "safe" | "warn" | "risk";

export type SafetyReason = {
  code: string;
  level: SafetyLevel;
  message: string;
};

export type SafetyFix = {
  action: "REPLACE_AUDIO" | "REPLACE_MEDIA" | "REGENERATE_SCRIPT" | string;
  label: string;
};

export type SafetyReport = {
  status: SafetyLevel;
  score: number;
  reasons: SafetyReason[];
  suggested_fixes: SafetyFix[];
};

