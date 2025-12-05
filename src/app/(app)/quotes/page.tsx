"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

function ModalPortal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}

const CopyIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className ?? "h-4 w-4"}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className ?? "h-4 w-4"}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

type QuoteRow = {
  id: string;
  topic?: string | null;
  persona: string | null;
  tone: string | null;
  language: string | null;
  style: string | null;
  hook?: string | null;
  word_limit?: number | null;
  quotes: string[];
  created_at: string;
};

type Status =
  | { type: "idle"; message?: string }
  | { type: "loading"; message?: string }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

const defaultForm = {
  topic: "",
  tone: "motivational",
  persona: "",
  language: "",
  style: "",
  count: 5,
  wordLimit: 40,
  hook: "",
};

const languageOptions = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "pa", label: "Punjabi" },
  { code: "bn", label: "Bengali" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "mr", label: "Marathi" },
  { code: "gu", label: "Gujarati" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "or", label: "Odia" },
  { code: "as", label: "Assamese" },
  { code: "ur", label: "Urdu" },
  { code: "mai", label: "Maithili" },
  { code: "sat", label: "Santali" },
  { code: "ks", label: "Kashmiri" },
  { code: "ne", label: "Nepali" },
  { code: "sa", label: "Sanskrit" },
  { code: "sd", label: "Sindhi" },
  { code: "kok", label: "Konkani" },
  { code: "mni", label: "Manipuri" },
  { code: "brx", label: "Bodo" },
  { code: "doi", label: "Dogri" },
];

function resolveLanguageCode(input: string) {
  const normalized = input.trim().toLowerCase();
  if (!normalized || normalized === "choose a language...") return "en";
  const direct = languageOptions.find((lang) => lang.code.toLowerCase() === normalized);
  if (direct) return direct.code;
  const byLabel = languageOptions.find((lang) => lang.label.toLowerCase() === normalized);
  return byLabel?.code ?? "en";
}

function labelForLanguage(input?: string | null) {
  if (!input) return "";
  const normalized = input.trim().toLowerCase();
  const found = languageOptions.find(
    (lang) => lang.code.toLowerCase() === normalized || lang.label.toLowerCase() === normalized,
  );
  return found?.label ?? input;
}

