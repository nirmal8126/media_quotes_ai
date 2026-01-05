import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { listScenes, upsertScene } from "@/lib/video-service";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;
  const { searchParams } = new URL(request.url);
  const projectId = (searchParams.get("projectId") ?? "").trim();
  if (!projectId) {
    const response = NextResponse.json({ error: "projectId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const scenes = await listScenes(projectId);
    const response = NextResponse.json({ scenes });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to load scenes" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}

export async function POST(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const projectId = (body.projectId ?? "").toString().trim();
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
    const scene = await upsertScene(projectId, sceneIndex, {
      label: (body.label as string | null | undefined) ?? undefined,
      script: (body.script as string | null | undefined) ?? undefined,
      prompt: (body.prompt as string | null | undefined) ?? undefined,
      durationMs:
        typeof body.durationMs === "number"
          ? body.durationMs
          : Number.isFinite(Number(body.durationMs))
            ? Number(body.durationMs)
            : undefined,
      imageUrl: (body.imageUrl as string | null | undefined) ?? undefined,
      videoUrl: (body.videoUrl as string | null | undefined) ?? undefined,
      status: (body.status as string | null | undefined) ?? undefined,
      metadata: (body.metadata as Record<string, unknown> | null | undefined) ?? undefined,
    });

    const response = NextResponse.json({ scene }, { status: 201 });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to upsert scene" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
