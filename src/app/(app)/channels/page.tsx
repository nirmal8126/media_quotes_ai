"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { DEFAULT_LANGUAGE, labelForLanguage, languageOptions, resolveLanguageCode } from "@/lib/languages";

type Channel = {
  id: string;
  name: string;
  platform?: string | null;
  handle?: string | null;
  tone?: string | null;
  style?: string | null;
  personaId?: string | null;
  topic?: string | null;
  audience?: string | null;
  contentType?: string | null;
  durationDefault?: number | null;
  ctaDefault?: string | null;
  baseHashtags?: string[] | null;
  styleRules?: string | null;
  visualStyle?: string | null;
  postingFrequency?: string | null;
  brandColors?: string[] | null;
  brandFonts?: string[] | null;
  endScreenTemplate?: string | null;
  characterName?: string | null;
  characterImages?: string[] | null;
  logoUrl?: string | null;
  language?: string | null;
  createdAt?: string | null;
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

const platformOptions = ["youtube", "youtube_shorts", "instagram", "facebook", "tiktok", "linkedin"];
const toneOptions = ["funny", "playful", "motivational", "educational", "dramatic", "emotional", "business"];
const styleOptions = ["cartoon", "cinematic", "minimal", "bold", "aesthetic", "fast-cut"];

const defaultForm = {
  name: "",
  platform: "youtube_shorts",
  handle: "",
  tone: "",
  style: "",
  personaId: "",
  topic: "",
  audience: "",
  contentType: "",
  durationDefault: "",
  ctaDefault: "",
  baseHashtags: "",
  styleRules: "",
  visualStyle: "",
  postingFrequency: "",
  brandColors: "",
  brandFonts: "",
  endScreenTemplate: "",
  characterName: "",
  characterImages: "",
  logoUrl: "",
  language: DEFAULT_LANGUAGE,
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [detailRow, setDetailRow] = useState<Channel | null>(null);
  const [deleteRow, setDeleteRow] = useState<Channel | null>(null);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [languageQuery, setLanguageQuery] = useState(labelForLanguage(defaultForm.language));
  const [showLanguageList, setShowLanguageList] = useState(false);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return channels;
    return channels.filter((c) => {
      const text = [
        c.name,
        c.platform,
        c.handle,
        c.tone,
        c.style,
        c.language,
        c.topic,
        c.audience,
        c.contentType,
        c.postingFrequency,
        c.styleRules,
        c.visualStyle,
        c.characterName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [channels, search]);

  const filteredLanguages = useMemo(() => {
    if (!showLanguageList) return [];
    const term = (languageQuery || "").trim().toLowerCase();
    if (!term || term === "choose a language...") return languageOptions;

    const exactMatch = languageOptions.some(
      (lang) => lang.label.toLowerCase() === term || lang.code.toLowerCase() === term,
    );
    if (exactMatch) return languageOptions;

    return languageOptions.filter(
      (lang) => lang.label.toLowerCase().includes(term) || lang.code.toLowerCase().includes(term),
    );
  }, [languageQuery, showLanguageList]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, search]);

  const resetForm = () => {
    setForm({ ...defaultForm });
    setEditingId(null);
    setStatus({ type: "idle" });
    setLanguageQuery(labelForLanguage(defaultForm.language));
    setShowLanguageList(false);
  };

  const loadChannels = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/channels", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to load channels.");
      }
      setChannels(Array.isArray(body.channels) ? body.channels : []);
    } catch (err) {
      setError((err as Error).message || "Unable to load channels.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadChannels();
  }, []);

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (channel: Channel) => {
    setEditingId(channel.id);
    setForm({
      name: channel.name || "",
      platform: channel.platform || "youtube_shorts",
      handle: channel.handle || "",
      tone: channel.tone || "",
      style: channel.style || "",
      personaId: channel.personaId || "",
      topic: channel.topic || "",
      audience: channel.audience || "",
      contentType: channel.contentType || "",
      styleRules: channel.styleRules || "",
      visualStyle: channel.visualStyle || "",
      postingFrequency: channel.postingFrequency || "",
      brandColors: (channel.brandColors || []).join(", "),
      brandFonts: (channel.brandFonts || []).join(", "),
      endScreenTemplate: channel.endScreenTemplate || "",
      durationDefault: channel.durationDefault?.toString() ?? "",
      ctaDefault: channel.ctaDefault || "",
      baseHashtags: (channel.baseHashtags || []).join(", "),
      characterName: channel.characterName || "",
      characterImages: (channel.characterImages || []).join(", "),
      logoUrl: channel.logoUrl || "",
      language: channel.language || "",
    });
    setLanguageQuery(labelForLanguage(channel.language) || "");
    setShowLanguageList(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setStatus({ type: "error", message: "Channel name is required." });
      return;
    }
    setSaving(true);
    setStatus({ type: "idle" });

    const characterImages = form.characterImages
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const baseHashtags = form.baseHashtags
      .split(",")
      .map((v) => v.trim().replace(/^#/, ""))
      .filter(Boolean)
      .map((v) => `#${v}`);
    const brandColors = form.brandColors
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const brandFonts = form.brandFonts
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const resolvedLanguage = (form.language || languageQuery).trim();
    const languageCode = resolvedLanguage ? resolveLanguageCode(resolvedLanguage) : null;

    const payload = {
      name: form.name.trim(),
      platform: form.platform || null,
      handle: form.handle.trim() || null,
      tone: form.tone || null,
      style: form.style || null,
      personaId: form.personaId || null,
      topic: form.topic || null,
      audience: form.audience || null,
      contentType: form.contentType || null,
      language: languageCode,
      styleRules: form.styleRules || null,
      visualStyle: form.visualStyle || null,
      postingFrequency: form.postingFrequency || null,
      brandColors,
      brandFonts,
      endScreenTemplate: form.endScreenTemplate || null,
      durationDefault:
        form.durationDefault === "" ? null : Number.isFinite(Number(form.durationDefault)) ? Number(form.durationDefault) : null,
      ctaDefault: form.ctaDefault || null,
      baseHashtags,
      characterName: form.characterName || null,
      characterImages,
      logoUrl: form.logoUrl || null,
    };

    try {
      const res = await fetch("/api/channels", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to save channel.");
      }
      const saved: Channel | undefined = body.channel;
      if (saved) {
        setChannels((prev) => {
          const exists = prev.find((c) => c.id === saved.id);
          if (exists) return prev.map((c) => (c.id === saved.id ? saved : c));
          return [saved, ...prev];
        });
      }
      setStatus({ type: "success", message: editingId ? "Channel updated." : "Channel created." });
      setShowModal(false);
      resetForm();
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to save channel." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setSaving(true);
    setStatus({ type: "idle" });
    try {
      const res = await fetch(`/api/channels?channelId=${encodeURIComponent(deleteRow.id)}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to delete channel.");
      }
      setChannels((prev) => prev.filter((c) => c.id !== deleteRow.id));
      if (detailRow?.id === deleteRow.id) setDetailRow(null);
      setDeleteRow(null);
    } catch (err) {
      setStatus({ type: "error", message: (err as Error).message || "Unable to delete channel." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Channels</p>
          <h1 className="text-2xl font-bold text-dark dark:text-dark-8">Manage your social channels</h1>
          <p className="text-sm text-gray-6 dark:text-dark-6">Keep tone, characters, and assets consistent for each channel.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          + Create Channel
        </button>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        {loading ? (
          <div className="py-10 text-center text-gray-6 dark:text-dark-6">Loading channels...</div>
        ) : error ? (
          <div className="py-10 text-center text-red-600">{error}</div>
        ) : (
          <div className="space-y-4 overflow-x-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-7 dark:text-dark-7">
                <span className="text-gray-6 dark:text-dark-6">Show</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) || 5)}
                  className="h-10 rounded-lg border border-gray-3 bg-white px-3 text-sm font-semibold text-dark focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                >
                  {[5, 10, 20, 50].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
                <span className="text-gray-6 dark:text-dark-6">entries</span>
              </div>

              <div className="flex flex-col gap-1">
                <div className="text-xs font-semibold text-gray-6 dark:text-dark-6">
                  Search <span className="font-normal">(name, platform, topic)</span>
                </div>
                <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search channels"
                    className="h-10 w-56 rounded-lg border border-gray-3 bg-white px-3 pl-9 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    aria-label="Search channels"
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-5">🔍</span>
                </div>
              </div>
            </div>

            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                <tr>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Tone / Style</th>
                  <th className="px-4 py-3">Audience</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-6 dark:text-dark-6">
                      No channels found.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((channel) => (
                    <tr key={channel.id} className="hover:bg-gray-1/60 align-top dark:hover:bg-dark-3/70">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {channel.logoUrl ? (
                            <img
                              src={channel.logoUrl}
                              alt={channel.name}
                              className="h-10 w-10 rounded-lg border border-gray-3 object-cover dark:border-stroke-dark"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-gray-3 text-[11px] text-gray-5 dark:border-stroke-dark dark:text-dark-6">
                              Logo
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-dark dark:text-dark-8">{channel.name}</div>
                            <div className="text-xs text-gray-6 dark:text-dark-6">
                              {channel.handle ? `@${channel.handle.replace("@", "")}` : "No handle set"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {channel.platform ? (
                          <span className="rounded-full bg-gray-1 px-2 py-1 text-[11px] font-semibold uppercase text-gray-7 dark:bg-dark-3 dark:text-dark-7">
                            {channel.platform}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-7 dark:text-dark-7">
                        {channel.tone || "—"} {channel.style ? `· ${channel.style}` : ""}
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-gray-7 dark:text-dark-7">
                        {channel.audience || "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-2"
                            onClick={() => setDetailRow(channel)}
                            disabled={saving}
                          >
                            Detail
                          </button>
                          <button
                            className="rounded-md border border-gray-3 px-3 py-2 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-2"
                            onClick={() => openEdit(channel)}
                            disabled={saving}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                            onClick={() => setDeleteRow(channel)}
                            disabled={saving}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-7 dark:text-dark-7">
              <div>
                Showing {pagedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{" "}
                {pagedRows.length === 0 ? 0 : Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-md border border-gray-3 px-3 py-1 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 disabled:opacity-60 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                >
                  Previous
                </button>
                <span className="text-xs text-gray-6 dark:text-dark-6">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  className="rounded-md border border-gray-3 px-3 py-1 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 disabled:opacity-60 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={currentPage >= pageCount}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <ModalPortal>
          <div className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12" role="dialog" aria-modal="true">
            <div className="mt-4 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:bg-dark-2 dark:border dark:border-stroke-dark">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Channel</p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">{editingId ? "Edit channel" : "New channel"}</h2>
                  <p className="text-sm text-gray-6 dark:text-dark-6">Set defaults for platform, tone, style, and CTA.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Name</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(Channel name)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Chota Bheem Fun Shorts"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Platform</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(youtube, instagram, tiktok)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.platform}
                    onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
                  >
                    {platformOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Handle / URL</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(@handle or full URL)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="@channel_handle or full URL"
                    value={form.handle}
                    onChange={(e) => setForm((prev) => ({ ...prev, handle: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Persona ID (optional)</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(persona UUID)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="persona UUID"
                    value={form.personaId}
                    onChange={(e) => setForm((prev) => ({ ...prev, personaId: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Tone</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(funny, motivational, etc.)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.tone}
                    onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
                  >
                    <option value="">Select tone</option>
                    {toneOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Style</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(cartoon, cinematic, fast-cut)</span>
                  </div>
                  <select
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.style}
                    onChange={(e) => setForm((prev) => ({ ...prev, style: e.target.value }))}
                  >
                    <option value="">Select style</option>
                    {styleOptions.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="relative block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Language</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(English, Hindi, etc.)</span>
                  </div>
                  <div className="relative mt-2">
                    <input
                      className="w-full rounded-lg border border-gray-3 bg-white px-4 pr-10 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      name="language"
                      value={languageQuery}
                      onFocus={() => setShowLanguageList(true)}
                      onClick={() => setShowLanguageList(true)}
                      onChange={(e) => {
                        const next = e.target.value;
                        setLanguageQuery(next);
                        setForm((prev) => ({ ...prev, language: next }));
                        setShowLanguageList(true);
                      }}
                      placeholder="Choose a language..."
                      autoComplete="off"
                      onBlur={() => setTimeout(() => setShowLanguageList(false), 120)}
                    />
                    <button
                      type="button"
                      aria-label="Show languages"
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        setShowLanguageList((prev) => !prev);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-gray-6 transition hover:bg-gray-2 dark:text-dark-6 dark:hover:bg-dark-4"
                    >
                      ▼
                    </button>
                  </div>
                  {showLanguageList && (
                    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-3 bg-white shadow-card-2 dark:border-stroke-dark dark:bg-dark-3">
                      {filteredLanguages.length === 0 && (
                        <div className="px-3 py-2 text-sm text-gray-6 dark:text-dark-6">No matches</div>
                      )}
                      {filteredLanguages.map((lang) => (
                        <button
                          type="button"
                          key={`${lang.code}-${lang.label}`}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-dark hover:bg-gray-1 dark:text-dark-8 dark:hover:bg-dark-4"
                          onMouseDown={(ev) => {
                            ev.preventDefault();
                            setLanguageQuery(lang.label);
                            setForm((prev) => ({ ...prev, language: lang.label }));
                            setShowLanguageList(false);
                          }}
                        >
                          <span>{lang.label}</span>
                          <span className="text-xs text-gray-5 dark:text-dark-6">{lang.code.toUpperCase()}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Topic / Universe</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(main focus)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Chota Bheem cartoon"
                    value={form.topic}
                    onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Audience</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(e.g., Kids 7–14, Hindi)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Kids 7–14, Hindi"
                    value={form.audience}
                    onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Content type</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(Cartoon / Kids)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Cartoon / Kids"
                    value={form.contentType}
                    onChange={(e) => setForm((prev) => ({ ...prev, contentType: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Posting cadence</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(daily, M/W/F, weekends)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="e.g., Daily at 5pm or M/W/F"
                    value={form.postingFrequency}
                    onChange={(e) => setForm((prev) => ({ ...prev, postingFrequency: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <span>Content style rules</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(must-follow voice/structure)</span>
                  </div>
                  <textarea
                    className="mt-2 h-20 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Hook first, then conflict, then payoff. Keep kid-friendly jokes."
                    value={form.styleRules}
                    onChange={(e) => setForm((prev) => ({ ...prev, styleRules: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <span>Visual style rules</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(colors, overlays, transitions)</span>
                  </div>
                  <textarea
                    className="mt-2 h-20 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Bright orange + purple gradients, bold subtitles, meme stickers."
                    value={form.visualStyle}
                    onChange={(e) => setForm((prev) => ({ ...prev, visualStyle: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Brand colors</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(comma separated)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="#F97316, #7C3AED"
                    value={form.brandColors}
                    onChange={(e) => setForm((prev) => ({ ...prev, brandColors: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Brand fonts</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(comma separated)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Poppins, Satoshi"
                    value={form.brandFonts}
                    onChange={(e) => setForm((prev) => ({ ...prev, brandFonts: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7 md:col-span-2">
                  <div className="flex items-center gap-2">
                    <span>End screen / template</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(optional)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="End screen prompt or URL"
                    value={form.endScreenTemplate}
                    onChange={(e) => setForm((prev) => ({ ...prev, endScreenTemplate: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Channel logo URL</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(optional)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="https://..."
                    value={form.logoUrl}
                    onChange={(e) => setForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Character name</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(optional)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Chota Bheem"
                    value={form.characterName}
                    onChange={(e) => setForm((prev) => ({ ...prev, characterName: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Character image URLs (comma separated)</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(optional)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="https://img1, https://img2"
                    value={form.characterImages}
                    onChange={(e) => setForm((prev) => ({ ...prev, characterImages: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Base hashtags (comma separated)</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(auto-add to posts)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="#chotabheem, #cartoon, #shorts, #kids"
                    value={form.baseHashtags}
                    onChange={(e) => setForm((prev) => ({ ...prev, baseHashtags: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Default CTA</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(subscribe, follow, etc.)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="Subscribe for more Chota Bheem stories"
                    value={form.ctaDefault}
                    onChange={(e) => setForm((prev) => ({ ...prev, ctaDefault: e.target.value }))}
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Default duration (seconds)</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(typical clip length)</span>
                  </div>
                  <input
                    type="number"
                    min={5}
                    max={300}
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    placeholder="30"
                    value={form.durationDefault}
                    onChange={(e) => setForm((prev) => ({ ...prev, durationDefault: e.target.value }))}
                  />
                </label>
              </div>

              <hr className="mt-6 mb-4 border-t border-gray-3 dark:border-stroke-dark" />

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  className="flex w-full items-center justify-center rounded-xl border border-gray-3 px-4 py-3 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60 sm:w-1/2"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  className="flex w-full items-center justify-center rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-1/2"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? "Saving..." : editingId ? "Update Channel" : "Create Channel"}
                </button>
              </div>
              {status.type !== "idle" && status.message && (
                <div
                  className={cn(
                    "mt-3 rounded-lg border px-3 py-2 text-sm",
                    status.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-red-200 bg-red-50 text-red-700",
                  )}
                >
                  {status.message}
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}

      {detailRow && (
        <ModalPortal>
          <div className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12" role="dialog" aria-modal="true">
            <div className="mt-4 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:bg-dark-2 dark:border dark:border-stroke-dark">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Detail</p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">{detailRow.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-6 dark:text-dark-6">
                    {detailRow.platform && (
                      <span className="rounded-full bg-gray-1 px-2 py-1 font-semibold uppercase text-gray-7 dark:bg-dark-2 dark:text-dark-7">
                        {detailRow.platform}
                      </span>
                    )}
                    {detailRow.handle && <span>@{detailRow.handle.replace("@", "")}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                >
                  Close
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2 text-sm text-gray-7 dark:text-dark-7">
                  <p><strong>Audience:</strong> {detailRow.audience || "—"}</p>
                  <p><strong>Content type:</strong> {detailRow.contentType || "—"}</p>
                  <p><strong>Topic:</strong> {detailRow.topic || "—"}</p>
                  <p><strong>Persona:</strong> {detailRow.personaId || "—"}</p>
                  <p><strong>Tone:</strong> {detailRow.tone || "—"}</p>
                  <p><strong>Style:</strong> {detailRow.style || "—"}</p>
                  <p><strong>Language:</strong> {labelForLanguage(detailRow.language) || "—"}</p>
                  <p><strong>Posting cadence:</strong> {detailRow.postingFrequency || "—"}</p>
                  <p><strong>Default duration:</strong> {detailRow.durationDefault ?? "—"} sec</p>
                  <p><strong>Style rules:</strong> {detailRow.styleRules || "—"}</p>
                  <p><strong>Visual style:</strong> {detailRow.visualStyle || "—"}</p>
                </div>
                <div className="space-y-2 text-sm text-gray-7 dark:text-dark-7">
                  <p><strong>CTA:</strong> {detailRow.ctaDefault || "—"}</p>
                  <p>
                    <strong>Base hashtags:</strong>{" "}
                    {detailRow.baseHashtags && detailRow.baseHashtags.length ? detailRow.baseHashtags.join(", ") : "—"}
                  </p>
                  <p>
                    <strong>Brand colors:</strong>{" "}
                    {detailRow.brandColors && detailRow.brandColors.length ? detailRow.brandColors.join(", ") : "—"}
                  </p>
                  <p>
                    <strong>Brand fonts:</strong>{" "}
                    {detailRow.brandFonts && detailRow.brandFonts.length ? detailRow.brandFonts.join(", ") : "—"}
                  </p>
                  <p><strong>End screen:</strong> {detailRow.endScreenTemplate || "—"}</p>
                  <p><strong>Character:</strong> {detailRow.characterName || "—"}</p>
                  {detailRow.characterImages && detailRow.characterImages.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {detailRow.characterImages.map((url, idx) => (
                        <img
                          key={`${detailRow.id}-detail-char-${idx}`}
                          src={url}
                          alt="Character"
                          className="h-12 w-12 rounded-md border border-gray-3 object-cover dark:border-stroke-dark"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {deleteRow && (
        <ModalPortal>
          <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Delete</p>
                  <h3 className="text-lg font-bold text-dark dark:text-dark-8">Delete channel?</h3>
                  <p className="mt-2 text-sm text-gray-6 dark:text-dark-6">
                    This will remove <strong>{deleteRow.name}</strong>. Existing reels remain but will no longer be linked.
                  </p>
                </div>
                <button
                  onClick={() => setDeleteRow(null)}
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                >
                  Close
                </button>
              </div>
              <button
                className="mt-2 w-full rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? "Deleting..." : "Delete"}
              </button>
              {status.type === "error" && status.message && (
                <div className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{status.message}</div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
