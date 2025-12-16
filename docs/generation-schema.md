# MediaQuotesAI Generation Schemas (Phase 1)

Defines normalized input/output models for:
- Script/Caption generation
- AI Reel generation

These are the “source of truth” shapes to use in product/UI, agent logic, and backend APIs.

## Script / Caption (src/types/generation.ts)
`ScriptCaptionRequest`
- `contentType`: `caption` | `short_script` | `long_script`
- `platform`: `tiktok` | `instagram_reels` | `youtube_shorts` | `facebook_reels` | `linkedin`
- `description`: idea/topic/keywords (string)
- `tone`: `motivational` | `poetic` | `funny` | `savage` | `emotional` | `business` | `informative` | `default`
- `length`: `short` | `medium` | `long` (roughly 5–10s, 15–30s, 45–90s)
- `persona`?: optional style/voice
- `language`?: output language code
- `variations`?: desired count (clamped 1–5, default 3)

`ScriptCaptionResponse`
- `variations`: array of `{ hook, body, cta, tone, engagementScore? }`
- `normalized`: the normalized request (defaults applied)

## Reel Generation (src/types/generation.ts)
`ReelRequest`
- `script`: `{ type: "existing" | "uploaded" | "new"; scriptId?; text? }`
- `reelType`: `text_only` | `ai_character` | `stock_plus_captions` | `black_text` | `aesthetic`
- `visual`: `{ videoStyle, background, font, textAnimation }`
  - `videoStyle`: `minimal` | `aesthetic` | `dark` | `neon` | `cinematic`
  - `background`: `stock` | `ai_generated` | `gradient` | `blur` | `black`
  - `font`: `bold` | `minimal` | `soft` | `cursive`
  - `textAnimation`: `typewriter` | `fade` | `zoom` | `slide`
- `audio`?: `{ aiVoiceId?, musicUploadId?, trendingAudioId? }`
- `resolution`?: `{ width, height }` (default 1080×1920)

`ReelRenderJob`
- `status`: `queued` | `rendering` | `failed` | `completed`
- `videoUrl?`, `thumbnailUrl?`, `error?`, `scenes?`

## Rendering Templates & Brand Kits (Phase 5)
- Templates: `template` on reel payload can be one of `meme`, `cinematic`, `cartoon`, `talking_head`, `minimal`. Map to render-time visual presets (bg, font, animations).
- Brand kit: optional metadata attached to reel payload: `{ brandColors?: string[], brandFonts?: string[], logoUrl?: string | null, endScreenTemplate?: string | null }`.
- Rendering payload should pass template + brand kit to the renderer. If renderer is stubbed, keep placeholders but store template/brand in `reels` for future re-renders.

## Normalizers (src/lib/generation-normalize.ts)
- `normalizeScriptCaptionRequest(input)` → applies defaults, trims strings, clamps variations.
- `normalizeReelRequest(input)` → applies defaults for reel type, visual, audio, resolution, and script source.

Use these helpers before calling AI providers or persisting requests to keep inputs consistent.***
