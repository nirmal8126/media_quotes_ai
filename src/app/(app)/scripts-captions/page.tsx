"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import type {
  ContentType,
  LengthPreset,
  Platform,
  ToneStyle,
} from "@/types/generation";
import { IntegrityPanel } from "@/components/IntegrityPanel";
import type { IntegrityFix, IntegrityReport } from "@/lib/integrity/types";
import {
  labelForLanguage,
  languageOptions,
  resolveLanguageCode,
} from "@/lib/languages";

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

type ScriptRow = {
  id: string;
  topic: string;
  tone: string | null;
  platform: string | null;
  hook: string | null;
  script: string | null;
  caption: string | null;
  hashtags?: string[] | null;
  created_at: string;
  variationIndex?: number;
  language?: string | null;
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

type IntegrityState = {
  report: IntegrityReport | null;
  status: "idle" | "loading" | "error";
  message?: string;
};

const contentTypes: ContentType[] = ["short_script", "long_script", "caption"];
const platformOptions: Platform[] = ["instagram_reels", "youtube_shorts", "tiktok", "facebook_reels"];
const toneOptions: ToneStyle[] = ["informative", "motivational", "funny", "poetic", "emotional", "business", "default"];
const durationOptions = [10, 15, 20, 30, 45, 60];
const audienceOptions = ["kids", "teens", "general", "professionals"];
const goalOptions = ["educate", "motivate", "entertain", "sell", "story"];
const ctaOptions = ["follow", "subscribe", "comment", "save", "none"];
const hookStyles = ["question", "bold statement", "story", "problem-solution"];
const seedModes: Array<"generate" | "improve" | "rewrite" | "shorten" | "expand"> = [
  "generate",
  "improve",
  "rewrite",
  "shorten",
  "expand",
];

const defaultForm = {
  description: "",
  contentType: "short_script" as ContentType,
  platform: "instagram_reels" as Platform,
  tone: "informative" as ToneStyle,
  length: "medium" as LengthPreset,
  durationSec: 30,
  pace: "normal" as "slow" | "normal" | "fast",
  audience: "",
  goal: "educate",
  cta: "follow",
  hookStyle: "",
  persona: "",
  language: labelForLanguage("en") || "English",
  hook: "",
  script: "",
  caption: "",
  mustInclude: "",
  mustAvoid: "",
  mode: "generate" as "generate" | "improve" | "rewrite" | "shorten" | "expand",
};

const initialIntegrity: IntegrityState = { report: null, status: "idle" };

export default function ScriptsCaptionsPage() {
  const [rows, setRows] = useState<ScriptRow[]>([]);
  const [integrityCache, setIntegrityCache] = useState<Record<string, IntegrityReport | null>>({});
  const integrityInFlight = useRef<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ ...defaultForm });
  const [languageQuery, setLanguageQuery] = useState(labelForLanguage(defaultForm.language) || "");
  const [showLanguageList, setShowLanguageList] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [detailRow, setDetailRow] = useState<ScriptRow | null>(null);
  const [editRow, setEditRow] = useState<ScriptRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<ScriptRow | null>(null);
  const [generatedRows, setGeneratedRows] = useState<ScriptRow[]>([]);
  const [deleteStatus, setDeleteStatus] = useState<Status>({ type: "idle" });
  const [submitStatus, setSubmitStatus] = useState<Status>({ type: "idle" });
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [plannerBusyId, setPlannerBusyId] = useState<string | null>(null);
  const topicInputRef = useRef<HTMLInputElement | null>(null);
  const [integrityState, setIntegrityState] = useState<IntegrityState>(initialIntegrity);
  const [integrityGate, setIntegrityGate] = useState<{ open: boolean; pending?: () => void }>({ open: false });

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

  useEffect(() => {
    const fetchRows = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/scripts-captions/history", {
          cache: "no-store",
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Unable to load scripts/captions.");
        }
        const items: ScriptRow[] = (body.items ?? []).map((item: any) => ({
          id: item.id,
          topic: item.topic ?? item.thumbnail_prompt ?? "Untitled",
          tone: item.tone ?? null,
          platform: item.platform ?? null,
          hook: item.hook ?? null,
          script: item.script ?? null,
          caption: item.caption ?? null,
          hashtags: item.hashtags ?? [],
          language: item.language ?? null,
          created_at: item.created_at,
        }));
        setRows(items);
      } catch (err) {
        setError((err as Error).message || "Unable to load scripts/captions.");
      } finally {
        setLoading(false);
      }
    };
    fetchRows();
  }, []);

  useEffect(() => {
    if (showModal && topicInputRef.current) {
      topicInputRef.current.focus();
      topicInputRef.current.select();
    }
  }, [showModal, editRow]);

  const pushToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setToast({ type, message });
    setTimeout(
      () => setToast((prev) => (prev?.message === message ? null : prev)),
      1500
    );
  };

  const integrityBlocking = integrityState.report && (integrityState.report.status === "warn" || integrityState.report.status === "risk");

  const copyToClipboard = async (text: string, label: string) => {
    const run = async () => {
      try {
        await navigator.clipboard.writeText(text);
        pushToast(`${label} copied`);
      } catch (err) {
        console.error("Failed to copy", err);
        pushToast(`Could not copy ${label}`, "error");
      }
    };
    const status = integrityState.report?.status;
    if (!status || status === "safe") {
      await run();
      return;
    }
    setIntegrityGate({ open: true, pending: () => void run() });
  };

  const addToPlanner = async (row: ScriptRow) => {
    setPlannerBusyId(row.id);
    try {
      const res = await fetch("/api/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reelId: row.id,
          platform: row.platform ?? "instagram",
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to add to planner");
      }
      if (body?.warning) {
        pushToast(body.warning, "error");
      } else {
        pushToast("Added to planner");
      }
    } catch (err) {
      console.error("Planner add failed", err);
      pushToast((err as Error).message || "Could not add to planner", "error");
    } finally {
      setPlannerBusyId((prev) => (prev === row.id ? null : prev));
    }
  };

  const resetForm = () => {
    setForm({ ...defaultForm });
    setLanguageQuery(labelForLanguage(defaultForm.language) || "");
    setShowLanguageList(false);
    setSubmitStatus({ type: "idle" });
    setEditRow(null);
    setShowModal(false);
  };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.topic,
        row.tone,
        row.platform,
        row.hook,
        row.script,
        row.caption,
        row.language,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search]);

  const activeIntegrityRow = detailRow || null;

  const integrityText = useMemo(() => {
    if (!activeIntegrityRow) return "";
    return [activeIntegrityRow.hook, activeIntegrityRow.script, activeIntegrityRow.caption].filter(Boolean).join(" ");
  }, [activeIntegrityRow]);

  const computeIntegrity = useCallback(
    async (text: string, row?: ScriptRow | null, opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setIntegrityState((prev) => ({ report: prev.report, status: "loading" }));
      }
      try {
        const contentId = row?.id || "temp";
        const res = await fetch(`/api/content/script/${encodeURIComponent(contentId)}/integrity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "script",
            textContent: text,
            previousTexts: rows
              .filter((r) => !row || r.id !== row.id)
              .map((r) => [r.hook, r.script, r.caption].filter(Boolean).join(" ")),
            generatedCount: rows.length,
            metadata: { userEdited: true },
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || "Integrity check failed");
        if (!opts?.silent) {
          setIntegrityState({ report: body.report ?? null, status: "idle" });
        }
        if (row?.id) {
          setIntegrityCache((prev) => ({ ...prev, [row.id]: body.report ?? null }));
        }
      } catch (err) {
        if (!opts?.silent) {
          setIntegrityState({ report: null, status: "error", message: (err as Error).message });
        }
      }
    },
    [rows],
  );

  useEffect(() => {
    if (integrityText) {
      void computeIntegrity(integrityText, activeIntegrityRow);
    }
  }, [integrityText, computeIntegrity, activeIntegrityRow]);

  useEffect(() => {
    if (!activeIntegrityRow) {
      setIntegrityState(initialIntegrity);
    }
  }, [activeIntegrityRow]);

  const inlineIntegrityBadge = (report: IntegrityReport | null | undefined) => {
    if (!report) return null;
    const base =
      report.status === "risk"
        ? "bg-red-100 text-red-700 border-red-200 border"
        : report.status === "warn"
          ? "bg-amber-100 text-amber-700 border-amber-200 border"
          : "bg-green-100 text-green-700 border-green-200 border";
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase shadow-sm",
          base,
        )}
      >
        <span>{report.status}</span>
        <span className="text-[10px] font-bold opacity-80">{report.score ?? 0}/100</span>
      </span>
    );
  };

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Background check for visible rows (first page slice)
  useEffect(() => {
    const rowsToCheck = pagedRows.slice(0, 5);
    rowsToCheck.forEach((row) => {
      if (!row.id) return;
      if (integrityCache[row.id] !== undefined) return;
      if (integrityInFlight.current.has(row.id)) return;
      const text = [row.hook, row.script, row.caption].filter(Boolean).join(" ");
      if (!text) return;
      integrityInFlight.current.add(row.id);
      void computeIntegrity(text, row, { silent: true }).finally(() => {
        integrityInFlight.current.delete(row.id);
      });
    });
  }, [pagedRows, integrityCache, computeIntegrity]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, search, rows.length]);

  const handleSubmit = async () => {
    if (submitStatus.type === "loading") return;
    const description = form.description.trim();
    if (!description) {
      setSubmitStatus({ type: "error", message: "Description is required." });
      return;
    }
    const resolvedLanguage = resolveLanguageCode(form.language || "");
    setSubmitStatus({
      type: "loading",
      message: editRow ? "Saving..." : "Generating...",
    });
    try {
      if (editRow) {
        const res = await fetch("/api/scripts-captions/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editRow.id,
            description,
            topic: description,
            tone: form.tone,
            platform: form.platform,
            hook: form.hook || null,
            script: form.mode === "generate" ? null : (form.script || null),
            caption: form.mode === "generate" ? null : (form.caption || null),
            length: form.length,
            pace: form.pace,
            contentType: form.contentType,
            persona: form.persona || null,
            language: resolvedLanguage || null,
            regenerate: false,
            durationSec: form.durationSec,
            audience: form.audience,
            goal: form.goal,
            cta: form.cta,
            hookStyle: form.hookStyle,
            mustInclude: form.mustInclude,
            mustAvoid: form.mustAvoid,
            mode: form.mode,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Failed to update.");
        }
        const updated: ScriptRow = {
          id: body.item?.id ?? editRow.id,
          topic: body.item?.topic ?? description,
          tone: body.item?.tone ?? form.tone,
          platform: body.item?.platform ?? form.platform,
          hook: body.item?.hook ?? form.hook,
          script: body.item?.script ?? form.script,
          caption: body.item?.caption ?? form.caption,
          hashtags: body.item?.hashtags ?? editRow.hashtags ?? [],
          created_at: body.item?.created_at ?? editRow.created_at,
        };
        setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        pushToast("Updated.");
      } else {
        const sendSeeds = form.mode !== "generate";
        const res = await fetch("/api/scripts-captions/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            topic: description,
            contentType: form.contentType,
            platform: form.platform,
            tone: form.tone,
            length: form.length,
            pace: form.pace,
            persona: form.persona || null,
            language: resolvedLanguage || null,
            hook: form.hook || null,
            variations: 3,
            script: sendSeeds ? form.script || undefined : null,
            caption: sendSeeds ? form.caption || undefined : null,
            durationSec: form.durationSec,
            audience: form.audience,
            goal: form.goal,
            cta: form.cta,
            hookStyle: form.hookStyle,
            mustInclude: form.mustInclude,
            mustAvoid: form.mustAvoid,
            mode: form.mode,
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Failed to generate.");
        }
        const variants = Array.isArray(body.variations) ? body.variations : [];
        const created = variants.map((v: any, idx: number) => ({
          id: v.id ?? `local-${Date.now()}-${idx}`,
          topic: v.topic ?? description,
          tone: v.tone ?? form.tone,
          platform: v.platform ?? form.platform,
          hook: v.hook ?? form.hook,
          script: v.script ?? null,
          caption: v.caption ?? null,
          hashtags: v.hashtags ?? [],
          created_at: v.created_at ?? new Date().toISOString(),
          variationIndex: idx + 1,
        }));
        setGeneratedRows(created);
        setRows((prev) => [...created, ...prev]);
        pushToast("Generated.");
      }
      resetForm();
    } catch (err) {
      setSubmitStatus({
        type: "error",
        message: (err as Error).message || "Unable to save.",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleteStatus({ type: "loading", message: "Deleting..." });
    try {
      const res = await fetch(
        `/api/scripts-captions/delete?id=${encodeURIComponent(deleteRow.id)}`,
        { method: "DELETE" }
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to delete.");
      }
      setRows((prev) => prev.filter((r) => r.id !== deleteRow.id));
      setDeleteStatus({ type: "success", message: "Deleted." });
      setDeleteRow(null);
    } catch (err) {
      setDeleteStatus({
        type: "error",
        message: (err as Error).message || "Unable to delete.",
      });
    }
  };

  return (
      <div className="space-y-4">
        {toast && (
          <div
            className={cn(
              "fixed right-4 top-4 z-30 rounded-md px-4 py-3 text-sm font-semibold shadow-lg",
            toast.type === "success"
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          )}
        >
          {toast.message}
          </div>
        )}

        {integrityGate.open && integrityBlocking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-lg rounded-xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-gray-900">
              <h3 className="text-lg font-semibold text-dark dark:text-white">Content Integrity</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Status: {integrityState.report?.status.toUpperCase()}
              </p>
              <div className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-200">
                {(integrityState.report?.issues || []).map((issue) => (
                  <div key={`${issue.code}-${issue.message}`} className="flex gap-2">
                    <span className="text-xs font-semibold uppercase text-gray-500 dark:text-gray-400">{issue.code}</span>
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setIntegrityGate({ open: false })}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-800 hover:border-primary hover:text-primary dark:border-white/10 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (integrityGate.pending) integrityGate.pending();
                    setIntegrityGate({ open: false });
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90"
                >
                  Proceed anyway
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
              Scripts & Captions
            </p>
            <h1 className="text-2xl font-bold text-dark dark:text-dark-8">
              Generated scripts
            </h1>
            <p className="text-sm text-gray-6 dark:text-dark-6">
              View your recent scripts/captions and create new ones.
            </p>
          </div>
          <button
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
          onClick={() => {
            setForm({ ...defaultForm });
            setEditRow(null);
            setShowModal(true);
            setSubmitStatus({ type: "idle" });
          }}
        >
          + Generate Script
          </button>
        </div>

        <div className="mt-3">
          {activeIntegrityRow && (
            <IntegrityPanel
              report={integrityState.report}
              loading={integrityState.status === "loading"}
              error={integrityState.status === "error" ? integrityState.message : null}
              onRefresh={() => integrityText && computeIntegrity(integrityText, activeIntegrityRow)}
              onFix={(fix: IntegrityFix) => {
                setToast({ type: "success", message: `Fix: ${fix.label}` });
                if (integrityText) {
                  void computeIntegrity(integrityText, activeIntegrityRow);
                }
              }}
            />
          )}
        </div>

        {/* Removed variation cards to reduce duplication; the table below shows latest items */}
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        {loading ? (
          <div className="py-10 text-center text-gray-6 dark:text-dark-6">
            Loading quotes...
          </div>
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
                  Search{" "}
                  <span className="font-normal">(topic, tone, persona)</span>
                </div>
                <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search (topic, tone, persona)"
                    className="h-10 w-56 rounded-lg border border-gray-3 bg-white px-3 pl-9 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    aria-label="Search quotes by topic, tone, or persona"
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-5">
                    🔍
                  </span>
                </div>
              </div>
            </div>

            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-6">
                <tr>
                  <th className="px-4 py-3">Script</th>
                  <th className="px-4 py-3">Tone</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-6">
                      Loading...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-red-600">
                      {error}
                    </td>
                  </tr>
                ) : pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-gray-6">
                      No scripts/captions found for your search.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-gray-1/60 dark:hover:bg-dark-3">
                      <td className="px-4 py-3 text-sm text-gray-7 dark:text-dark-7 align-middle">
                        <div className="line-clamp-2 font-medium text-dark dark:text-dark-8">
                          {row.script && row.script.length > 70 ? `${row.script.slice(0, 70)}…` : row.script || "—"}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
                            {row.hook ? "Hook" : "No hook"}
                          </span>
                          <span className="rounded-full bg-gray-2 px-3 py-1 text-gray-7 dark:bg-dark-3 dark:text-dark-7">
                            {row.caption ? "Has caption" : "No caption"}
                          </span>
                          <span className="rounded-full bg-gray-2 px-3 py-1 text-gray-7 dark:bg-dark-3 dark:text-dark-7">
                            {row.hashtags && row.hashtags.length ? `${row.hashtags.length} tags` : "0 tags"}
                          </span>
                          {inlineIntegrityBadge(integrityCache[row.id]) || (
                            <span className="rounded-full bg-gray-2 px-3 py-1 text-gray-5 dark:bg-dark-3">Not checked</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-7 dark:text-dark-7">
                        {row.tone || "—"}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-7 dark:text-dark-7">
                        {row.platform || "—"}
                      </td>
                      <td className="px-4 py-3 align-middle text-gray-6 dark:text-dark-6 whitespace-nowrap">
                        {row.created_at
                          ? new Date(row.created_at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                          <button
                            className="rounded-md border border-gray-3 px-3 py-1 text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                            onClick={() => setDetailRow(row)}
                          >
                            Detail
                          </button>
                          <button
                            className="rounded-md border border-gray-3 px-3 py-1 text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                            onClick={() => {
                              setEditRow(row);
                              setForm((prev) => {
                                const resolved = resolveLanguageCode(row.language || prev.language || defaultForm.language);
                                const langLabel = labelForLanguage(resolved) || resolved;
                                return {
                                  ...defaultForm,
                                  contentType: prev.contentType,
                                  durationSec: prev.durationSec,
                                  goal: prev.goal,
                                  tone: (row.tone as ToneStyle) || prev.tone,
                                  platform: (row.platform as Platform) || "instagram_reels",
                                  description: row.topic || "",
                                  audience: prev.audience,
                                  cta: prev.cta,
                                  hookStyle: prev.hookStyle,
                                  persona: prev.persona,
                                  language: langLabel,
                                  hook: row.hook || "",
                                  script: row.script || "",
                                  caption: row.caption || "",
                                  mode: prev.mode,
                                };
                              });
                              setLanguageQuery(labelForLanguage(row.language || defaultForm.language) || "");
                              setShowLanguageList(false);
                              setShowModal(true);
                              setSubmitStatus({ type: "idle" });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-md border border-red-200 px-3 py-1 text-red-600 transition hover:bg-red-50 dark:border-red-400/40 dark:hover:bg-red-500/10"
                            onClick={() => {
                              setDeleteStatus({ type: "idle" });
                              setDeleteRow(row);
                            }}
                          >
                            Delete
                          </button>
                          <button
                            className="rounded-md border border-gray-3 px-3 py-1 text-gray-7 transition hover:bg-gray-1 disabled:opacity-60 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                            onClick={() => addToPlanner(row)}
                            disabled={plannerBusyId === row.id}
                          >
                            {plannerBusyId === row.id ? "Adding..." : "Add to Planner"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-6 dark:text-dark-6">
              <div>
                Showing{" "}
                <span className="font-semibold text-dark dark:text-dark-8">
                  {filteredRows.length === 0
                    ? 0
                    : (currentPage - 1) * pageSize + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-dark dark:text-dark-8">
                  {filteredRows.length === 0
                    ? 0
                    : Math.min(currentPage * pageSize, filteredRows.length)}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-dark dark:text-dark-8">
                  {filteredRows.length}
                </span>{" "}
                entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || filteredRows.length === 0}
                  className="min-w-[88px] rounded-lg border border-gray-3 px-3 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                >
                  Previous
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: pageCount }).map((_, idx) => {
                    const p = idx + 1;
                    const isActive = p === currentPage;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        disabled={filteredRows.length === 0}
                        className={cn(
                          "h-10 w-10 rounded-lg border text-sm font-semibold transition",
                          isActive
                            ? "border-primary bg-primary text-white"
                            : "border-gray-3 bg-white text-gray-7 hover:bg-gray-1 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-2",
                          filteredRows.length === 0 &&
                            "cursor-not-allowed opacity-60"
                        )}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  disabled={
                    currentPage === pageCount || filteredRows.length === 0
                  }
                  className="min-w-[88px] rounded-lg border border-gray-3 px-3 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 disabled:cursor-not-allowed disabled:opacity-60 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
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
          <div className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12 backdrop-blur-sm">
            <div className="mt-4 max-h-[85vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:bg-dark-2 dark:border dark:border-stroke-dark">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Generate</p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">
                    {editRow ? "Edit script/caption" : "New script/caption"}
                  </h2>
                </div>
                <button
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                  onClick={resetForm}
                >
                  Close
                </button>
              </div>

              <div className="mt-4 space-y-5">
                <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                  Description / Topic *
                  <input
                    ref={topicInputRef}
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="E.g., why waking up early improves focus"
                  />
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    {[
                      "Self discipline for students",
                      "Kids moral story: honesty",
                      "Fitness myth: fat loss",
                      "Business tip: productivity",
                    ].map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, description: chip }))}
                        className="rounded-full bg-gray-2 px-3 py-1 font-semibold text-gray-7 transition hover:bg-gray-1 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    Content type *
                    <select
                      className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      value={form.contentType}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          contentType: e.target.value as ContentType,
                        }))
                      }
                    >
                      {contentTypes.map((type) => (
                        <option key={type} value={type}>
                          {type === "short_script"
                            ? "Short script"
                            : type === "long_script"
                              ? "Long script"
                              : "Caption only"}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    Platform *
                    <select
                      className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      value={form.platform}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          platform: e.target.value as Platform,
                        }))
                      }
                    >
                      {platformOptions.map((p) => (
                        <option key={p} value={p}>
                          {p.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    Goal *
                    <select
                      className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      value={form.goal}
                      onChange={(e) => setForm((prev) => ({ ...prev, goal: e.target.value }))}
                    >
                      {goalOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    Tone / Style *
                    <select
                      className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      value={form.tone}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          tone: e.target.value as ToneStyle,
                        }))
                      }
                    >
                      {toneOptions.map((tone) => (
                        <option key={tone} value={tone}>
                          {tone}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    Duration (seconds) *
                    <select
                      className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      value={form.durationSec}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          durationSec: Number(e.target.value) || 30,
                        }))
                      }
                    >
                      {durationOptions.map((d) => (
                        <option key={d} value={d}>
                          {d}s
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    Language *
                    <div className="relative mt-2">
                      <input
                        className="w-full rounded-lg border border-gray-3 bg-white px-4 pr-10 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
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
                        onBlur={() => {
                          setTimeout(() => setShowLanguageList(false), 120);
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Show languages"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setShowLanguageList((prev) => !prev);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md text-gray-6 transition hover:bg-gray-2 dark:text-dark-6 dark:hover:bg-dark-4"
                      >
                        v
                      </button>
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
                              onMouseDown={(e) => {
                                e.preventDefault();
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
                    </div>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    Hook style (optional)
                    <select
                      className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      value={form.hookStyle}
                      onChange={(e) => setForm((prev) => ({ ...prev, hookStyle: e.target.value }))}
                    >
                      <option value="">Select a style</option>
                      {hookStyles.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    Audience (optional)
                    <select
                      className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      value={form.audience}
                      onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))}
                    >
                      <option value="">Select audience</option>
                      {audienceOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    Persona / Voice (optional)
                    <input
                      className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      value={form.persona}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, persona: e.target.value }))
                      }
                      placeholder="Friendly storyteller / Calm mentor / High-energy creator"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                    CTA (optional)
                    <select
                      className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                      value={form.cta}
                      onChange={(e) => setForm((prev) => ({ ...prev, cta: e.target.value }))}
                    >
                      {ctaOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <details className="rounded-xl border border-gray-3 bg-gray-1/40 p-4 dark:border-stroke-dark dark:bg-dark-3/60">
                  <summary className="cursor-pointer text-sm font-semibold text-dark dark:text-dark-8">
                    Advanced
                  </summary>
                  <div className="mt-3 space-y-4">
                    <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                      Seed mode
                      <select
                        className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                        value={form.mode}
                        onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value as typeof form.mode }))}
                      >
                        {seedModes.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt === "generate" ? "Generate new" : opt}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                        Script seed (optional)
                        <textarea
                          className="mt-2 h-32 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                          value={form.script}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, script: e.target.value }))
                          }
                          placeholder="Paste or tweak your script..."
                        />
                      </label>
                      <label className="block text-sm font-semibold text-dark dark:text-dark-8">
                        Caption seed (optional)
                        <textarea
                          className="mt-2 h-32 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                          value={form.caption}
                          onChange={(e) =>
                            setForm((prev) => ({ ...prev, caption: e.target.value }))
                          }
                          placeholder="Add or edit the caption..."
                        />
                      </label>
                    </div>
                  </div>
                </details>
              </div>

              {submitStatus.type !== "idle" && (
                <div
                  className={cn(
                    "mt-3 rounded-lg border px-4 py-3 text-sm",
                    submitStatus.type === "error"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : submitStatus.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700"
                      : "border-stroke bg-gray-1 text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                  )}
                >
                  {submitStatus.message}
                </div>
              )}

                <hr className="mt-6 mb-4 border-t border-gray-3 dark:border-stroke-dark" />

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    className="flex w-full items-center justify-center rounded-xl border border-gray-3 px-4 py-3 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60 sm:w-1/2"
                    onClick={() => {
                      setShowModal(false);
                      setSubmitStatus({ type: "idle" });
                      setForm({ ...defaultForm });
                      setLanguageQuery(labelForLanguage(defaultForm.language) || "");
                      setShowLanguageList(false);
                      setEditRow(null);
                    }}
                    disabled={submitStatus.type === "loading"}
                  >
                    Cancel
                  </button>
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-1/2"
                    onClick={handleSubmit}
                    disabled={submitStatus.type === "loading"}
                  >
                    {submitStatus.type === "loading"
                      ? editRow
                        ? "Saving..."
                        : "Generating..."
                      : editRow
                      ? "Save changes"
                      : "Generate Script"}
                    {submitStatus.type === "loading" && (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                  </button>
                </div>

            </div>
          </div>
        </ModalPortal>
      )}

      {detailRow && (
        <ModalPortal>
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4 py-10 backdrop-blur-sm">
            <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl dark:border dark:border-stroke-dark dark:bg-dark-2 dark:shadow-black/40">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Script & Caption</p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">{detailRow.topic || "Details"}</h2>
                  <p className="text-sm text-gray-6 dark:text-dark-6">
                    Tone: {detailRow.tone || "—"} · Platform: {detailRow.platform || "—"} · Hook: {detailRow.hook || "—"}
                  </p>
                </div>
                <button
                  className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                  onClick={() => setDetailRow(null)}
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-lg border border-gray-3 bg-gray-1 p-4 dark:border-stroke-dark dark:bg-dark-3">
                  <p className="text-xs font-semibold uppercase text-gray-6 dark:text-dark-6">Script</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-dark dark:text-dark-8">{detailRow.script || "—"}</p>
                </div>
                <div className="rounded-lg border border-gray-3 bg-gray-1 p-4 dark:border-stroke-dark dark:bg-dark-3">
                  <p className="text-xs font-semibold uppercase text-gray-6 dark:text-dark-6">Caption</p>
                  <p className="mt-2 whitespace-pre-line text-sm text-dark dark:text-dark-8">{detailRow.caption || "—"}</p>
                </div>
                {detailRow.hashtags && detailRow.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {detailRow.hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase text-primary dark:bg-primary/20"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {deleteRow && (
        <ModalPortal>
          <div className="fixed inset-0 z-[12000] flex items-center justify-center bg-black/60 px-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:border dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="text-lg font-bold text-dark dark:text-dark-8">Delete script/caption</h3>
              <p className="mt-2 text-sm text-gray-6 dark:text-dark-6">This cannot be undone.</p>
              {deleteStatus.type === "error" && (
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                  {deleteStatus.message}
                </p>
              )}
              <div className="mt-4 flex justify-end gap-3">
                <button
                  className="rounded-md border border-gray-3 px-4 py-2 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                  onClick={() => setDeleteRow(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                  onClick={handleDelete}
                  disabled={deleteStatus.type === "loading"}
                >
                  {deleteStatus.type === "loading" ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
