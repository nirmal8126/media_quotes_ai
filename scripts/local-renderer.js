#!/usr/bin/env node
/**
 * Lightweight local renderer stub.
 * - POST /render with Authorization: Bearer <RENDERER_API_KEY>
 *   returns { jobId, status: "ready", videoUrl, thumbnailUrl }
 * - Serves static files from /media
 *
 * Env (defaults match project .env.local):
 *   RENDERER_API_URL=http://localhost:4001
 *   RENDERER_API_KEY=dev-renderer-key
 *   MEDIA_CDN_BASE_URL=http://localhost:4001/media
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const { spawnSync } = require("child_process");

const PORT = Number(process.env.PORT || 4001);
const API_KEY = process.env.RENDERER_API_KEY || "dev-renderer-key";
const MEDIA_BASE = process.env.MEDIA_CDN_BASE_URL || `http://localhost:${PORT}/media`;
const MEDIA_DIR = path.join(__dirname, "..", "renderer-media");
const RENDERS_DIR = path.join(MEDIA_DIR, "renders");
const PREVIEWS_DIR = path.join(MEDIA_DIR, "previews");
const AUDIO_DIR = path.join(MEDIA_DIR, "audio");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function isAuthorized(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header) return false;
  const [scheme, token] = String(header).split(" ");
  return scheme === "Bearer" && token === API_KEY;
}

function parseJsonBody(raw) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function sanitizeText(input) {
  return String(input || "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(input, max) {
  if (!input) return "";
  if (input.length <= max) return input;
  return `${input.slice(0, max - 1)}…`;
}

function wrapText(input, maxLen, maxLines) {
  const words = String(input || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLen && current) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });

  if (current) lines.push(current);
  return lines.slice(0, maxLines).join("\n");
}

function hasFfmpeg() {
  const result = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  return result.status === 0;
}

function writeSvgThumbnail({ text, outputPath }) {
  const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = safeText.split(/\n+/).slice(0, 6);
  const lineHeight = 64;
  const startY = 240;
  const textNodes = lines
    .map((line, index) => `<text x="80" y="${startY + index * lineHeight}">${line}</text>`)
    .join("");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1f2937"/>
    </linearGradient>
  </defs>
  <rect width="720" height="1280" fill="url(#bg)"/>
  <rect x="60" y="180" width="600" height="920" rx="32" fill="rgba(15,23,42,0.45)" stroke="rgba(255,255,255,0.12)" />
  <text x="80" y="150" fill="#f59e0b" font-family="Arial, sans-serif" font-size="28" letter-spacing="6">MEDIAQUOTES AI</text>
  <g fill="#ffffff" font-family="Arial, sans-serif" font-size="44" font-weight="700">
    ${textNodes}
  </g>
  <text x="80" y="1160" fill="#9ca3af" font-family="Arial, sans-serif" font-size="24">Generated locally</text>
</svg>`;
  return fs.promises.writeFile(outputPath, svg);
}

function buildDrawtextFilter(textFilePath, options = {}) {
  const escapedPath = textFilePath.replace(/:/g, "\\:").replace(/\\/g, "\\\\");
  const fontColor = options.fontColor || "white";
  const boxColor = options.boxColor || "black@0.45";
  const fontSize = options.fontSize || 48;
  return `drawtext=textfile='${escapedPath}':fontcolor=${fontColor}:fontsize=${fontSize}:line_spacing=16:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=${boxColor}:boxborderw=24`;
}

async function buildSceneFilters(scenes, jobId, options = {}) {
  let cursor = 0;
  const filters = [];
  let index = 0;
  const fontColor = options.fontColor || "white";
  const boxColor = options.boxColor || "black@0.45";
  const fontSize = options.fontSize || 48;

  for (const scene of scenes) {
    const durationMs = Number(scene.durationMs);
    if (!Number.isFinite(durationMs) || durationMs <= 0) continue;
    const text = wrapText(scene.text || "", 24, 6);
    if (!text) {
      cursor += durationMs / 1000;
      continue;
    }
    const startSec = cursor;
    const endSec = cursor + durationMs / 1000;
    cursor = endSec;
    const textFile = path.join(PREVIEWS_DIR, `${jobId}-scene-${index}.txt`);
    index += 1;
    await fs.promises.writeFile(textFile, text);
    const escapedPath = textFile.replace(/:/g, "\\:").replace(/\\/g, "\\\\");
    filters.push(
      `drawtext=textfile='${escapedPath}':fontcolor=${fontColor}:fontsize=${fontSize}:line_spacing=16:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=${boxColor}:boxborderw=24:enable='between(t,${startSec.toFixed(
        3,
      )},${endSec.toFixed(3)})'`,
    );
  }

  return filters.join(",");
}

function resolvePresetPayload(payload) {
  if (payload?.preset && typeof payload.preset === "object") return payload.preset;
  if (payload?.visual?.preset && typeof payload.visual.preset === "object") return payload.visual.preset;
  if (payload?.custom?.preset && typeof payload.custom.preset === "object") return payload.custom.preset;
  return null;
}

function getAudioDurationSec(audioPath) {
  if (!audioPath || !fs.existsSync(audioPath)) return null;
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", audioPath],
    { stdio: "pipe" },
  );
  if (probe.status !== 0 || !probe.stdout) return null;
  const value = Number.parseFloat(probe.stdout.toString().trim());
  return Number.isFinite(value) && value > 0 ? value : null;
}

function resolveAudioPath(input) {
  if (!input) return null;
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith("/media/")) {
        const relative = decodeURIComponent(parsed.pathname.replace(/^\/media\//, ""));
        return path.join(MEDIA_DIR, relative);
      }
      return null;
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/media/")) {
    return path.join(MEDIA_DIR, trimmed.replace(/^\/media\//, ""));
  }

  if (fs.existsSync(trimmed)) return trimmed;
  return null;
}

function resolveMusicInput(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith("/media/")) {
        const relative = decodeURIComponent(parsed.pathname.replace(/^\/media\//, ""));
        return { source: path.join(MEDIA_DIR, relative), isLocal: true };
      }
      return { source: trimmed, isLocal: false };
    } catch {
      return null;
    }
  }

  if (trimmed.startsWith("/media/")) {
    return { source: path.join(MEDIA_DIR, trimmed.replace(/^\/media\//, "")), isLocal: true };
  }

  if (fs.existsSync(trimmed)) return { source: trimmed, isLocal: true };
  return null;
}

function normalizeHexColor(input, fallback) {
  if (!input || typeof input !== "string") return fallback;
  const trimmed = input.trim();
  const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return `0x${hex}`;
  return fallback;
}

function normalizeBoxColor(input, fallback) {
  if (!input || typeof input !== "string") return fallback;
  const trimmed = input.trim();
  if (/^rgba\(/i.test(trimmed)) {
    const parts = trimmed.replace(/rgba\(|\)/gi, "").split(",").map((part) => part.trim());
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = Number(parts[3]);
    if ([r, g, b, a].every((val) => Number.isFinite(val))) {
      const hex = [r, g, b]
        .map((val) => Math.max(0, Math.min(255, Math.round(val))).toString(16).padStart(2, "0"))
        .join("");
      return `0x${hex}@${Math.max(0, Math.min(1, a))}`;
    }
  }
  if (trimmed.includes("@")) return trimmed;
  if (trimmed.startsWith("#")) return `${normalizeHexColor(trimmed, "0x000000")}@0.45`;
  return trimmed;
}

function normalizeScenes(payload, fallbackDurationSec) {
  if (!Array.isArray(payload?.scenes) || payload.scenes.length === 0) return null;
  const rawScenes = payload.scenes
    .map((scene) => ({
      text: sanitizeText(scene?.text || scene?.script || ""),
      durationMs: Number(
        scene?.durationMs ??
          scene?.duration_ms ??
          (Number(scene?.endMs) > Number(scene?.startMs) ? Number(scene?.endMs) - Number(scene?.startMs) : 0),
      ),
    }))
    .filter((scene) => scene.text);

  if (rawScenes.length === 0) return null;

  const totalMs = rawScenes.reduce(
    (sum, scene) => sum + (Number.isFinite(scene.durationMs) ? scene.durationMs : 0),
    0,
  );
  const targetMs = Math.max(4000, Math.round(Number(fallbackDurationSec) * 1000) || 15000);

  const missingDuration = rawScenes.some((scene) => !Number.isFinite(scene.durationMs) || scene.durationMs <= 0);
  if (missingDuration || totalMs <= 0) {
    const perScene = Math.floor(targetMs / rawScenes.length);
    let remainder = targetMs - perScene * rawScenes.length;
    return rawScenes.map((scene) => {
      const extra = remainder > 0 ? 1 : 0;
      remainder = Math.max(0, remainder - 1);
      return {
        text: scene.text,
        durationMs: perScene + extra,
      };
    });
  }

  return rawScenes;
}

async function handleRender(req, res, body) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const payload = parseJsonBody(body);
  ensureDir(MEDIA_DIR);
  ensureDir(RENDERS_DIR);
  ensureDir(PREVIEWS_DIR);
  ensureDir(AUDIO_DIR);

  const jobId = `job_${Date.now()}`;
  const videoName = `${jobId}.mp4`;
  const thumbName = `${jobId}.jpg`;
  const svgThumbName = `${jobId}.svg`;
  const renderPath = path.join(RENDERS_DIR, videoName);
  const previewPath = path.join(PREVIEWS_DIR, videoName);
  const thumbPath = path.join(PREVIEWS_DIR, thumbName);
  const svgPath = path.join(PREVIEWS_DIR, svgThumbName);

  const normalizedScenes = normalizeScenes(payload, payload.durationSec || payload.duration || 15);
  const sceneText = normalizedScenes
    ? normalizedScenes.map((scene) => scene.text).filter(Boolean).join(" ")
    : "";
  const scriptText = sanitizeText(
    payload.script ||
      payload.scriptText ||
      payload.text ||
      payload.prompt ||
      payload.idea ||
      sceneText,
  );
  const headline = truncateText(scriptText || "Your AI Reel", 160);
  const displayText = headline || "Your AI Reel";

  const requestedDuration = Math.max(4, Math.min(Number(payload.durationSec || payload.duration || 8), 60));
  const audioPath = resolveAudioPath(payload.audioUrl);
  const musicInput = resolveMusicInput(payload?.music?.track);
  const musicVolumeRaw = Number(payload?.music?.volume ?? process.env.MUSIC_VOLUME ?? "0.18");
  const musicVolume = Number.isFinite(musicVolumeRaw) ? musicVolumeRaw : 0.18;
  const musicDucking = payload?.music?.ducking !== false;
  const audioDuration = getAudioDurationSec(audioPath);
  const scenesDurationMs = normalizedScenes
    ? normalizedScenes.reduce((sum, scene) => sum + scene.durationMs, 0)
    : 0;
  let durationSec = normalizedScenes && scenesDurationMs > 0 ? Math.round(scenesDurationMs / 1000) : requestedDuration;
  if (audioDuration) {
    durationSec = Math.max(durationSec, Math.min(Math.round(audioDuration), 60));
  }
  durationSec = Math.max(4, Math.min(durationSec, 60));

  if (normalizedScenes && scenesDurationMs > 0) {
    const targetMs = durationSec * 1000;
    const diff = targetMs - scenesDurationMs;
    if (diff > 0) {
      const last = normalizedScenes[normalizedScenes.length - 1];
      last.durationMs += diff;
    }
  }
  console.log("[renderer] durations", { requestedDuration, audioDuration, durationSec });
  const canRenderVideo = hasFfmpeg();
  if (!canRenderVideo) {
    return sendJson(res, 422, {
      error: "ffmpeg is required to render videos locally. Install ffmpeg and retry.",
    });
  }

  try {
    if (canRenderVideo) {
      const preset = resolvePresetPayload(payload);
      const bgColor = normalizeHexColor(preset?.background?.color, "0x111827");
      const fontColor = preset?.text?.color || "white";
      const boxColor = normalizeBoxColor(preset?.text?.boxColor, "black@0.45");
      const fontSize = preset?.textAnimation === "pop" ? 56 : 48;
      let filter = "";
      if (normalizedScenes && normalizedScenes.length > 0) {
        filter = await buildSceneFilters(normalizedScenes, jobId, { fontColor, boxColor, fontSize });
      }
      if (!filter) {
        const textFile = path.join(PREVIEWS_DIR, `${jobId}.txt`);
        await fs.promises.writeFile(textFile, displayText);
        filter = buildDrawtextFilter(textFile, { fontColor, boxColor, fontSize });
      }
      const ffmpegArgs = [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=${bgColor}:s=720x1280:d=${durationSec}`,
      ];
      let voiceIndex = null;
      let musicIndex = null;
      let inputIndex = 1;

      if (audioPath && fs.existsSync(audioPath)) {
        ffmpegArgs.push("-stream_loop", "-1", "-i", audioPath);
        voiceIndex = inputIndex;
        inputIndex += 1;
      }

      if (musicInput?.source) {
        if (musicInput.isLocal) {
          ffmpegArgs.push("-stream_loop", "-1", "-i", musicInput.source);
        } else {
          ffmpegArgs.push("-i", musicInput.source);
        }
        musicIndex = inputIndex;
        inputIndex += 1;
      }

      let audioFilterComplex = "";
      let audioMap = "";
      if (voiceIndex !== null && musicIndex !== null) {
        const duckFilter = musicDucking
          ? `[music][voice]sidechaincompress=threshold=0.1:ratio=8:attack=5:release=200[ducked];[voice][ducked]amix=inputs=2:duration=first:dropout_transition=2[a]`
          : `[voice][music]amix=inputs=2:duration=first:dropout_transition=2[a]`;
        audioFilterComplex = [
          `[${voiceIndex}:a]aresample=async=1,apad[voice]`,
          `[${musicIndex}:a]volume=${musicVolume}[music]`,
          duckFilter,
        ].join(";");
        audioMap = "[a]";
      } else if (voiceIndex !== null) {
        audioFilterComplex = `[${voiceIndex}:a]aresample=async=1,apad[a]`;
        audioMap = "[a]";
      } else if (musicIndex !== null) {
        audioFilterComplex = `[${musicIndex}:a]volume=${musicVolume},apad[a]`;
        audioMap = "[a]";
      }

      if (audioFilterComplex) {
        ffmpegArgs.push(
          "-vf",
          filter,
          "-r",
          "30",
          "-filter_complex",
          audioFilterComplex,
          "-map",
          "0:v:0",
          "-map",
          audioMap,
          "-c:v",
          "libx264",
          "-c:a",
          "aac",
          "-b:a",
          "128k",
          "-pix_fmt",
          "yuv420p",
          "-t",
          `${durationSec}`,
          renderPath,
        );
      } else {
        ffmpegArgs.push(
          "-vf",
          filter,
          "-r",
          "30",
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          renderPath,
        );
      }
      const ffmpegResult = spawnSync("ffmpeg", ffmpegArgs, { stdio: "pipe" });
      if (ffmpegResult.status !== 0) {
        const stderr = ffmpegResult.stderr ? ffmpegResult.stderr.toString() : "";
        const stdout = ffmpegResult.stdout ? ffmpegResult.stdout.toString() : "";
        console.error("[renderer] ffmpeg render failed", { audioPath, stderr, stdout });
        throw new Error(`ffmpeg render failed${stderr ? `: ${stderr.trim()}` : ""}`);
      }
      await fs.promises.copyFile(renderPath, previewPath);
      const thumbResult = spawnSync(
        "ffmpeg",
        ["-y", "-i", renderPath, "-ss", "00:00:01", "-vframes", "1", thumbPath],
        { stdio: "ignore" },
      );
      if (thumbResult.status !== 0) {
        await writeSvgThumbnail({ text: displayText, outputPath: svgPath });
      }
    } else {
      await writeSvgThumbnail({ text: displayText, outputPath: svgPath });
    }
  } catch (error) {
    return sendJson(res, 500, { error: (error && error.message) || "Render failed" });
  }

  const thumbnailUrl = fs.existsSync(thumbPath)
    ? `${MEDIA_BASE}/previews/${thumbName}`
    : `${MEDIA_BASE}/previews/${svgThumbName}`;

  sendJson(res, 200, {
    jobId,
    status: "ready",
    videoUrl: canRenderVideo ? `${MEDIA_BASE}/renders/${videoName}` : null,
    thumbnailUrl,
  });
}

function serveMedia(req, res, pathname) {
  const filePath = path.join(MEDIA_DIR, pathname.replace(/^\/media\//, ""));
  if (!filePath.startsWith(MEDIA_DIR)) {
    return sendJson(res, 403, { error: "Forbidden" });
  }
  fs.promises
    .readFile(filePath)
    .then((data) => {
      const ext = path.extname(filePath).toLowerCase();
      const mime =
        ext === ".mp4"
          ? "video/mp4"
          : ext === ".mp3"
          ? "audio/mpeg"
          : ext === ".jpg" || ext === ".jpeg"
          ? "image/jpeg"
          : ext === ".svg"
          ? "image/svg+xml"
          : "application/octet-stream";
      res.writeHead(200, { "Content-Type": mime });
      res.end(data);
    })
    .catch(() => sendJson(res, 404, { error: "Not found" }));
}

function requestHandler(req, res) {
  const { pathname } = url.parse(req.url || "/");

  if (req.method === "POST" && pathname === "/render") {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => handleRender(req, res, raw));
    return;
  }

  if (req.method === "GET" && pathname.startsWith("/media/")) {
    return serveMedia(req, res, pathname);
  }

  sendJson(res, 404, { error: "Not found" });
}

function start() {
  ensureDir(MEDIA_DIR);
  ensureDir(AUDIO_DIR);
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Local renderer stub listening on http://localhost:${PORT}`);
  });
}

start();
