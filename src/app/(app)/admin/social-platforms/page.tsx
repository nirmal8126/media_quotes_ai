"use client";

import { useEffect, useState } from "react";
import { AdminTableSkeleton } from "@/components/admin-table-skeleton";
import { cn } from "@/lib/utils";

type SocialPlatform = {
  platform: string;
  name: string;
  overview?: string | null;
  enabled: boolean;
  updated_at?: string | null;
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

export default function AdminSocialPlatformsPage() {
  const [platforms, setPlatforms] = useState<SocialPlatform[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ type: "idle" });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/social-platforms", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Unable to load social platforms");
        setPlatforms(Array.isArray(body.platforms) ? body.platforms : []);
      } catch (err) {
        setStatus({ type: "error", message: (err as Error).message || "Unable to load social platforms" });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const togglePlatform = async (platform: SocialPlatform) => {
    const nextEnabled = !platform.enabled;
    setStatus({ type: "loading", message: "Updating..." });
    try {
      const res = await fetch("/api/admin/social-platforms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platform.platform, enabled: nextEnabled }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Unable to update platform");
      setPlatforms((prev) =>
        prev.map((item) => (item.platform === platform.platform ? { ...item, enabled: nextEnabled } : item)),
      );
      setStatus({ type: "success", message: "Updated" });
      setTimeout(() => setStatus({ type: "idle" }), 1200);
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to update platform" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Admin</p>
        <h1 className="text-2xl font-bold text-dark dark:text-dark-8">Social Platforms</h1>
        <p className="text-sm text-gray-6 dark:text-dark-6">
          Enable or disable social platforms for customer connections and publishing.
        </p>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        {loading ? (
          <AdminTableSkeleton rows={5} columns={4} />
        ) : status.type === "error" ? (
          <div className="py-10 text-center text-red-600">{status.message}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                <tr>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Overview</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {platforms.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-gray-6 dark:text-dark-6">
                      No platforms found.
                    </td>
                  </tr>
                ) : (
                  platforms.map((platform) => (
                    <tr key={platform.platform} className="align-top hover:bg-gray-1/60 dark:hover:bg-dark-3/70">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-dark dark:text-dark-8">{platform.name}</div>
                        <div className="text-xs text-gray-5">{platform.platform}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-6 dark:text-dark-6">
                        {platform.overview || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            platform.enabled
                              ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200"
                              : "bg-gray-2 text-gray-7 dark:bg-dark-3 dark:text-dark-6",
                          )}
                        >
                          {platform.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => togglePlatform(platform)}
                          className={cn(
                            "rounded-lg px-4 py-2 text-xs font-semibold transition",
                            platform.enabled
                              ? "border border-red-200 text-red-600 hover:bg-red-50"
                              : "border border-green-200 text-green-700 hover:bg-green-50",
                          )}
                        >
                          {platform.enabled ? "Disable" : "Enable"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {status.type !== "idle" && status.message && status.type !== "error" && (
        <div className="text-sm text-gray-6 dark:text-dark-6">{status.message}</div>
      )}
    </div>
  );
}
