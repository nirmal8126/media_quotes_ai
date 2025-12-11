import type {
  AudioSource,
  BackgroundType,
  ContentType,
  FontStyle,
  LengthPreset,
  Platform,
  ReelRequest,
  ReelType,
  ScriptCaptionRequest,
  TextAnimation,
  ToneStyle,
  VideoStyle,
} from "@/types/generation";

const defaultTone: ToneStyle = "informative";
const defaultLength: LengthPreset = "medium";
const defaultContentType: ContentType = "short_script";
const defaultPlatform: Platform = "instagram_reels";
const defaultReelType: ReelType = "text_only";
const defaultVideoStyle: VideoStyle = "minimal";
const defaultBackground: BackgroundType = "stock";
const defaultFont: FontStyle = "bold";
const defaultAnimation: TextAnimation = "fade";

function clampVariations(value?: number) {
  if (!Number.isFinite(value)) return 3;
  return Math.max(1, Math.min(Math.round(Number(value)), 5));
}

function cleanString(value?: string | null) {
  return value?.trim() || "";
}

export function normalizeScriptCaptionRequest(input: Partial<ScriptCaptionRequest>): ScriptCaptionRequest {
  const contentType = (cleanString(input.contentType) as ContentType) || defaultContentType;
  const platform = (cleanString(input.platform) as Platform) || defaultPlatform;
  const description = cleanString(input.description) || "Untitled idea";
  const tone = (cleanString(input.tone) as ToneStyle) || defaultTone;
  const length = (cleanString(input.length) as LengthPreset) || defaultLength;
  const persona = cleanString(input.persona) || null;
  const language = cleanString(input.language) || null;
  const variations = clampVariations(input.variations);

  return {
    contentType,
    platform,
    description,
    tone,
    length,
    persona,
    language,
    variations,
  };
}

function normalizeAudio(input?: AudioSource): AudioSource | undefined {
  if (!input) return undefined;
  return {
    aiVoiceId: cleanString(input.aiVoiceId) || null,
    musicUploadId: cleanString(input.musicUploadId) || null,
    trendingAudioId: cleanString(input.trendingAudioId) || null,
  };
}

export function normalizeReelRequest(input: Partial<ReelRequest>): ReelRequest {
  // Script source defaults to new empty text to avoid undefined access downstream
  const scriptSource = input.script ?? { type: "new", text: "" };

  const reelType = (cleanString(input.reelType) as ReelType) || defaultReelType;
  const visual = {
    videoStyle: (cleanString(input.visual?.videoStyle) as VideoStyle) || defaultVideoStyle,
    background: (cleanString(input.visual?.background) as BackgroundType) || defaultBackground,
    font: (cleanString(input.visual?.font) as FontStyle) || defaultFont,
    textAnimation: (cleanString(input.visual?.textAnimation) as TextAnimation) || defaultAnimation,
  };
  const audio = normalizeAudio(input.audio);
  const resolution = input.resolution ?? { width: 1080, height: 1920 };

  return {
    script: scriptSource,
    reelType,
    visual,
    audio,
    resolution,
  };
}
