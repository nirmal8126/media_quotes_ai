import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import type { ContentUnit } from "@/lib/integrity/types";
import { analyzeContent } from "@/lib/integrity/IntegrityEngine";
import { attachIntegrityPointer, logContentVersion, saveIntegrityReport } from "@/lib/integrity/persistence";

type Params = { type?: string; id?: string };

export async function POST(request: Request, context: { params: Params } | { params: Promise<Params> }) {
  const session = await requireUser(request);
  if ("errorResponse" in session) return session.errorResponse;
  const { user, applyCookies } = session;

  const params = "then" in context.params ? await context.params : context.params;
  const contentId = (params.id ?? "").toString().trim();
  const contentType = (params.type ?? "").toString().trim();
  if (!contentId || !contentType) {
    const response = NextResponse.json({ error: "type and id are required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = (body.action as string) || "fix";
  const payload = (body.payload as Record<string, unknown>) || undefined;
  const unit: ContentUnit = {
    id: contentId,
    type: contentType as any,
    platform: (body.platform as ContentUnit["platform"]) || "generic",
    textContent: typeof body.text === "string" ? body.text : undefined,
    mediaAssets: Array.isArray(body.mediaAssets) ? (body.mediaAssets as ContentUnit["mediaAssets"]) : undefined,
    audio: (body.audio as ContentUnit["audio"]) || undefined,
    metadata: (body.metadata as Record<string, unknown>) || {},
    previousTexts: Array.isArray(body.previousTexts)
      ? (body.previousTexts as string[]).filter((v) => typeof v === "string")
      : undefined,
    generatedCount: typeof body.generatedCount === "number" ? body.generatedCount : undefined,
  };

  let message = "Fix applied";
  if (action === "REPLACE_AUDIO") {
    message = "Audio marked for replacement with royalty-free track.";
  } else if (action === "REPLACE_MEDIA") {
    message = "Media marked for replacement with trusted source.";
  } else if (action === "REGENERATE" || action === "REWRITE") {
    message = "Regeneration requested.";
  }

  const report = analyzeContent(unit);
  await logContentVersion(unit, action, { action, payload, metadata: unit.metadata, text: unit.textContent });
  const { reportId, error } = await saveIntegrityReport(report, unit, user.id);
  await attachIntegrityPointer(contentType, contentId, reportId);

  const response = NextResponse.json({ message, report, reportId, error });
  applyCookies(response);
  return response;
}
