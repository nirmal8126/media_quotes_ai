"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { cn } from "@/lib/utils";

type PageOption = {
  id: string;
  name: string;
  tasks?: string[];
};

type PlatformCard = {
  platform: string;
  name: string;
  overview?: string | null;
  enabled: boolean;
  connected: boolean;
  connected_profile?: string | null;
  connected_id?: string | null;
};

const PLATFORM_ORDER = ["facebook", "instagram", "linkedin", "x", "youtube", "tiktok"];

export function SocialIntegrations() {
  const searchParams = useSearchParams();
  const [platforms, setPlatforms] = useState<PlatformCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [connectedPages, setConnectedPages] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const connectedFlag = searchParams.get("connected");

  const fetchPlatforms = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/social/platforms", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load social platforms.");
      }
      const list = Array.isArray(data.platforms) ? (data.platforms as PlatformCard[]) : [];
      list.sort((a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform));
      setPlatforms(list);
    } catch (err) {
      setError((err as Error).message || "Unable to load social platforms.");
    }
  }, []);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/social/facebook/pages", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load Facebook pages.");
      }
      const options = Array.isArray(data.pages)
        ? data.pages.map((page: PageOption) => ({
            id: String(page.id),
            name: page.name || "Untitled Page",
            tasks: page.tasks || [],
          }))
        : [];
      setPages(options);
      setSelectedPageIds(options.length ? options.map((option) => option.id) : []);
      setModalOpen(true);
    } catch (err) {
      setError((err as Error).message || "Unable to load Facebook pages.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConnectedPages = useCallback(async () => {
    try {
      const res = await fetch("/api/social/facebook/connected-pages", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return;
      }
      const list = Array.isArray(data.pages)
        ? data.pages.map((page: { page_id?: string; page_name?: string | null }) => ({
            id: page.page_id ?? "",
            name: page.page_name ?? "Untitled Page",
          }))
        : [];
      setConnectedPages(list.filter((page) => page.id));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchPlatforms();
  }, [fetchPlatforms]);

  useEffect(() => {
    if (connectedFlag === "facebook") {
      void fetchPages();
    }
  }, [connectedFlag, fetchPages]);

  const facebookCard = useMemo(
    () => platforms.find((platform) => platform.platform === "facebook") ?? null,
    [platforms],
  );

  useEffect(() => {
    if (facebookCard?.connected) {
      void fetchConnectedPages();
    } else {
      setConnectedPages([]);
    }
  }, [facebookCard?.connected, fetchConnectedPages]);

  const selectedPage = useMemo(
    () => pages.find((page) => selectedPageIds.includes(page.id)) ?? null,
    [pages, selectedPageIds],
  );

  const handleSelectPage = async () => {
    if (selectedPageIds.length === 0) {
      setError("Pick at least one Facebook Page.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/social/facebook/select-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page_ids: selectedPageIds }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to save Facebook page.");
      }
      setModalOpen(false);
      await fetchPlatforms();
      await fetchConnectedPages();
    } catch (err) {
      setError((err as Error).message || "Unable to save Facebook page.");
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/social/facebook/disconnect", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to disconnect Facebook.");
      }
      await fetchPlatforms();
      await fetchConnectedPages();
    } catch (err) {
      setError((err as Error).message || "Unable to disconnect Facebook.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-3 bg-white p-6 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-dark dark:text-dark-8">Social integrations</h2>
          <p className="text-sm text-gray-6 dark:text-dark-6">
            Connect your social platforms to publish quotes directly from MediaQuotes.
          </p>
        </div>
      </div>

      {error && <div className="mt-4 text-sm text-red-600">{error}</div>}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {platforms.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-3 p-6 text-sm text-gray-6 dark:border-stroke-dark dark:text-dark-6">
            No social platforms are enabled by the admin.
          </div>
        ) : (
          platforms.map((platform) => {
            const isFacebook = platform.platform === "facebook";
            const isConnected = platform.connected;
            const isDisabled = !platform.enabled;
            const statusLabel = isConnected ? "Connected" : "Not connected";
            return (
              <div
                key={platform.platform}
                className="flex flex-col justify-between rounded-xl border border-gray-3 bg-white p-5 shadow-sm dark:border-stroke-dark dark:bg-dark-2"
              >
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-base font-semibold text-dark dark:text-dark-8">{platform.name}</h3>
                    <span
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold",
                        isConnected
                          ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200"
                          : "bg-gray-2 text-gray-7 dark:bg-dark-3 dark:text-dark-6",
                      )}
                    >
                      {statusLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-6 dark:text-dark-6">
                    {platform.overview || "Connect to publish your content."}
                  </p>

                  {isConnected && platform.connected_profile && (
                    <div className="mt-3 text-sm text-gray-6 dark:text-dark-6">
                      Connected: <span className="font-semibold text-dark dark:text-dark-8">{platform.connected_profile}</span>
                    </div>
                  )}
                  {isConnected && platform.connected_id && (
                    <div className="text-xs text-gray-5 dark:text-dark-6">ID: {platform.connected_id}</div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {isFacebook ? (
                    !isConnected ? (
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = "/api/auth/facebook/start";
                        }}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                      >
                        Connect Facebook
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            window.location.href = "/api/auth/facebook/start";
                          }}
                          className="rounded-lg border border-gray-3 px-4 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-7 dark:hover:bg-dark-3"
                        >
                          Add Page
                        </button>
                        <button
                          type="button"
                          onClick={handleDisconnect}
                          disabled={saving}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200"
                        >
                          {saving ? "Disconnecting..." : "Disconnect"}
                        </button>
                      </>
                    )
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="rounded-lg border border-gray-3 px-4 py-2 text-sm font-semibold text-gray-5 opacity-70"
                    >
                      Coming soon
                    </button>
                  )}
                  {isDisabled && (
                    <span className="text-xs font-semibold text-gray-5">Disabled by admin</span>
                  )}
                </div>

                {isFacebook && connectedPages.length > 0 && (
                  <div className="mt-4 rounded-lg border border-dashed border-gray-3 p-3 text-xs text-gray-6 dark:border-stroke-dark dark:text-dark-6">
                    <div className="mb-2 font-semibold text-gray-7 dark:text-dark-7">Connected Pages</div>
                    <div className="space-y-1">
                      {connectedPages.map((page) => (
                        <div key={page.id} className="flex items-center justify-between gap-2">
                          <span className="font-medium text-dark dark:text-dark-8">{page.name}</span>
                          <span className="text-[11px] text-gray-5">{page.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Select a Facebook Page"
        description="Pick the Facebook Page you want to publish to."
        widthClass="max-w-lg"
      >
        {loading ? (
          <div className="py-6 text-sm text-gray-6">Loading pages...</div>
        ) : pages.length === 0 ? (
          <div className="py-6 text-sm text-gray-6">No pages found for this account.</div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-dark">
              Page
              <div className="mt-2 rounded-lg border border-gray-3 bg-white px-3 py-2">
                {selectedPageIds.length === 0 ? (
                  <div className="text-xs text-gray-5">Select one or more pages</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {pages
                      .filter((page) => selectedPageIds.includes(page.id))
                      .map((page) => (
                        <span
                          key={page.id}
                          className="inline-flex items-center gap-2 rounded-full border border-gray-3 bg-gray-1 px-3 py-1 text-xs font-semibold text-gray-7"
                        >
                          {page.name}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPageIds((prev) => prev.filter((id) => id !== page.id));
                            }}
                            className="text-gray-5 hover:text-gray-7"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </label>

            {selectedPage?.tasks?.length ? (
              <div className="text-xs text-gray-5">Permissions: {selectedPage.tasks.join(", ")}</div>
            ) : null}
            <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-gray-3 bg-white p-2 text-sm">
              {pages.map((page) => {
                const checked = selectedPageIds.includes(page.id);
                return (
                  <label key={page.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1 hover:bg-gray-1">
                    <div>
                      <div className="font-medium text-dark">{page.name}</div>
                      <div className="text-xs text-gray-5">{page.id}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        setSelectedPageIds((prev) =>
                          checked ? prev.filter((id) => id !== page.id) : [...prev, page.id],
                        );
                      }}
                      className="h-4 w-4 accent-primary"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg border border-gray-3 px-4 py-2 text-sm font-semibold text-gray-7"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSelectPage}
                disabled={saving}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Saving..." : "Use this Page"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
