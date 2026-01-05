import { supabaseAdmin } from "@/lib/supabase";
import type { ContentUnit, IntegrityReport } from "./types";

type SaveResult = { reportId: string | null; error?: string };

export async function saveIntegrityReport(
  report: IntegrityReport,
  unit: ContentUnit,
  userId: string,
): Promise<SaveResult> {
  try {
    const { data, error } = await supabaseAdmin
      .from("content_integrity_reports")
      .insert({
        content_id: unit.id,
        content_type: unit.type,
        platform: unit.platform || "generic",
        user_id: userId,
        status: report.status,
        score: report.score,
        issues: report.issues,
        fixes: report.fixes,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (error) {
      return { reportId: null, error: error.message };
    }
    return { reportId: data?.id ?? null };
  } catch (error) {
    return { reportId: null, error: (error as Error).message };
  }
}

export async function attachIntegrityPointer(
  contentType: string,
  contentId: string,
  reportId: string | null,
): Promise<void> {
  if (!reportId) return;
  const table =
    contentType === "reel"
      ? "reels"
      : contentType === "script"
        ? "scripts"
        : contentType === "quote"
          ? "quotes"
          : null;
  if (!table) return;
  try {
    await supabaseAdmin
      .from(table)
      .update({ integrity_report_id: reportId })
      .eq("id", contentId);
  } catch {
    // best effort
  }
}

export async function logContentVersion(
  unit: ContentUnit,
  action: string,
  payload?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabaseAdmin.from("content_versions").insert({
      content_id: unit.id,
      content_type: unit.type,
      version_name: action || "update",
      payload: payload ?? {},
      created_at: new Date().toISOString(),
    });
  } catch {
    // best effort
  }
}
