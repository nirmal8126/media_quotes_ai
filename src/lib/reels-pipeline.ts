import fs from "node:fs";
import path from "node:path";
import { synthesizeWithElevenLabs } from "@/lib/tts";
import { getVideoStatus, renderVideo } from "@/lib/video-providers/index";
import type { VideoRenderJob } from "@/lib/video-providers/types";

type TriggerInput = {
  scriptText: string;
  style?: string | null;
  template?: string | null;
  durationSec: number;
  language?: string | null;
  withVoiceover?: boolean;
};

export async function triggerRenderer(input: TriggerInput): Promise<VideoRenderJob> {
  try {
    const scriptText = input.scriptText || "";
    if (!scriptText || scriptText.trim().length < 200) {
      throw new Error("QC_FAIL: Script too short or incomplete");
    }
    const lastChar = scriptText.trim().slice(-1);
    if (!["।", ".", "!", "?"].includes(lastChar)) {
      throw new Error("QC_FAIL: Script truncated (bad ending)");
    }
    const withVoiceover = input.withVoiceover !== false;
    let audioUrl: string | null = null;
    let ttsAudioPath: string | null = null;
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
          return {
            jobId: `tts_${Date.now()}`,
            status: "failed",
            error: "Voiceover generation failed: no audio returned",
          };
        }
        console.log("[reels] voiceover voiceId", voiceId || "missing");
        console.log("[reels] voiceover audioUrl", audioUrl);
        const providerName = (process.env.VIDEO_PROVIDER || "local_stub").trim().toLowerCase();
        if (providerName === "local_stub") {
          const mediaDir = process.env.MEDIA_DIR || path.join(process.cwd(), "renderer-media");
          const mediaBase = process.env.MEDIA_CDN_BASE_URL || "http://localhost:4001/media";
          const audioPath = audioUrl.startsWith(mediaBase)
            ? path.join(mediaDir, audioUrl.replace(mediaBase, "").replace(/^\/+/, ""))
            : null;
          const exists = audioPath ? fs.existsSync(audioPath) : false;
          console.log("[reels] voiceover file exists", exists);
        }
      } catch (error) {
        return {
          jobId: `tts_${Date.now()}`,
          status: "failed",
          error: (error as Error).message || "Voiceover generation failed",
        };
      }
    }
    if (withVoiceover && !ttsAudioPath) {
      throw new Error("TTS failed — aborting reel generation");
    }
    const result = await renderVideo({
      scriptText: input.scriptText,
      style: input.style ?? null,
      template: input.template ?? null,
      durationSec: input.durationSec,
      language: input.language ?? null,
      withVoiceover,
      aspectRatio: "9:16",
      audioUrl,
      brand: null,
    });
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
