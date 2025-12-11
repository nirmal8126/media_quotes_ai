export type ContentType = "caption" | "short_script" | "long_script";

export type Platform =
  | "tiktok"
  | "instagram_reels"
  | "youtube_shorts"
  | "facebook_reels"
  | "linkedin";

export type ToneStyle =
  | "motivational"
  | "poetic"
  | "funny"
  | "savage"
  | "emotional"
  | "business"
  | "informative"
  | "default";

export type LengthPreset = "short" | "medium" | "long";

export type LanguageCode = string;

export type PersonaStyle = string;

export type ScriptCaptionRequest = {
  contentType: ContentType;
  platform: Platform;
  description: string;
  tone: ToneStyle;
  length: LengthPreset;
  persona?: PersonaStyle | null;
  language?: LanguageCode | null;
  variations?: number; // how many to return (3–5 typical)
};

export type ScriptCaptionVariation = {
  hook: string;
  body: string;
  cta: string;
  tone: ToneStyle;
  engagementScore?: number; // model-provided or heuristic
};

export type ScriptCaptionResponse = {
  variations: ScriptCaptionVariation[];
  normalized: ScriptCaptionRequest;
};

// Reel generation types
export type ReelType = "text_only" | "ai_character" | "stock_plus_captions" | "black_text" | "aesthetic";

export type VideoStyle = "minimal" | "aesthetic" | "dark" | "neon" | "cinematic";
export type BackgroundType = "stock" | "ai_generated" | "gradient" | "blur" | "black";
export type FontStyle = "bold" | "minimal" | "soft" | "cursive";
export type TextAnimation = "typewriter" | "fade" | "zoom" | "slide";

export type AudioSource = {
  aiVoiceId?: string | null;
  musicUploadId?: string | null;
  trendingAudioId?: string | null;
};

export type Resolution = {
  width: number;
  height: number;
};

export type ScriptSource =
  | { type: "existing"; scriptId: string }
  | { type: "uploaded"; text: string }
  | { type: "new"; text: string };

export type ReelRequest = {
  script: ScriptSource;
  reelType: ReelType;
  visual: {
    videoStyle: VideoStyle;
    background: BackgroundType;
    font: FontStyle;
    textAnimation: TextAnimation;
  };
  audio?: AudioSource;
  resolution?: Resolution;
};

export type ReelScene = {
  id: string;
  label: "hook" | "body" | "outro";
  text: string;
  durationMs?: number;
};

export type ReelRenderJob = {
  id: string;
  status: "queued" | "rendering" | "failed" | "completed";
  error?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  scenes?: ReelScene[];
};
