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

const PORT = Number(process.env.PORT || 4001);
const API_KEY = process.env.RENDERER_API_KEY || "dev-renderer-key";
const MEDIA_BASE = process.env.MEDIA_CDN_BASE_URL || `http://localhost:${PORT}/media`;
const MEDIA_DIR = path.join(__dirname, "..", "renderer-media");

const FALLBACK_VIDEO = [
  path.join(__dirname, "..", "public", "assets", "dummy", "fallback-video.mp4"),
  path.join(__dirname, "..", "src", "assets", "dummy", "fallback-video.mp4"),
];
const FALLBACK_THUMB = [
  path.join(__dirname, "..", "public", "assets", "dummy", "fallback-thumb.jpg"),
  path.join(__dirname, "..", "src", "assets", "dummy", "fallback-thumb.jpg"),
];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function pickExisting(paths) {
  return paths.find((p) => fs.existsSync(p));
}

async function copyFileSafe(src, dest) {
  await fs.promises.copyFile(src, dest).catch(async () => {
    await fs.promises.writeFile(dest, "");
  });
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

async function handleRender(req, res, body) {
  if (!isAuthorized(req)) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const jobId = `job_${Date.now()}`;
  const videoName = `${jobId}.mp4`;
  const thumbName = `${jobId}.jpg`;

  const videoSrc = pickExisting(FALLBACK_VIDEO);
  const thumbSrc = pickExisting(FALLBACK_THUMB);
  await copyFileSafe(videoSrc || "", path.join(MEDIA_DIR, videoName));
  await copyFileSafe(thumbSrc || "", path.join(MEDIA_DIR, thumbName));

  sendJson(res, 200, {
    jobId,
    status: "ready",
    videoUrl: `${MEDIA_BASE}/${videoName}`,
    thumbnailUrl: `${MEDIA_BASE}/${thumbName}`,
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
