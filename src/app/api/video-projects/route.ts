import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { createVideoProject, listVideoProjects, updateVideoProject, type VideoType } from "@/lib/video-service";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  try {
    const projects = await listVideoProjects(user.id);
    const response = NextResponse.json({ projects });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to load video projects" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const body = (await request.json().catch(() => ({}))) as {
    title?: string;
    videoType?: VideoType;
    contentFormat?: string | null;
    inputMode?: string | null;
    topic?: string | null;
    prompt?: string | null;
    script?: string | null;
    language?: string | null;
    durationSeconds?: number | null;
    aspectRatio?: string | null;
    narratorVoiceId?: string | null;
    settings?: Record<string, unknown> | null;
  };

  const title = (body.title ?? "").trim();
  if (!title) {
    const response = NextResponse.json({ error: "Title is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const project = await createVideoProject(user.id, {
      title,
      videoType: body.videoType,
      contentFormat: body.contentFormat ?? null,
      inputMode: body.inputMode ?? null,
      topic: body.topic ?? null,
      prompt: body.prompt ?? null,
      script: body.script ?? null,
      language: body.language ?? "en",
      durationSeconds: body.durationSeconds ?? null,
      aspectRatio: body.aspectRatio ?? "9:16",
      narratorVoiceId: body.narratorVoiceId ?? null,
      settings: body.settings ?? null,
    });

    const response = NextResponse.json({ project }, { status: 201 });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to create video project" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}

export async function PATCH(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = (body.id ?? body.projectId ?? "").toString().trim();
  if (!projectId) {
    const response = NextResponse.json({ error: "projectId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const project = await updateVideoProject(user.id, projectId, {
      title: typeof body.title === "string" ? body.title : undefined,
      videoType: body.videoType as VideoType | undefined,
      contentFormat: (body.contentFormat as string | null | undefined) ?? undefined,
      inputMode: (body.inputMode as string | null | undefined) ?? undefined,
      topic: (body.topic as string | null | undefined) ?? undefined,
      prompt: (body.prompt as string | null | undefined) ?? undefined,
      script: (body.script as string | null | undefined) ?? undefined,
      language: (body.language as string | null | undefined) ?? undefined,
      durationSeconds:
        typeof body.durationSeconds === "number"
          ? body.durationSeconds
          : Number.isFinite(Number(body.durationSeconds))
            ? Number(body.durationSeconds)
            : undefined,
      aspectRatio: (body.aspectRatio as string | null | undefined) ?? undefined,
      narratorVoiceId: (body.narratorVoiceId as string | null | undefined) ?? undefined,
      status: body.status as any,
      settings: (body.settings as Record<string, unknown> | null | undefined) ?? undefined,
      error: (body.error as string | null | undefined) ?? undefined,
    });

    const response = NextResponse.json({ project });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to update video project" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
