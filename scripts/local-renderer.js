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

function buildDrawtextFilter(textFilePath) {
  const escapedPath = textFilePath.replace(/:/g, "\\:").replace(/\\/g, "\\\\");
  return `drawtext=textfile='${escapedPath}':fontcolor=white:fontsize=48:line_spacing=16:x=(w-text_w)/2:y=(h-text_h)/2:box=1:boxcolor=black@0.45:boxborderw=24`;
}

async function handleRender(req, res, body) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const payload = parseJsonBody(body);
  ensureDir(MEDIA_DIR);
  ensureDir(RENDERS_DIR);
  ensureDir(PREVIEWS_DIR);

  const jobId = `job_${Date.now()}`;
  const videoName = `${jobId}.mp4`;
  const thumbName = `${jobId}.jpg`;
  const svgThumbName = `${jobId}.svg`;
  const renderPath = path.join(RENDERS_DIR, videoName);
  const previewPath = path.join(PREVIEWS_DIR, videoName);
  const thumbPath = path.join(PREVIEWS_DIR, thumbName);
  const svgPath = path.join(PREVIEWS_DIR, svgThumbName);

  const sceneText =
    Array.isArray(payload.scenes) && payload.scenes.length
      ? payload.scenes.map((scene) => scene && scene.script).filter(Boolean).join(" ")
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

  const durationSec = Math.max(4, Math.min(Number(payload.durationSec || payload.duration || 8), 60));
  const canRenderVideo = hasFfmpeg();
  if (!canRenderVideo) {
    return sendJson(res, 422, {
      error: "ffmpeg is required to render videos locally. Install ffmpeg and retry.",
    });
  }

  try {
    if (canRenderVideo) {
      const textFile = path.join(PREVIEWS_DIR, `${jobId}.txt`);
      await fs.promises.writeFile(textFile, displayText);
      const filter = buildDrawtextFilter(textFile);
      const ffmpegArgs = [
        "-y",
        "-f",
        "lavfi",
        "-i",
        `color=c=0x111827:s=720x1280:d=${durationSec}`,
        "-vf",
        filter,
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        renderPath,
      ];
      const ffmpegResult = spawnSync("ffmpeg", ffmpegArgs, { stdio: "ignore" });
      if (ffmpegResult.status !== 0) {
        throw new Error("ffmpeg render failed");
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
  const server = http.createServer(requestHandler);
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Local renderer stub listening on http://localhost:${PORT}`);
  });
}

start();
