import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { analyzeContentIntegrity, persistIntegrityReport } from "@/lib/integrity-engine";
import type { ContentUnit } from "@/types/content-integrity";

type Params = { contentId?: string };

export async function POST(request: Request, context: { params: Params }) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const body = (await request.json().catch(() => ({}))) as Partial<ContentUnit> & { type?: string };
  const contentId = (context.params.contentId ?? body.id ?? "").toString().trim();
  const contentType = (body.type ?? "other") as ContentUnit["type"];

  if (!contentType) {
    const response = NextResponse.json({ error: "type is required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const unit: ContentUnit = {
    id: contentId || undefined,
    type: contentType,
    text: typeof body.text === "string" ? body.text : "",
    originalText: typeof body.originalText === "string" ? body.originalText : undefined,
    previousTexts: Array.isArray(body.previousTexts) ? body.previousTexts.filter((t): t is string => typeof t === "string") : [],
    generatedCount: typeof body.generatedCount === "number" ? body.generatedCount : undefined,
    mediaSources: Array.isArray(body.mediaSources)
      ? body.mediaSources.map((s) => (typeof s === "string" ? (s as any) : "unknown"))
      : undefined,
    hasTrendingAudio: Boolean(body.hasTrendingAudio),
    metadata: body.metadata as Record<string, unknown> | undefined,
  };

  try {
    const report = await analyzeContentIntegrity(unit);
    if (contentId) {
      await persistIntegrityReport(contentId, user.id, report);
    }
    const response = NextResponse.json({ report });
    applyCookies(response);
    return response;
  } catch (error) {
    const response = NextResponse.json(
      { error: (error as Error).message || "Unable to compute integrity report." },
      { status: 500 },
    );
    applyCookies(response);
    return response;
  }
}

