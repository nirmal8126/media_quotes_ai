import { supabaseAdmin } from "@/lib/supabase";
import type { SafetyFix, SafetyReason, SafetyReport, SafetyLevel } from "@/types/safety";

type ReelRow = {
  id: string;
  user_id: string;
  trending_audio_id?: string | null;
  audio_voice_id?: string | null;
};

type AssetRow = {
  id: string;
  reel_id: string;
  source?: string | null;
  license?: string | null;
  metadata?: Record<string, any> | null;
};

type AudioTrackRow = {
  id: string;
  reel_id: string;
  source?: string | null;
  license_type?: string | null;
};

const RISK_CODES = {
  UNKNOWN_ASSET_SOURCE: "UNKNOWN_ASSET_SOURCE",
  WATERMARK: "WATERMARK_DETECTED",
  TRENDING_AUDIO: "TRENDING_AUDIO",
  SCRIPT_SIMILARITY: "SCRIPT_SIMILARITY",
};

function pickWorstLevel(levels: SafetyLevel[]): SafetyLevel {
  if (levels.includes("risk")) return "risk";
  if (levels.includes("warn")) return "warn";
  return "safe";
}

function scoreForLevel(level: SafetyLevel) {
  switch (level) {
    case "risk":
      return -40;
    case "warn":
      return -20;
    default:
      return 0;
  }
}

function buildFixes(reasons: SafetyReason[]): SafetyFix[] {
  const actions: Record<string, SafetyFix> = {};
  reasons.forEach((reason) => {
    if (reason.code === RISK_CODES.TRENDING_AUDIO) {
      actions.REPLACE_AUDIO = { action: "REPLACE_AUDIO", label: "Switch to royalty-free audio" };
    }
    if (reason.code === RISK_CODES.UNKNOWN_ASSET_SOURCE || reason.code === RISK_CODES.WATERMARK) {
      actions.REPLACE_MEDIA = { action: "REPLACE_MEDIA", label: "Replace untrusted media" };
    }
    if (reason.code === RISK_CODES.SCRIPT_SIMILARITY) {
      actions.REGENERATE_SCRIPT = { action: "REGENERATE_SCRIPT", label: "Regenerate with more variation" };
    }
  });
  return Object.values(actions);
}

function detectWatermarkFlag(assets: AssetRow[]): boolean {
  return assets.some((asset) => {
    const meta = asset.metadata || {};
    return meta.watermark === true || meta.watermarkDetected === true || meta.hasWatermark === true;
  });
}

function detectUnknownAssets(assets: AssetRow[]): boolean {
  return assets.some((asset) => {
    const source = (asset.source || "").toLowerCase();
    if (!source) return true;
    return !["user_upload", "stock", "ai_generated"].includes(source);
  });
}

export async function computeSafetyReport(reelId: string, userId: string): Promise<SafetyReport> {
  const reasons: SafetyReason[] = [];

  const { data: reel } = await supabaseAdmin
    .from("reels")
    .select("id, user_id, trending_audio_id, audio_voice_id")
    .eq("id", reelId)
    .eq("user_id", userId)
    .maybeSingle<ReelRow>();

  // Assets and audio are best-effort; missing tables should not crash
  const { data: assets } = await supabaseAdmin
    .from("assets")
    .select("id, reel_id, source, license, metadata")
    .eq("reel_id", reelId)
    .catch(() => ({ data: [] as AssetRow[] }));

  const { data: tracks } = await supabaseAdmin
    .from("audio_tracks")
    .select("id, reel_id, source, license_type")
    .eq("reel_id", reelId)
    .catch(() => ({ data: [] as AudioTrackRow[] }));

  // Rule: trending audio => WARN
  const hasTrendingAudio =
    !!reel?.trending_audio_id ||
    (tracks || []).some((track) => (track.source || "").toLowerCase().includes("trending"));
  if (hasTrendingAudio) {
    reasons.push({
      code: RISK_CODES.TRENDING_AUDIO,
      level: "warn",
      message: "Trending audio may limit monetization.",
    });
  }

  // Rule: unknown asset source => RISK
  if (detectUnknownAssets(assets || [])) {
    reasons.push({
      code: RISK_CODES.UNKNOWN_ASSET_SOURCE,
      level: "risk",
      message: "Some media has unknown or untrusted source.",
    });
  }

  // Rule: watermark detected => RISK
  if (detectWatermarkFlag(assets || [])) {
    reasons.push({
      code: RISK_CODES.WATERMARK,
      level: "risk",
      message: "Watermark detected on an asset.",
    });
  }

  // Rule: script similarity placeholder => WARN (placeholder to be replaced later)
  reasons.push({
    code: RISK_CODES.SCRIPT_SIMILARITY,
    level: "warn",
    message: "Script similarity check pending; regenerate if reused content.",
  });

  const worst = pickWorstLevel(reasons.map((r) => r.level));
  const baseScore = 90;
  const delta = reasons.reduce((acc, r) => acc + scoreForLevel(r.level), 0);
  const score = Math.max(0, Math.min(100, baseScore + delta));

  return {
    status: worst,
    score,
    reasons,
    suggested_fixes: buildFixes(reasons),
  };
}

