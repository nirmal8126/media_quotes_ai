import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { generateCompletion } from "@/lib/openai";
import { pickProvider } from "@/lib/llm-provider";
import { getVideoProject, listScenes, upsertScene } from "@/lib/video-service";

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;
  const provider = pickProvider({ user });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = (body.projectId ?? body.id ?? "").toString().trim();
  const sceneIndexRaw = body.sceneIndex ?? body.index ?? null;
  const sceneIndex =
    typeof sceneIndexRaw === "number"
      ? sceneIndexRaw
      : Number.isFinite(Number(sceneIndexRaw))
        ? Number(sceneIndexRaw)
        : null;

  if (!projectId || sceneIndex === null) {
    const response = NextResponse.json({ error: "projectId and sceneIndex are required" }, { status: 400 });
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

    const scenes = await listScenes(projectId);
    const target = scenes.find((s) => s.sceneIndex === sceneIndex);
    const sourceText = (body.script as string | undefined)?.trim() || target?.script || "";
    const language = (body.language as string | undefined)?.trim() || project.language || "en";
    const tone = (body.tone as string | undefined)?.trim() || project.contentFormat || "default";

    const prompt = [
      `Rewrite this scene for a ${project.videoType === "longform" ? "YouTube video" : "Short/Reel"} in ${language}.`,
      `Tone/format: ${tone}. Keep it concise, high-impact, and aligned to the project topic.`,
      `Return only the rewritten scene text (no JSON, no bullet lists).`,
      `Scene text: ${sourceText || "N/A"}`,
    ].join("\n");

    const rewritten = await generateCompletion(prompt, { temperature: 0.65, maxTokens: 220, provider: provider as any });
    const nextScript = rewritten.trim() || sourceText || "Scene text placeholder";

    const scene = await upsertScene(projectId, sceneIndex, {
      script: nextScript,
      prompt: (body.prompt as string | null | undefined) ?? target?.prompt ?? null,
      durationMs:
        typeof body.durationMs === "number"
          ? body.durationMs
          : Number.isFinite(Number(body.durationMs))
            ? Number(body.durationMs)
            : target?.durationMs ?? null,
      status: "ready",
    });

    const response = NextResponse.json({ scene });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to regenerate scene" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
