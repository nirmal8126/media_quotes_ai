import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { generateCompletion } from "@/lib/openai";
import { pickProvider } from "@/lib/llm-provider";
import {
  getVideoProject,
  listScenes,
  updateVideoProject,
  upsertScene,
  type VideoProjectRecord,
} from "@/lib/video-service";

function buildSceneChunks(script: string, desiredCount = 5) {
  const sentences = script
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!sentences.length) return [];

  const count = Math.min(Math.max(desiredCount, 3), 8);
  const perChunk = Math.max(1, Math.ceil(sentences.length / count));
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += perChunk) {
    chunks.push(sentences.slice(i, i + perChunk).join(" "));
  }
  return chunks.slice(0, count);
}

async function generateScriptFromPrompt(options: {
  prompt?: string | null;
  topic?: string | null;
  language?: string | null;
  videoType?: string | null;
  durationSeconds?: number | null;
  provider?: string;
}) {
  const { prompt, topic, language, videoType, durationSeconds, provider } = options;
  const targetLang = language || "en";
  const durationText =
    videoType === "longform"
      ? `${Math.max(3, Math.round((durationSeconds ?? 300) / 60))} minute`
      : `${Math.max(30, Math.min(durationSeconds ?? 60, 120))} second`;
  const idea = prompt || topic || "general story";

  const sysPrompt = [
    `Write a ${durationText} ${videoType === "longform" ? "YouTube video" : "Short/Reel"} script in ${targetLang}.`,
    `Topic/idea: ${idea}.`,
    `Return only the script text (no JSON, no headings). Keep it concise and high-impact.`,
  ].join(" ");

  const script = await generateCompletion(sysPrompt, {
    temperature: 0.7,
    maxTokens: videoType === "longform" ? 900 : 350,
    provider: provider as any,
  });

  return script.trim();
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;
  const provider = pickProvider({ user, fallback: undefined });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = (body.projectId ?? body.id ?? "").toString().trim();
  if (!projectId) {
    const response = NextResponse.json({ error: "projectId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const project = await getVideoProject(user.id, projectId);
    if (!project) {
      const response = NextResponse.json({ error: "Project not found" }, { status: 404 });
      applyCookies(response);
      return response;
    }

    await updateVideoProject(user.id, projectId, { status: "generating_script" });

    const workingLanguage = (body.language as string | null | undefined) ?? project.language ?? "en";
    const scriptText =
      typeof body.script === "string" && body.script.trim()
        ? body.script
        : project.script && project.script.trim()
          ? project.script
          : await generateScriptFromPrompt({
              prompt: (body.prompt as string | null | undefined) ?? project.prompt,
              topic: (body.topic as string | null | undefined) ?? project.topic,
              language: workingLanguage,
              videoType: project.videoType,
              durationSeconds: (body.durationSeconds as number | null | undefined) ?? project.durationSeconds,
              provider,
            }).catch((err) => {
              console.error("script generation failed, using fallback", err);
              return `Fallback script for ${project.title} (${workingLanguage}).`;
            });

    const scenesRaw = await (async () => {
      try {
        const prompt = [
          `Split this script into 4-6 scenes for a ${project.videoType === "longform" ? "YouTube video" : "Short/Reel"} in ${workingLanguage}.`,
          `Return JSON array of {label,text,duration_ms,visual_suggestion}. Keep duration_ms reasonable for total length.`,
          scriptText,
        ].join("\n");
        const json = await generateCompletion(prompt, { temperature: 0.6, maxTokens: 500, provider: provider as any });
        const parsed = JSON.parse(json);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray(parsed?.scenes)) return parsed.scenes;
      } catch (err) {
        console.error("scene JSON generation failed, falling back to splits", err);
      }
      const chunks = buildSceneChunks(scriptText, 5);
      return chunks.map((chunk, idx, arr) => ({
        label: `Scene ${idx + 1}`,
        text: chunk,
        duration_ms: Math.round(((project.durationSeconds ?? 60) * 1000) / Math.max(arr.length, 1)),
        visual_suggestion: "auto",
      }));
    })();

    // upsert scenes
    for (let i = 0; i < scenesRaw.length; i += 1) {
      const scene = scenesRaw[i] as Record<string, any>;
      await upsertScene(projectId, i, {
        label: scene.label ?? `Scene ${i + 1}`,
        script: scene.text ?? scene.script ?? "",
        prompt: scene.visual_suggestion ?? scene.prompt ?? null,
        durationMs:
          typeof scene.duration_ms === "number"
            ? scene.duration_ms
            : Number.isFinite(Number(scene.duration_ms))
              ? Number(scene.duration_ms)
              : null,
        status: "ready",
        metadata: scene,
      });
    }

    const scenes = await listScenes(projectId);
    await updateVideoProject(user.id, projectId, { status: "editing", script: scriptText });

    const response = NextResponse.json({ script: scriptText, scenes });
    applyCookies(response);
    return response;
  } catch (error) {
    console.error("video scene generation failed", error);
    await updateVideoProject(user.id, projectId, { status: "failed", error: (error as Error).message });
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to generate scenes" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
