export type ReelLifecycleStatus =
  | "DRAFT"
  | "GENERATING"
  | "READY"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELED"
  | "RENDERING";

export function normalizeReelStatus(status?: string | null): ReelLifecycleStatus {
  const normalized = (status ?? "").toString().trim().toUpperCase();
  if (normalized === "RENDERING") return "GENERATING";
  if (
    normalized === "DRAFT" ||
    normalized === "GENERATING" ||
    normalized === "READY" ||
    normalized === "PUBLISHING" ||
    normalized === "PUBLISHED" ||
    normalized === "FAILED" ||
    normalized === "CANCELED"
  ) {
    return normalized;
  }
  return "DRAFT";
}

export function normalizeStatusBadge(status?: string | null) {
  const normalized = normalizeReelStatus(status);
  switch (normalized) {
    case "READY":
      return { label: "Ready", className: "bg-green-100 text-green-700" };
    case "PUBLISHING":
      return { label: "Publishing", className: "bg-blue-100 text-blue-700" };
    case "PUBLISHED":
      return { label: "Published", className: "bg-emerald-100 text-emerald-700" };
    case "FAILED":
      return { label: "Failed", className: "bg-red-100 text-red-700" };
    case "CANCELED":
      return { label: "Canceled", className: "bg-gray-2 text-gray-7" };
    case "DRAFT":
      return { label: "Draft", className: "bg-gray-2 text-gray-7" };
    default:
      return { label: "Generating", className: "bg-amber-100 text-amber-700" };
  }
}
