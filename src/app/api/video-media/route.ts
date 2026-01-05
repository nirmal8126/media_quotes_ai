import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { listMedia, upsertMedia } from "@/lib/video-service";

export async function GET(request: Request) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;

  const { searchParams } = new URL(request.url);
  const projectId = (searchParams.get("projectId") ?? "").trim();
  const sceneId = (searchParams.get("sceneId") ?? "").trim() || undefined;
  const mediaType = (searchParams.get("mediaType") ?? "").trim() || undefined;

  if (!projectId) {
    const response = NextResponse.json({ error: "projectId is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const media = await listMedia(projectId, { sceneId, mediaType });
    const response = NextResponse.json({ media });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to load media" },
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
  const sceneId = (body.sceneId ?? "")?.toString().trim() || null;
  const mediaType = (body.mediaType ?? body.type ?? "").toString().trim();
  const url = (body.url ?? "").toString().trim();
  const source = (body.source ?? "").toString().trim() || null;
  const metadata = (body.metadata as Record<string, unknown> | null | undefined) ?? null;

  if (!projectId || !mediaType || !url) {
    const response = NextResponse.json({ error: "projectId, mediaType, and url are required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  try {
    const media = await upsertMedia({
      projectId,
      sceneId,
      mediaType,
      source,
      url,
      metadata,
    });
    const response = NextResponse.json({ media }, { status: 201 });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to save media" },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}
