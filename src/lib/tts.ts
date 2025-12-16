import fs from 'node:fs';
import path from 'node:path';

type TtsOptions = {
  text: string;
  voiceId?: string;
  apiKey?: string;
  mediaBaseUrl?: string;
  mediaDir?: string;
};

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1/text-to-speech';

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export async function synthesizeWithElevenLabs(options: TtsOptions): Promise<string | null> {
  const { text, voiceId, apiKey } = options;
  if (!apiKey || !voiceId || !text.trim()) return null;

  const mediaDir = options.mediaDir || path.join(process.cwd(), 'renderer-media');
  const mediaBase = options.mediaBaseUrl || `${process.env.MEDIA_CDN_BASE_URL || ''}` || '';
  ensureDir(mediaDir);

  const url = `${ELEVEN_BASE}/${voiceId}?optimize_streaming_latency=0`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVEN_MODEL_ID || undefined,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    // If the voice is missing, silently skip TTS so we still return a video without audio.
    if (res.status === 404 && errText.toLowerCase().includes('voice_not_found')) {
      return null;
    }
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  const fileName = `tts-${Date.now()}.mp3`;
  const filePath = path.join(mediaDir, fileName);
  await fs.promises.writeFile(filePath, audioBuffer);

  if (!mediaBase) {
    return filePath; // fallback to file path if no CDN base
  }

  return `${mediaBase.replace(/\/$/, '')}/${fileName}`;
}