const normalizeQuote = (input: unknown) => {
  if (typeof input !== "string") return "";
  let text = input
    .replace(/```[\w-]*\s*/gi, "")
    .replace(/^\s*\[\s*|\s*\]\s*$/g, "")
    .replace(/^[\d]+\.\s*/, "")
    .replace(/^[-–]\s*/, "")
    .trim();
  text = text.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();
  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "json") return "";
  if (text === "[" || text === "]") return "";
  return text;
};

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });
  const [submitStatus, setSubmitStatus] = useState<Status>({ type: "idle" });
  const [detailRow, setDetailRow] = useState<QuoteRow | null>(null);
  const [editRow, setEditRow] = useState<QuoteRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<QuoteRow | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<Status>({ type: "idle" });
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [languageQuery, setLanguageQuery] = useState(labelForLanguage(defaultForm.language));
  const [showLanguageList, setShowLanguageList] = useState(false);
  const topicInputRef = useRef<HTMLInputElement | null>(null);
  const anyModalOpen = showModal || Boolean(detailRow) || Boolean(deleteRow);

  useEffect(() => {
    if (anyModalOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [anyModalOpen]);

  useEffect(() => {
    if (showModal && topicInputRef.current) {
      topicInputRef.current.focus();
      topicInputRef.current.select();
    }
  }, [showModal, editRow]);

  useEffect(() => {
    const fetchQuotes = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/quotes/history", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Unable to load quotes.");
        }
        setQuotes(body.quotes || []);
      } catch (err) {
        setError((err as Error).message || "Unable to load quotes.");
      } finally {
        setLoading(false);
      }
    };
    fetchQuotes();
  }, []);

  const rows = useMemo(() => quotes ?? [], [quotes]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const haystack = [
        row.topic,
        row.tone,
        row.persona,
        row.language,
        row.style,
        row.quotes?.[0],
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [rows, search]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, search]);

  const filteredLanguages = useMemo(() => {
    const term = (languageQuery || "").trim().toLowerCase();
    if (!term || term === "choose a language...") return languageOptions;
    return languageOptions.filter(
      (lang) => lang.label.toLowerCase().includes(term) || lang.code.toLowerCase().includes(term),
    );
  }, [languageQuery]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitStatus.type === "loading") return;

    const trimmedTopic = form.topic.trim();
    const trimmedHook = form.hook.trim();
    if (!trimmedTopic) {
      setSubmitStatus({ type: "error", message: "Topic is required." });
      return;
    }
    const resolvedLanguage = resolveLanguageCode(form.language || "");
    const safeCount = Math.max(1, Math.min(Number(form.count) || 1, 5));
    const safeWordLimit = Number.isFinite(Number(form.wordLimit))
      ? Math.max(4, Math.min(Number(form.wordLimit), 100))
      : undefined;

    setSubmitStatus({ type: "loading", message: "Generating quotes..." });
    try {
      const res = await fetch("/api/quotes/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          topic: trimmedTopic,
          tone: form.tone || null,
          persona: form.persona.trim() || null,
          language: resolvedLanguage || "en",
          style: form.style.trim() || null,
          count: safeCount,
          wordLimit: safeWordLimit,
          hook: trimmedHook || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to generate quotes.");
      }
        setQuotes((prev) => [
          {
            id: body.packId || `local-${Date.now()}`,
            topic: form.topic || null,
            persona: form.persona || null,
            tone: form.tone || null,
            language: form.language || null,
            style: form.style || null,
            hook: trimmedHook || null,
            word_limit: safeWordLimit ?? null,
            quotes: body.quotes || [],
            created_at: new Date().toISOString(),
          },
          ...prev,
        ]);
      setSubmitStatus({ type: "success", message: "Quotes generated." });
      setForm({ ...defaultForm });
      setLanguageQuery(labelForLanguage(defaultForm.language));
      setShowModal(false);
    } catch (err) {
      setSubmitStatus({
        type: "error",
        message: (err as Error).message || "Unable to generate quotes.",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleteStatus({ type: "loading", message: "Deleting..." });
    try {
      const res = await fetch(`/api/quotes/delete?id=${encodeURIComponent(deleteRow.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to delete quote pack.");
      }
      setQuotes((prev) => prev.filter((q) => q.id !== deleteRow.id));
      setDeleteStatus({ type: "success", message: "Deleted." });
      setDeleteRow(null);
    } catch (err) {
      setDeleteStatus({
        type: "error",
        message: (err as Error).message || "Unable to delete.",
      });
    }
  };

  const handleUpdate = async () => {
    if (!editRow) return;
    const trimmedTopic = form.topic.trim();
    const trimmedHook = form.hook.trim();
    if (!trimmedTopic) {
      setSubmitStatus({ type: "error", message: "Topic is required." });
      return;
    }
    const resolvedLanguage = resolveLanguageCode(form.language || "");
    const requestedCount = Math.max(1, Math.min(Number(form.count) || 1, 5));
    const currentCount = editRow.quotes?.length ?? 0;
    const rawWordLimit = Number(form.wordLimit);
    const safeWordLimit = Number.isFinite(rawWordLimit) ? Math.max(4, Math.min(rawWordLimit, 100)) : undefined;
    const baselineWordLimit = editRow.word_limit ?? defaultForm.wordLimit;
    const wordLimitChanged = Number.isFinite(rawWordLimit) && rawWordLimit !== baselineWordLimit;
    const shouldRegenerate =
      requestedCount !== currentCount || Boolean(trimmedHook) || wordLimitChanged;
    setSubmitStatus({ type: "loading", message: "Saving..." });
    try {
      const res = await fetch("/api/quotes/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: editRow.id,
          topic: trimmedTopic,
          tone: form.tone || null,
          persona: form.persona || null,
          language: resolvedLanguage || "en",
          style: form.style || null,
          count: shouldRegenerate ? requestedCount : undefined,
          wordLimit: safeWordLimit,
          hook: trimmedHook || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to update quote pack.");
      }
      const updated =
        body.quote ??
        {
          ...editRow,
          topic: trimmedTopic,
          tone: form.tone || null,
          persona: form.persona || null,
          language: form.language || null,
          style: form.style || null,
          hook: trimmedHook || null,
          word_limit: safeWordLimit ?? editRow.word_limit ?? null,
          quotes: editRow.quotes,
        };
      setQuotes((prev) =>
        prev.map((q) =>
          q.id === editRow.id
            ? {
                ...q,
                ...updated,
                topic: trimmedTopic,
                tone: form.tone || null,
                persona: form.persona || null,
                language: form.language || null,
                style: form.style || null,
                hook: trimmedHook || updated.hook || null,
                word_limit: safeWordLimit ?? updated.word_limit ?? null,
              }
            : q,
        ),
      );
      setSubmitStatus({ type: "success", message: "Updated." });
      setEditRow(null);
      setLanguageQuery(labelForLanguage(defaultForm.language));
      setShowModal(false);
    } catch (err) {
      setSubmitStatus({
        type: "error",
        message: (err as Error).message || "Unable to update.",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-3 bg-white p-5 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Quotes</p>
          <h1 className="text-2xl font-bold text-dark dark:text-dark-8">Generated quotes</h1>
          <p className="text-sm text-gray-6 dark:text-dark-6">View your recent quote packs and create new ones.</p>
        </div>
        <button
          onClick={() => {
            setSubmitStatus({ type: "idle" });
            setEditRow(null);
            setForm({ ...defaultForm });
            setLanguageQuery(labelForLanguage(defaultForm.language));
            setShowModal(true);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
        >
          + Generate Quote
        </button>
      </div>

      <div className="rounded-2xl border border-gray-3 bg-white p-4 shadow-card-2 dark:border-stroke-dark dark:bg-dark-2">
        {loading ? (
          <div className="py-10 text-center text-gray-6 dark:text-dark-6">Loading quotes...</div>
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

              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <div className="text-xs font-semibold text-gray-6 dark:text-dark-6">
                    Search <span className="font-normal">(topic, tone, persona)</span>
                  </div>
                  <div className="relative">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search (topic, tone, persona)"
                    className="h-10 w-56 rounded-lg border border-gray-3 bg-white px-3 pl-9 text-sm text-dark outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    aria-label="Search quotes by topic, tone, or persona"
                  />
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-5">🔍</span>
                  </div>
                </div>
              </div>
            </div>

            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                <tr>
                  <th className="px-4 py-3">Quotes</th>
                  <th className="px-4 py-3">Topic</th>
                  <th className="px-4 py-3">Tone</th>
                  <th className="px-4 py-3">Count</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-gray-6 dark:text-dark-6">
                      No quotes found for your search.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-1/60 align-top dark:hover:bg-dark-3/70">
                      <td className="px-4 py-3 text-sm text-gray-7 dark:text-dark-7">
                        <div className="line-clamp-2 font-medium text-dark dark:text-dark-8">{row.quotes?.[0] ?? "—"}</div>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-semibold uppercase">
                          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary dark:bg-primary/20">
                            {row.persona || "Persona —"}
                          </span>
                          <span className="rounded-full bg-gray-2 px-2.5 py-1 text-gray-7 dark:bg-dark-3 dark:text-dark-8">
                            {labelForLanguage(row.language) || "Language —"}
                          </span>
                          <span className="rounded-full bg-gray-2 px-2.5 py-1 text-gray-7 dark:bg-dark-3 dark:text-dark-8">
                            {row.style || "Style —"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-dark dark:text-dark-8">{row.topic || "—"}</td>
                      <td className="px-4 py-3 text-gray-7 dark:text-dark-7">{row.tone || "—"}</td>
                      <td className="px-4 py-3 text-gray-7 dark:text-dark-7">{row.quotes?.length ?? 0}</td>
                      <td className="px-4 py-3 text-gray-6 dark:text-dark-6">
                        {new Date(row.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
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
                              setForm({
                                topic: row.topic ?? "",
                                tone: row.tone ?? "",
                                persona: row.persona ?? "",
                                language: labelForLanguage(row.language) || "English",
                                style: row.style ?? "",
                                count: row.quotes?.length ?? 8,
                                wordLimit: row.word_limit ?? defaultForm.wordLimit,
                                hook: row.hook ?? "",
                              });
                              setLanguageQuery(labelForLanguage(row.language) || "English");
                              setShowModal(true);
                              setSubmitStatus({ type: "idle" });
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="rounded-md border border-red-200 px-3 py-1 text-red-600 transition hover:bg-red-50 dark:border-red-400/50 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
                            onClick={() => {
                              setDeleteStatus({ type: "idle" });
                              setDeleteRow(row);
                            }}
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
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-6 dark:text-dark-6">
              <div>
                Showing{" "}
                <span className="font-semibold text-dark dark:text-dark-8">
                  {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
                </span>{" "}
                  to{" "}
                  <span className="font-semibold text-dark dark:text-dark-8">
                    {filteredRows.length === 0 ? 0 : Math.min(currentPage * pageSize, filteredRows.length)}
                  </span>{" "}
                  of <span className="font-semibold text-dark dark:text-dark-8">{filteredRows.length}</span> entries
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
                            filteredRows.length === 0 && "cursor-not-allowed opacity-60",
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
                    disabled={currentPage === pageCount || filteredRows.length === 0}
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
          <div
            className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12"
            role="dialog"
            aria-modal="true"
          >
            <div className="mt-4 max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:bg-dark-2 dark:border dark:border-stroke-dark">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Generate</p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">
                    {editRow ? "Edit quote pack" : "New quote pack"}
                  </h2>
                </div>
              <button
                type="button"
            onClick={() => {
              setShowModal(false);
              setEditRow(null);
              setForm({ ...defaultForm });
              setSubmitStatus({ type: "idle" });
              setLanguageQuery(labelForLanguage(defaultForm.language));
            }}
            className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
          >
            Close
          </button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                if (editRow) {
                  e.preventDefault();
                  handleUpdate();
                } else {
                  handleSubmit(e);
                }
              }}
            >
              <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                <div className="flex items-center gap-2">
                  <span>Topic *</span>
                  <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(morning motivation, startup mindset)</span>
                </div>
                <input
                  ref={topicInputRef}
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                  name="topic"
                  value={form.topic}
                  onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
                  placeholder="Topic (morning motivation, startup mindset)"
                  required
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Tone</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(motivational, witty, calm)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    name="tone"
                    value={form.tone}
                    onChange={(e) => setForm((prev) => ({ ...prev, tone: e.target.value }))}
                    placeholder="Tone (motivational, witty, calm)"
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Persona</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(coach, founder, creator)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    name="persona"
                    value={form.persona}
                    onChange={(e) => setForm((prev) => ({ ...prev, persona: e.target.value }))}
                    placeholder="Persona (coach, founder, creator)"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="relative block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Language</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(English, Hindi, Punjabi, etc.)</span>
                  </div>
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
                        // Delay to allow click selection
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
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Style</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(short lines, poetic, punchy)</span>
                  </div>
                  <input
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    name="style"
                    value={form.style}
                    onChange={(e) => setForm((prev) => ({ ...prev, style: e.target.value }))}
                    placeholder="Style (short lines, poetic, punchy)"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Count</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(1-5 quotes)</span>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    name="count"
                    value={form.count}
                    onChange={(e) => {
                      const next = Math.max(1, Math.min(Number(e.target.value) || 1, 5));
                      setForm((prev) => ({ ...prev, count: next }));
                    }}
                    onBlur={(e) => {
                      const next = Math.max(1, Math.min(Number(e.target.value) || 1, 5));
                      if (next !== form.count) {
                        setForm((prev) => ({ ...prev, count: next }));
                      }
                    }}
                    placeholder="Count (1-5)"
                  />
                </label>
                <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                  <div className="flex items-center gap-2">
                    <span>Max words per quote</span>
                    <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(4–100 words)</span>
                  </div>
                  <input
                    type="number"
                    min={4}
                    max={100}
                    className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                    name="wordLimit"
                    value={form.wordLimit}
                    onChange={(e) => {
                      const next = Math.max(4, Math.min(Number(e.target.value) || 4, 100));
                      setForm((prev) => ({ ...prev, wordLimit: next }));
                    }}
                    onBlur={(e) => {
                      const next = Math.max(4, Math.min(Number(e.target.value) || 4, 100));
                      if (next !== form.wordLimit) {
                        setForm((prev) => ({ ...prev, wordLimit: next }));
                      }
                    }}
                    placeholder="Words limit per quote"
                  />
                </label>
              </div>

              <label className="block text-sm font-semibold text-dark dark:text-dark-7">
                <div className="flex items-center gap-2">
                  <span>Hook / angle</span>
                  <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(e.g., from 0→1K followers)</span>
                </div>
                <input
                  className="mt-2 w-full rounded-lg border border-gray-3 bg-white px-4 py-3 text-sm outline-none transition focus:border-primary dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                  name="hook"
                  value={form.hook}
                  onChange={(e) => setForm((prev) => ({ ...prev, hook: e.target.value }))}
                  placeholder="Hook or angle to guide the quotes"
                />
              </label>

              {submitStatus.type !== "idle" && (
                <div
                  className={cn(
                    "rounded-lg border px-4 py-3 text-sm",
                    submitStatus.type === "error"
                      ? "border-red-200 bg-red-50 text-red-600 dark:border-red-400/60 dark:bg-red-500/10 dark:text-red-200"
                      : submitStatus.type === "success"
                        ? "border-green-200 bg-green-50 text-green-700 dark:border-green-dark dark:bg-green-500/10 dark:text-green-100"
                        : "border-stroke bg-gray-1 text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8",
                  )}
                >
                  {submitStatus.message}
                </div>
              )}

              <button
                type="submit"
                onClick={(e) => {
                  if (editRow) {
                    e.preventDefault();
                    handleUpdate();
                  }
                }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={submitStatus.type === "loading"}
              >
                {submitStatus.type === "loading"
                  ? editRow
                    ? "Saving..."
                    : "Generating..."
                  : editRow
                    ? "Save changes"
                    : "Generate Quotes"}
                {submitStatus.type === "loading" && (
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-t-transparent" />
                )}
              </button>
            </form>
          </div>
        </div>
        </ModalPortal>
      )}

      {detailRow && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12"
            role="dialog"
            aria-modal="true"
          >
            <div className="mt-4 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:border dark:border-stroke-dark dark:bg-dark-2">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Quote pack</p>
                  <h2 className="text-xl font-bold text-dark dark:text-dark-8">{detailRow.topic || "Quote details"}</h2>
                  <p className="text-sm text-gray-6 dark:text-dark-6">
                  Tone: {detailRow.tone || "—"} · Persona: {detailRow.persona || "—"} · Language:{" "}
                  {detailRow.language || "—"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailRow(null)}
                className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
              >
                Close
              </button>
            </div>

                <div className="space-y-3 text-sm text-dark dark:text-dark-8">
                  {detailRow.quotes && detailRow.quotes.length > 0 ? (
                    <ol className="space-y-2">
                      {detailRow.quotes
                        .map((q) => normalizeQuote(q))
                        .filter(Boolean)
                        .map((q, idx) => (
                          <li
                            key={`${idx}-${q.slice(0, 12)}`}
                            className="flex items-start justify-between gap-3 rounded-lg border border-gray-3 bg-gray-1 px-4 py-3 text-sm text-gray-7 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8"
                          >
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="mt-[2px] text-xs font-semibold text-primary">{idx + 1}.</span>
                              <p className="whitespace-pre-wrap break-words text-dark dark:text-dark-8">{q}</p>
                            </div>
                            <button
                          type="button"
                          aria-label="Copy quote"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(q);
                              setCopiedIdx(idx);
                              setTimeout(() => setCopiedIdx((prev) => (prev === idx ? null : prev)), 1200);
                            } catch (err) {
                              console.error("Failed to copy quote", err);
                            }
                          }}
                        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-3 bg-white text-gray-6 transition hover:bg-gray-2 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                      >
                          {copiedIdx === idx ? (
                            <CheckIcon className="h-4 w-4 text-green-600" />
                          ) : (
                            <CopyIcon className="h-4 w-4" />
                          )}
                        </button>
                      </li>
                    ))}
                </ol>
              ) : (
                <p className="text-gray-6 dark:text-dark-6">No quotes available.</p>
              )}
            </div>
          </div>
        </div>
        </ModalPortal>
      )}

      {deleteRow && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[20000] flex items-start justify-center bg-black/60 px-4 py-12"
            role="dialog"
            aria-modal="true"
          >
            <div className="mt-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-card-2 dark:border dark:border-stroke-dark dark:bg-dark-2">
              <h3 className="text-lg font-semibold text-dark dark:text-dark-8">Delete this quote pack?</h3>
              <p className="mt-2 text-sm text-gray-6 dark:text-dark-6">
                This will remove the pack for this user. This action cannot be undone.
              </p>
              {deleteStatus.type !== "idle" && (
              <div
                className={cn(
                  "mt-3 rounded-lg border px-4 py-2 text-sm",
                  deleteStatus.type === "error"
                    ? "border-red-200 bg-red-50 text-red-600 dark:border-red-400/60 dark:bg-red-500/10 dark:text-red-200"
                    : deleteStatus.type === "success"
                      ? "border-green-200 bg-green-50 text-green-700 dark:border-green-dark dark:bg-green-500/10 dark:text-green-100"
                      : "border-stroke bg-gray-1 text-dark dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8",
                )}
              >
                {deleteStatus.message}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-gray-3 px-4 py-2 text-sm font-semibold text-gray-7 hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                onClick={() => setDeleteRow(null)}
                disabled={deleteStatus.type === "loading"}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-red-400/60 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/20"
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
