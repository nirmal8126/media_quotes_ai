import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { analyzeContent } from "@/lib/integrity/IntegrityEngine";
import type { ContentUnit } from "@/lib/integrity/types";
import { saveIntegrityReport, attachIntegrityPointer } from "@/lib/integrity/persistence";
import { supabaseAdmin } from "@/lib/supabase";

type Params = { type?: string; id?: string };

function buildUnit(body: Record<string, unknown>, contentId: string, contentType: string): ContentUnit {
  return {
    id: contentId,
    type: (contentType as ContentUnit["type"]) || "other",
    platform: (body.platform as ContentUnit["platform"]) || "generic",
    textContent: typeof body.textContent === "string" ? body.textContent : (body.text as string) || "",
    mediaAssets: Array.isArray(body.mediaAssets) ? (body.mediaAssets as ContentUnit["mediaAssets"]) : undefined,
    audio: (body.audio as ContentUnit["audio"]) || undefined,
    metadata: (body.metadata as Record<string, unknown>) || undefined,
    versions: Array.isArray(body.versions) ? (body.versions as ContentUnit["versions"]) : undefined,
    previousTexts: Array.isArray(body.previousTexts)
      ? (body.previousTexts as string[]).filter((v) => typeof v === "string")
      : undefined,
    generatedCount: typeof body.generatedCount === "number" ? body.generatedCount : undefined,
  };
}

export async function GET(_request: Request, context: { params: Params } | { params: Promise<Params> }) {
  const session = await requireUser(_request);
  if ("errorResponse" in session) return session.errorResponse;
  const { applyCookies } = session;

  const params = "then" in context.params ? await context.params : context.params;
  const contentId = (params.id ?? "").toString().trim();
  const contentType = (params.type ?? "").toString().trim();
  if (!contentId || !contentType) {
    const response = NextResponse.json({ error: "type and id are required" }, { status: 400 });
    applyCookies(response);
    return response;
  }

  const { data, error } = await supabaseAdmin
    .from("content_integrity_reports")
    .select("status, score, issues, fixes")
    .eq("content_id", contentId)
    .eq("content_type", contentType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    const response = NextResponse.json({ error: error.message }, { status: 500 });
    applyCookies(response);
    return response;
  }

  const response = NextResponse.json({ report: data ?? null });
  applyCookies(response);
  return response;
}

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
  const unit = buildUnit(body, contentId, contentType);

  try {
    const report = analyzeContent(unit);
    const { reportId } = await saveIntegrityReport(report, unit, user.id);
    await attachIntegrityPointer(contentType, contentId, reportId);
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
