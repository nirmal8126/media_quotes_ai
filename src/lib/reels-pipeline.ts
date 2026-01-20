import fs from "node:fs";
import path from "node:path";
import { synthesizeWithElevenLabs } from "@/lib/tts";
import { getVideoStatus, renderVideo } from "@/lib/video-providers/index";
import type { VideoRenderJob } from "@/lib/video-providers/types";
import { resolvePreset } from "@/lib/reels/presets";
import { splitIntoScenes } from "@/lib/reels/sceneSplitter";

type TriggerInput = {
  scriptText: string;
  style?: string | null;
  template?: string | null;
  durationSec: number;
  language?: string | null;
  withVoiceover?: boolean;
  musicEnabled?: boolean;
};

function minWordsForDuration(durationSec: number) {
  if (durationSec <= 15) return 20;
  if (durationSec <= 30) return 40;
  if (durationSec <= 45) return 60;
  return Math.round(durationSec * 1.8);
}

function countWords(text: string) {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
}

export async function triggerRenderer(input: TriggerInput): Promise<VideoRenderJob> {
  try {
    const scriptText = input.scriptText || "";
    const qcText = scriptText
      .split(/\r?\n/)
      .filter((line) => !line.trim().toLowerCase().startsWith("cta:"))
      .join("\n")
      .trim();
    const durationSec = input.durationSec || 15;
    const minWords = minWordsForDuration(durationSec);
    const wordCount = countWords(qcText);

    if (!qcText || wordCount < minWords) {
      throw new Error(
        `QC_FAIL: Script too short or incomplete (words=${wordCount}, min=${minWords})`,
      );
    }

    const lastChar = qcText.slice(-1);
    if (!["।", ".", "!", "?", "॥"].includes(lastChar)) {
      console.warn(`[reels] QC warning: Script truncated (bad ending: "${lastChar}")`);
    }
    const preset = resolvePreset({ template: input.template, style: input.style });
    const scenes = splitIntoScenes({ scriptText: qcText, durationSec, language: input.language });
    let withVoiceover = input.withVoiceover !== false;
    let audioUrl: string | null = null;
    let ttsAudioPath: string | null = null;
    let ttsWarning: string | null = null;
    if (withVoiceover && process.env.TTS_PROVIDER_API_KEY) {
      const voiceId = process.env.TTS_VOICE_DEFAULT || "";
      try {
        audioUrl = await synthesizeWithElevenLabs({
          text: input.scriptText,
          voiceId,
          apiKey: process.env.TTS_PROVIDER_API_KEY,
        });
        ttsAudioPath = audioUrl;
        if (!audioUrl) {
          ttsWarning = "Voiceover generation failed: no audio returned";
          withVoiceover = false;
        }
        console.log("[reels] voiceover voiceId", voiceId || "missing");
        console.log("[reels] voiceover audioUrl", audioUrl);
        const providerName = (process.env.VIDEO_PROVIDER || "local_stub").trim().toLowerCase();
        if (providerName === "local_stub") {
          const mediaDir = process.env.MEDIA_DIR || path.join(process.cwd(), "renderer-media");
          const mediaBase = process.env.MEDIA_CDN_BASE_URL || "http://localhost:4001/media";
          const audioPath =
            audioUrl && audioUrl.startsWith(mediaBase)
              ? path.join(mediaDir, audioUrl.replace(mediaBase, "").replace(/^\/+/, ""))
              : null;
          const exists = audioPath ? fs.existsSync(audioPath) : false;
          console.log("[reels] voiceover file exists", exists);
        }
      } catch (error) {
        ttsWarning = (error as Error).message || "Voiceover generation failed";
        withVoiceover = false;
      }
    }
    if (withVoiceover && !ttsAudioPath) {
      ttsWarning = ttsWarning || "TTS failed — rendering without voiceover";
      withVoiceover = false;
    }
    const musicTrack = input.musicEnabled === false ? null : process.env.MUSIC_TRACK_URL || null;
    const musicVolume = Number(process.env.MUSIC_VOLUME || "0.18");
    const musicDucking = (process.env.MUSIC_DUCKING || "true").toLowerCase() !== "false";
    const result = await renderVideo({
      scriptText: qcText,
      style: preset.key,
      template: preset.key,
      durationSec: input.durationSec,
      language: input.language ?? null,
      withVoiceover,
      aspectRatio: "9:16",
      audioUrl,
      scenes,
      preset,
      music: musicTrack
        ? {
            track: musicTrack,
            volume: Number.isFinite(musicVolume) ? musicVolume : 0.18,
            ducking: musicDucking,
          }
        : null,
      brand: null,
    });
    if (ttsWarning && result.status !== "failed") {
      result.error = ttsWarning;
    }
    return result;
  } catch (error) {
    console.warn("Renderer failed", error);
    return {
      jobId: `renderer_${Date.now()}`,
      status: "failed",
      error: (error as Error).message || "Renderer failed",
    };
  }
}

export async function getRendererStatus(jobId: string): Promise<VideoRenderJob> {
  try {
    return await getVideoStatus(jobId);
  } catch (error) {
    console.warn("Renderer status failed", error);
    return {
      jobId,
      status: "failed",
      error: (error as Error).message || "Renderer status failed",
    };
  }
}
