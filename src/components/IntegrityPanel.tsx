import { useState } from "react";
import { cn } from "@/lib/utils";
import type { IntegrityFix, IntegrityIssue, IntegrityReport } from "@/lib/integrity/types";

type Props = {
  report: IntegrityReport | null;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onFix?: (fix: IntegrityFix) => void;
  className?: string;
};

const STATUS_LABEL: Record<IntegrityReport["status"], string> = {
  safe: "Safe",
  warn: "Warning",
  risk: "Risk",
};

function badgeClass(status: IntegrityReport["status"]) {
  if (status === "risk") return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200";
  if (status === "warn") return "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-100";
}

export function IntegrityPanel({ report, loading, error, onRefresh, onFix, className }: Props) {
  const [open, setOpen] = useState(false);
  const status = report?.status ?? "warn";
  const score = report?.score ?? null;
  const issues: IntegrityIssue[] =
    report?.issues ??
    (loading ? [] : [{ code: "PENDING", severity: "warn", message: "Run integrity check to view details." }]);
  const fixes: IntegrityFix[] =
    report?.fixes ?? [
      { action: "REGENERATE", label: "Regenerate with variation" },
      { action: "REWRITE", label: "Rewrite with different tone" },
    ];

  return (
    <div className={cn("rounded-xl border border-gray-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-gray-900", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", badgeClass(status))}>
            {STATUS_LABEL[status]}
          </span>
          {score !== null && <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">Score: {score}/100</span>}
          {error && <span className="text-xs text-red">{error}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRefresh?.()}
            disabled={loading}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary disabled:opacity-60 dark:border-white/10 dark:text-gray-200"
          >
            {loading ? "Checking..." : "Refresh"}
          </button>
          <button
            onClick={() => setOpen((prev) => !prev)}
            className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
          >
            {open ? "Hide" : "Details"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {issues.map((reason) => (
            <div
              key={`${reason.code}-${reason.message}`}
              className={cn(
                "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                reason.severity === "risk"
                  ? "border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10"
                  : reason.severity === "warn"
                    ? "border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10"
                    : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10",
              )}
            >
              <span className="text-xs font-semibold uppercase text-gray-600 dark:text-gray-300">
                {reason.code}
              </span>
              <span className="text-gray-800 dark:text-gray-100">{reason.message}</span>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            {fixes.map((fix) => (
              <button
                key={fix.action}
                onClick={() => onFix?.(fix)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-primary hover:text-primary dark:border-white/10 dark:text-gray-200"
              >
                {fix.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

