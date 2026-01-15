"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  quote_type?: "text" | "image" | null;
  image_quotes?: Array<{ text: string }> | null;
  hook?: string | null;
  word_limit?: number | null;
  quotes: string[];
  created_at: string;
};

type PublishJobStatus = {
  status: "queued" | "publishing" | "published" | "failed";
  scheduled_at?: string | null;
  updated_at?: string | null;
  attempts?: number | null;
  last_error?: string | null;
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
  language: "hi",
  style: "",
  count: 5,
  wordLimit: 40,
  hook: "",
  quoteType: "text" as "text" | "image",
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
  if (!normalized || normalized === "choose a language...") return "hi";
  const direct = languageOptions.find((lang) => lang.code.toLowerCase() === normalized);
  if (direct) return direct.code;
  const byLabel = languageOptions.find((lang) => lang.label.toLowerCase() === normalized);
  return byLabel?.code ?? "hi";
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
    .replace(/```/g, "")
    .replace(/^\s*\[\s*|\s*\]\s*$/g, "")
    .replace(/^\s*\(?\d+\)?[.)]\s*/g, "") // "1." "(1)" "1)"
    .replace(/^\s*[-–•]\s*/g, "")
    .trim();

  // Remove common trailing “label garbage”
  text = text
    .replace(/\s*\(\s*\d+\s*\)\s*—\s*.*$/g, "") // "(1) — something"
    .replace(/\s*—\s*[^|]{0,80}\|\s*$/g, "")    // "— title |"
    .replace(/\s*\|\s*$/g, "")                  // trailing "|"
    .trim();

  // Strip surrounding quotes/backticks again
  text = text.replace(/^['"`]+/, "").replace(/['"`]+$/, "").trim();

  if (!text) return "";
  const lower = text.toLowerCase();
  if (lower === "json") return "";
  if (text === "[" || text === "]") return "";

  return text;
};


const extractQuoteList = (row: QuoteRow) => {
  if (row.image_quotes && row.image_quotes.length > 0) {
    return row.image_quotes.map((q) => normalizeQuote(q.text));
  }
  return (row.quotes || []).map((q) => normalizeQuote(q));
};

const imageBackgrounds = [
  "/images/cover/cover-01.png",
  "/images/cover/cover-02.jpg",
  "/images/cover/cover-03.jpg",
  "/images/cover/cover-04.jpg",
  "/images/cover/cover-05.jpg",
];

const fontOptions = [
  { label: "Arial", value: "Arial" },
  { label: "Noto Sans Devanagari", value: "Noto Sans Devanagari, Noto Sans, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times", value: "Times New Roman" },
  { label: "Poppins", value: "Poppins, Arial, sans-serif" },
  { label: "Merriweather", value: "Merriweather, Georgia, serif" },
];

function backgroundForRow(id: string | number) {
  const idx = Math.abs(typeof id === "string" ? id.split("").reduce((a, c) => a + c.charCodeAt(0), 0) : Number(id)) % imageBackgrounds.length;
  return imageBackgrounds[idx];
}

const gradientOptions: Array<{ label: string; colors: [string, string] }> = [
  { label: "Sunset", colors: ["#f97316", "#f43f5e"] },
  { label: "Ocean", colors: ["#0ea5e9", "#6366f1"] },
  { label: "Forest", colors: ["#22c55e", "#14532d"] },
  { label: "Violet", colors: ["#ec4899", "#4f46e5"] },
  { label: "Rose", colors: ["#ec4899", "#f59e0b"] },
];

const emojiPresets = [
  "🔥",
  "✨",
  "💡",
  "🚀",
  "💪",
  "🧠",
  "🎯",
  "🏆",
  "🙏",
  "🌿",
  "🌞",
  "❤️",
];

type ImageSizeKey =
  | "instagram_square"
  | "instagram_story"
  | "facebook"
  | "twitter"
  | "linkedin"
  | "mobile_portrait"
  | "custom";


const imageSizePresets: Record<
  ImageSizeKey,
  {
    label: string;
    width: number;
    height: number;
  }
> = {
  instagram_square: { label: "Instagram Square (1080×1080)", width: 1080, height: 1080 },
  instagram_story: { label: "Instagram Story (1080×1920)", width: 1080, height: 1920 },
  facebook: { label: "Facebook Feed (1200×630)", width: 1200, height: 630 },
  twitter: { label: "Twitter/X (1600×900)", width: 1600, height: 900 },
  linkedin: { label: "LinkedIn (1200×627)", width: 1200, height: 627 },
  mobile_portrait: { label: "Mobile Portrait (1080×1920)", width: 1080, height: 1920 },
  custom: { label: "Custom size", width: 1080, height: 1920 },
};

const solidOptions = ["#0f172a", "#111827", "#f5f5f5", "#f97316", "#22c55e", "#0ea5e9"];

function resolveBackground(style: ImageStyle, rowId: string | number): BackgroundChoice {
  if (style.backgroundType === "solid" && style.backgroundValue) {
    return { type: "solid", value: style.backgroundValue };
  }
  if (style.backgroundType === "gradient" && style.gradientColors) {
    return { type: "gradient", value: style.gradientColors };
  }
  const texture = style.backgroundValue || backgroundForRow(rowId);
  return { type: "texture", value: texture };
}

function backgroundCss(style: ImageStyle, rowId: string | number) {
  const overlay = `rgba(0,0,0,${style.overlayOpacity})`;
  if (style.backgroundType === "solid" && style.backgroundValue) {
    return {
      backgroundImage: `linear-gradient(${overlay}, ${overlay}), linear-gradient(${style.backgroundValue}, ${style.backgroundValue})`,
    };
  }
  if (style.backgroundType === "gradient" && style.gradientColors) {
    return {
      backgroundImage: `linear-gradient(${overlay}, ${overlay}), linear-gradient(135deg, ${style.gradientColors[0]}, ${style.gradientColors[1]})`,
    };
  }
  const texture = style.backgroundValue || backgroundForRow(rowId);
  return {
    backgroundImage: `linear-gradient(${overlay}, ${overlay}), url(${texture})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

type ImageStyle = {
  fontFamily: string;
  fontSize: number;
  color: string;
  overlayOpacity: number;
  textAlign: CanvasTextAlign;
  backgroundType: "texture" | "solid" | "gradient";
  backgroundValue?: string;
  gradientColors?: [string, string];
};

type BackgroundChoice =
  | { type: "texture"; value?: string }
  | { type: "solid"; value: string }
  | { type: "gradient"; value: [string, string] };

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const paragraphs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lines: string[] = [];

  const pushWrappedLine = (line: string) => {
    if (!line) return;
    if (ctx.measureText(line).width <= maxWidth) {
      lines.push(line);
      return;
    }
    let current = "";
    for (const char of line) {
      const test = `${current}${char}`;
      if (ctx.measureText(test).width <= maxWidth || !current) {
        current = test;
      } else {
        lines.push(current);
        current = char;
      }
    }
    if (current) lines.push(current);
  };

  paragraphs.forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";
    words.forEach((word) => {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) pushWrappedLine(current);
        current = word;
      }
    });
    if (current) pushWrappedLine(current);
  });

  return lines.length ? lines : [text];
}

async function generateImageQuotePng(options: {
  text: string;
  background: BackgroundChoice;
  style: ImageStyle;
  fileName?: string;
  dimensions?: { width: number; height: number };
  returnFile?: boolean;
}): Promise<void | File> {
  const { text, background, fileName = "quote.png", dimensions } = options;

  // Ensure custom web fonts are loaded before measuring/wrapping
  if (typeof document !== "undefined" && (document as any).fonts?.ready) {
    try {
      await (document as any).fonts.ready;
    } catch {}
  }

  const canvas = document.createElement("canvas");
  canvas.width = dimensions?.width ?? 1080;
  canvas.height = dimensions?.height ?? 1350;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create canvas context");

  // ---------- Background ----------
  if (background.type === "texture") {
    const src = background.value || imageBackgrounds[0];
    const bg = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    const scale = Math.max(canvas.width / bg.width, canvas.height / bg.height);
    const dw = bg.width * scale;
    const dh = bg.height * scale;
    const dx = (canvas.width - dw) / 2;
    const dy = (canvas.height - dh) / 2;
    ctx.drawImage(bg, dx, dy, dw, dh);
  } else if (background.type === "solid") {
    ctx.fillStyle = background.value;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (background.type === "gradient") {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, background.value[0]);
    grad.addColorStop(1, background.value[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // ---------- Overlay ----------
  ctx.fillStyle = `rgba(0,0,0,${options.style.overlayOpacity})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ---------- Text ----------
  ctx.fillStyle = options.style.color;
  ctx.textAlign = options.style.textAlign;
  ctx.textBaseline = "middle";

  // Safe box (prevents top/bottom clipping)
  const paddingX = canvas.width * 0.09;
  const paddingY = canvas.height * 0.10;
  const boxWidth = canvas.width - paddingX * 2;
  const boxHeight = canvas.height - paddingY * 2;

  const { fontSize, lines, lineHeight } = fitTextToBox({
    ctx,
    text,
    boxWidth,
    boxHeight,
    fontFamily: options.style.fontFamily, // IMPORTANT: no quotes
    fontWeight: 700,
    startFontSize: options.style.fontSize,
    minFontSize: 18,
    lineHeightMult: 1.25,
  });

  ctx.font = `700 ${fontSize}px ${options.style.fontFamily}`;

  // Optional subtle shadow for readability
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = Math.max(6, Math.round(fontSize * 0.18));
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  const x =
    options.style.textAlign === "left"
      ? paddingX
      : options.style.textAlign === "right"
        ? canvas.width - paddingX
        : canvas.width / 2;

  const totalHeight = lines.length * lineHeight;
  const startY = paddingY + (boxHeight - totalHeight) / 2 + lineHeight / 2;

  lines.forEach((line, index) => {
    const y = startY + index * lineHeight;
    if (line) ctx.fillText(line, x, y); // keep blank lines as spacing
  });

  // Reset shadow (good practice)
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;

  // ---------- Export ----------
  const dataUrl = canvas.toDataURL("image/png");

  if (options.returnFile) {
    const blob = await (await fetch(dataUrl)).blob();
    return new File([blob], fileName, { type: "image/png" });
  }

  const link = document.createElement("a");
  link.download = fileName;
  link.href = dataUrl;
  link.click();
}


function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function wrapTextLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const paragraphs = String(text)
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((p) => p.trim());

  const lines: string[] = [];

  const pushLine = (line: string) => {
    const trimmed = line.trim();
    if (trimmed) lines.push(trimmed);
  };

  const breakLongWord = (word: string) => {
    let current = "";
    for (const ch of word) {
      const test = current + ch;
      if (ctx.measureText(test).width <= maxWidth || current.length === 0) {
        current = test;
      } else {
        pushLine(current);
        current = ch;
      }
    }
    if (current) pushLine(current);
  };

  for (const paragraph of paragraphs) {
    if (!paragraph) {
      lines.push(""); // preserve blank line spacing
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;

      if (ctx.measureText(test).width <= maxWidth) {
        current = test;
        continue;
      }

      if (current) pushLine(current);

      if (ctx.measureText(word).width > maxWidth) {
        breakLongWord(word);
        current = "";
      } else {
        current = word;
      }
    }

    if (current) pushLine(current);
  }

  return lines.length ? lines : [String(text)];
}


function fitTextToBox(options: {
  ctx: CanvasRenderingContext2D;
  text: string;
  boxWidth: number;
  boxHeight: number;
  fontFamily: string;
  fontWeight?: number | string;
  startFontSize: number;
  minFontSize: number;
  lineHeightMult: number;
}) {
  const {
    ctx,
    text,
    boxWidth,
    boxHeight,
    fontFamily,
    fontWeight = 700,
    startFontSize,
    minFontSize,
    lineHeightMult,
  } = options;

  let fontSize = startFontSize;
  let lines: string[] = [];
  let lineHeight = fontSize * lineHeightMult;

  while (fontSize >= minFontSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = wrapTextLines(ctx, text, boxWidth);
    lineHeight = fontSize * lineHeightMult;

    const totalHeight = lines.length * lineHeight;

    const tooWide = lines.some((l) => l && ctx.measureText(l).width > boxWidth);
    if (totalHeight <= boxHeight && !tooWide) break;

    fontSize -= 2;
  }

  if (fontSize < minFontSize) {
    fontSize = minFontSize;
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    lines = wrapTextLines(ctx, text, boxWidth);
    lineHeight = fontSize * lineHeightMult;
  }

  return { fontSize, lines, lineHeight };
}



function toHashtagTokens(value?: string | null) {
  if (!value) return [];
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function fallbackHashtags(row: QuoteRow) {
  const tags = ["#quotes", "#motivation", "#mindset"];
  const toneToken = toHashtagTokens(row.tone)[0];
  if (toneToken) {
    tags.push(`#${toneToken}`);
  }
  const language = (row.language || "").toLowerCase();
  if (language.startsWith("hi")) {
    tags.push("#hindi");
  } else if (language.startsWith("en")) {
    tags.push("#english");
  }
  return Array.from(new Set(tags));
}

function buildHashtags(row: QuoteRow) {
  const tokens = [
    ...toHashtagTokens(row.topic),
    ...toHashtagTokens(row.persona),
    ...toHashtagTokens(row.tone),
    ...toHashtagTokens(row.style),
    ...toHashtagTokens(row.language),
  ];
  const unique = Array.from(new Set(tokens)).filter(Boolean);
  if (!unique.length) return fallbackHashtags(row);
  const base = unique.slice(0, 8).map((word) => {
    const clean = word.replace(/[^a-z0-9]/gi, "");
    return `#${clean || "quote"}`;
  });
  return base.length ? base : fallbackHashtags(row);
}

const emojiRules: Array<{ tokens: string[]; emojis: string[] }> = [
  { tokens: ["motivation", "motivational", "inspire", "inspiration"], emojis: ["🔥", "✨", "💪"] },
  { tokens: ["mindset", "focus", "discipline"], emojis: ["🧠", "🎯"] },
  { tokens: ["startup", "business", "entrepreneur", "founder"], emojis: ["🚀", "💡"] },
  { tokens: ["success", "achievement", "win", "victory"], emojis: ["🏆", "🎉"] },
  { tokens: ["calm", "peace", "relax"], emojis: ["🌿", "🕊️"] },
  { tokens: ["gratitude", "thankful"], emojis: ["🙏", "💛"] },
  { tokens: ["happy", "joy", "smile"], emojis: ["😊", "🌞"] },
  { tokens: ["love", "kind", "care"], emojis: ["❤️", "✨"] },
  { tokens: ["growth", "learn", "progress"], emojis: ["🌱", "📈"] },
];

function buildEmojiSuggestions(row: QuoteRow) {
  const tokens = new Set([
    ...toHashtagTokens(row.topic),
    ...toHashtagTokens(row.tone),
    ...toHashtagTokens(row.persona),
    ...toHashtagTokens(row.style),
  ]);
  const picks: string[] = [];
  emojiRules.forEach((rule) => {
    if (rule.tokens.some((token) => tokens.has(token))) {
      picks.push(...rule.emojis);
    }
  });
  return Array.from(new Set(picks)).slice(0, 4);
}

export default function QuotesPage() {
  const searchParams = useSearchParams();
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
  const [downloadIdx, setDownloadIdx] = useState<number | null>(null);
  const [shareIdx, setShareIdx] = useState<number | null>(null);
  const [fbStatus, setFbStatus] = useState<{ connected: boolean; pageId?: string | null; pageName?: string | null }>({
    connected: false,
    pageId: null,
    pageName: null,
  });
  const [fbPages, setFbPages] = useState<Array<{ id: string; name: string }>>([]);
  const [fbSelectedPageId, setFbSelectedPageId] = useState<string | null>(null);
  const [fbPageLoading, setFbPageLoading] = useState(false);
  const [fbPageSaving, setFbPageSaving] = useState(false);
  const [fbPostingIdx, setFbPostingIdx] = useState<number | null>(null);
  const [fbConnecting, setFbConnecting] = useState(false);
  const [fbStatusError, setFbStatusError] = useState<string | null>(null);
  const [publishJobs, setPublishJobs] = useState<Record<string, PublishJobStatus>>({});
  const [publishQueueingId, setPublishQueueingId] = useState<string | null>(null);
  const [shareMenuId, setShareMenuId] = useState<string | null>(null);
  const [shareMenuPos, setShareMenuPos] = useState<{ top: number; left: number; placement: "top" | "bottom" } | null>(
    null,
  );
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<string, boolean>>({});
  const [fbSharePages, setFbSharePages] = useState<Array<{ id: string; name: string }>>([]);
  const [fbSharePickerOpen, setFbSharePickerOpen] = useState(false);
  const [fbShareQuoteId, setFbShareQuoteId] = useState<string | null>(null);
  const [fbShareLoading, setFbShareLoading] = useState(false);
  const [fbShareCaption, setFbShareCaption] = useState<string | null>(null);
  const [fbShareImageDataUrl, setFbShareImageDataUrl] = useState<string | null>(null);
  const [selectedEmojis, setSelectedEmojis] = useState<string[]>([]);
  const [autoEmojis, setAutoEmojis] = useState(true);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [languageQuery, setLanguageQuery] = useState(labelForLanguage(defaultForm.language));
  const [showLanguageList, setShowLanguageList] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [imageSizeKey, setImageSizeKey] = useState<ImageSizeKey>("instagram_square");
  const [customSize, setCustomSize] = useState<{ width: number; height: number }>({ width: 1080, height: 1350 });
  const [imageStyle, setImageStyle] = useState<ImageStyle>({
    fontFamily: "Arial",
    fontSize: 24,
    color: "#fdfdfd",
    overlayOpacity: 0.55,
    textAlign: "center",
    backgroundType: "texture",
    backgroundValue: "",
    gradientColors: ["#f97316", "#f43f5e"],
  });
  const topicInputRef = useRef<HTMLInputElement | null>(null);
  const openedFromParam = useRef(false);
  const anyModalOpen = showModal || Boolean(detailRow) || Boolean(deleteRow);
  const detailParam = searchParams.get("detail");
  const facebookEnabled = Boolean(enabledPlatforms.facebook);
  const instagramEnabled = Boolean(enabledPlatforms.instagram);
  const linkedinEnabled = Boolean(enabledPlatforms.linkedin);

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
    const loadPlatforms = async () => {
      try {
        const res = await fetch("/api/social/platforms", { cache: "no-store" });
        const body = await res.json().catch(() => ({}));
        if (!res.ok || !Array.isArray(body?.platforms)) {
          return;
        }
        const map: Record<string, boolean> = {};
        for (const platform of body.platforms) {
          if (platform?.platform) {
            map[String(platform.platform)] = Boolean(platform.enabled);
          }
        }
        setEnabledPlatforms(map);
      } catch {
        // ignore, keep defaults
      }
    };
    void loadPlatforms();
  }, []);

  useEffect(() => {
    if (!shareMenuId) return;
    const handleClick = () => setShareMenuId(null);
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [shareMenuId]);

  const setShareMenuPosition = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const menuWidth = 180;
    const menuHeight = 150;
    const padding = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const placeAbove = rect.bottom + menuHeight + padding > viewportHeight && rect.top - menuHeight - padding > 0;
    const top = placeAbove ? Math.max(padding, rect.top - menuHeight - 8) : rect.bottom + 8;
    const left = Math.min(
      Math.max(padding, rect.right - menuWidth),
      Math.max(padding, viewportWidth - menuWidth - padding),
    );
    setShareMenuPos({ top, left, placement: placeAbove ? "top" : "bottom" });
  };

  useEffect(() => {
    if (showModal && topicInputRef.current) {
      topicInputRef.current.focus();
      topicInputRef.current.select();
    }
  }, [showModal, editRow]);

  const selectedDimensions = useCallback(() => {
    const preset = imageSizePresets[imageSizeKey];
    if (!preset || imageSizeKey === "custom") {
      const safeWidth = Math.max(320, Math.min(4000, Math.round(customSize.width || 0)));
      const safeHeight = Math.max(320, Math.min(4000, Math.round(customSize.height || 0)));
      return { width: safeWidth || 1080, height: safeHeight || 1350 };
    }
    return { width: preset.width, height: preset.height };
  }, [customSize.height, customSize.width, imageSizeKey]);

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
        setPublishJobs(body.publishJobs || {});
      } catch (err) {
        setError((err as Error).message || "Unable to load quotes.");
      } finally {
        setLoading(false);
      }
    };
    fetchQuotes();
  }, []);

  useEffect(() => {
    if (!detailParam || detailRow || openedFromParam.current) return;
    const match = quotes.find((row) => row.id === detailParam);
    if (match) {
      openedFromParam.current = true;
      setDetailRow(match);
    }
  }, [detailParam, detailRow, quotes]);

  useEffect(() => {
    if (detailRow) {
      setSelectedEmojis([]);
    }
  }, [detailRow?.id]);

  const previewDims = selectedDimensions();
  const autoEmojiList = useMemo(
    () => (detailRow && autoEmojis ? buildEmojiSuggestions(detailRow) : []),
    [detailRow, autoEmojis],
  );
  const combinedEmojis = useMemo(
    () => Array.from(new Set([...(autoEmojis && detailRow ? buildEmojiSuggestions(detailRow) : []), ...selectedEmojis])),
    [autoEmojis, detailRow, selectedEmojis],
  );

  const fetchFacebookPages = useCallback(async () => {
    if (!facebookEnabled) return;
    setFbStatusError(null);
    setFbPageLoading(true);
    try {
      const res = await fetch("/api/social/facebook/pages");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to load Facebook Pages.");
      }
      const pages: Array<{ id: string; name: string }> = Array.isArray(data.pages)
        ? data.pages
        : [];
      const preferredPageId = data.selectedPageId ?? pages[0]?.id ?? null;
      const preferredPageName =
        data.selectedPageName ?? pages.find((page: { id: string }) => page.id === preferredPageId)?.name ?? null;
      setFbPages(pages);
      setFbSelectedPageId((prev) => data.selectedPageId ?? prev ?? preferredPageId);
      setFbStatus((prev) => ({
        ...prev,
        connected: true,
        pageId: data.selectedPageId ?? prev.pageId ?? preferredPageId,
        pageName: preferredPageName ?? prev.pageName ?? null,
      }));
    } catch (err) {
      console.error("Failed to load Facebook pages", err);
      setFbStatusError((err as Error).message || "Unable to load Facebook Pages.");
    } finally {
      setFbPageLoading(false);
    }
  }, []);

  const refreshFacebookStatus = useCallback(
    async (withPages = false): Promise<{ connected: boolean; error?: string }> => {
      if (!facebookEnabled) return { connected: false };
      setFbStatusError(null);
      try {
        const res = await fetch("/api/social/facebook/status");
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Unable to load Facebook status.");
        }
        const connected = Boolean(data.connected);
        setFbStatus({
          connected,
          pageId: data.pageId ?? null,
          pageName: data.pageName ?? null,
        });
        setFbSelectedPageId(data.pageId ?? null);
        if (connected && withPages) {
          await fetchFacebookPages();
        } else if (!connected) {
          setFbPages([]);
          setFbSelectedPageId(null);
        }
        return { connected };
      } catch (err) {
        console.error("Failed to load Facebook status", err);
        const message = (err as Error).message || "Unable to load Facebook status.";
        setFbStatusError(message);
        setFbStatus({ connected: false, pageId: null, pageName: null });
        setFbPages([]);
        setFbSelectedPageId(null);
        return { connected: false, error: message };
      }
    },
    [fetchFacebookPages],
  );

  useEffect(() => {
    if (!detailRow || !facebookEnabled) return;
    void refreshFacebookStatus(true);
  }, [detailRow, refreshFacebookStatus]);

  const resolveEmojisForRow = useCallback(
    (row: QuoteRow) => {
      const autoList = autoEmojis ? buildEmojiSuggestions(row) : [];
      return Array.from(new Set([...autoList, ...selectedEmojis]));
    },
    [autoEmojis, selectedEmojis],
  );

  const buildCaptionForShare = useCallback(
    (row: QuoteRow, text: string) => {
      const message = text.trim();
      const emojis = resolveEmojisForRow(row);
      const tags = buildHashtags(row);
      const parts = [message, emojis.length ? emojis.join(" ") : "", tags.length ? tags.join(" ") : ""].filter(Boolean);
      return parts.join("\n\n");
    },
    [resolveEmojisForRow],
  );

  const buildFacebookCaption = useCallback(
    (row: QuoteRow) => {
      const emojis = resolveEmojisForRow(row);
      const base =
        row.topic?.trim() ||
        row.tone?.trim() ||
        row.persona?.trim() ||
        "Motivation";
      const normalized = base.toLowerCase();
      const captionTitle = normalized.includes("quote") ? base : `${base} quotes`;
      const tags = buildHashtags(row);
      const titleLine = [captionTitle, emojis.length ? emojis.join(" ") : ""].filter(Boolean).join(" ");
      const parts = [titleLine, tags.length ? tags.join(" ") : ""].filter(Boolean);
      return parts.join("\n\n");
    },
    [resolveEmojisForRow],
  );

  const resolveShareStyle = useCallback(
    (row: QuoteRow, dimensions: { width: number; height: number }) => {
      const hasDevanagari = /[\u0900-\u097F]/.test(extractQuoteList(row).join(" "));
      const baseSize = Math.round(dimensions.height * 0.06);
      const useGradient = row.quote_type !== "image";
      return {
        ...imageStyle,
        fontFamily: hasDevanagari ? "Noto Sans Devanagari, Noto Sans, Arial, sans-serif" : imageStyle.fontFamily,
        fontSize: Math.max(imageStyle.fontSize, baseSize),
        backgroundType: useGradient ? "gradient" : imageStyle.backgroundType,
        gradientColors: useGradient ? ["#ec4899", "#4f46e5"] : imageStyle.gradientColors,
        overlayOpacity: useGradient ? 0.15 : imageStyle.overlayOpacity,
      };
    },
    [imageStyle],
  );

  const handleShareText = async (row: QuoteRow, text: string) => {
    try {
      const caption = buildCaptionForShare(row, text);
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ text: caption });
        pushToast("Share sheet opened");
        return;
      }
      await navigator.clipboard.writeText(caption);
      pushToast("Copied for sharing");
    } catch (err) {
      const error = err as Error;
      if (error?.name === "AbortError" || /share canceled/i.test(error?.message || "")) {
        return;
      }
      console.error("Failed to share text", err);
      pushToast("Share failed", "error");
    }
  };

  const startFacebookConnect = async () => {
    if (!facebookEnabled) {
      pushToast("Facebook sharing is disabled.", "error");
      return;
    }
    setFbConnecting(true);
    try {
      const res = await fetch("/api/social/facebook/start");
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        throw new Error(data?.error || "Failed to start Facebook connect");
      }
      window.location.href = data.url;
    } catch (err) {
      console.error("Failed to start Facebook connect", err);
      pushToast("Facebook connect failed", "error");
    } finally {
      setFbConnecting(false);
    }
  };

  const postTextToFacebook = async (text: string, idx: number) => {
    if (!facebookEnabled) {
      pushToast("Facebook sharing is disabled.", "error");
      return;
    }
    let connected = fbStatus.connected;
    let statusError = fbStatusError;
    if (!connected) {
      const result = await refreshFacebookStatus(true);
      connected = result.connected;
      statusError = result.error ?? statusError;
    }
    if (!connected) {
      pushToast(statusError || "Connect Facebook first", "error");
      return;
    }
    setFbPostingIdx(idx);
    try {
      const res = await fetch("/api/social/facebook/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, pageId: fbSelectedPageId || fbStatus.pageId || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Post failed");
      }
      pushToast("Posted to Facebook");
    } catch (err) {
      console.error("Failed to post to Facebook", err);
      pushToast("Facebook post failed", "error");
    } finally {
      setFbPostingIdx((prev) => (prev === idx ? null : prev));
    }
  };

  const postImageToFacebook = async (text: string, idx: number, rowId: string | number) => {
    if (!facebookEnabled) {
      pushToast("Facebook sharing is disabled.", "error");
      return;
    }
    let connected = fbStatus.connected;
    let statusError = fbStatusError;
    if (!connected) {
      const result = await refreshFacebookStatus(true);
      connected = result.connected;
      statusError = result.error ?? statusError;
    }
    if (!connected) {
      pushToast(statusError || "Connect Facebook first", "error");
      return;
    }
    setFbPostingIdx(idx);
    try {
      const dims = selectedDimensions();
      const fileOrVoid = await generateImageQuotePng({
        text,
        background: resolveBackground(imageStyle, rowId),
        style: imageStyle,
        dimensions: dims,
        fileName: `quote-${idx + 1}.png`,
        returnFile: true,
      });
      const file = fileOrVoid instanceof File ? fileOrVoid : null;
      const dataUrl = file ? await fileToDataUrl(file) : undefined;
      const res = await fetch("/api/social/facebook/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          imageDataUrl: dataUrl,
          pageId: fbSelectedPageId || fbStatus.pageId || undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Post failed");
      }
      pushToast("Posted to Facebook");
    } catch (err) {
      console.error("Failed to post image to Facebook", err);
      pushToast("Facebook post failed", "error");
    } finally {
      setFbPostingIdx((prev) => (prev === idx ? null : prev));
    }
  };

  const queuePublishToFacebook = async (quoteId: string) => {
    setPublishQueueingId(quoteId);
    try {
      const res = await fetch("/api/publish/enqueue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quoteId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Unable to queue publish job.");
      }
      const job = body?.job;
      setPublishJobs((prev) => ({
        ...prev,
        [quoteId]: {
          status: job?.status ?? "queued",
          scheduled_at: job?.scheduled_at ?? null,
          updated_at: job?.updated_at ?? job?.created_at ?? new Date().toISOString(),
          attempts: job?.attempts ?? 0,
          last_error: null,
        },
      }));
      pushToast("Queued for publishing");
    } catch (err) {
      const message = (err as Error).message || "Unable to queue publish job.";
      pushToast(message, "error");
    } finally {
      setPublishQueueingId((prev) => (prev === quoteId ? null : prev));
    }
  };

  const markFacebookPageActive = async (pageId: string) => {
    const res = await fetch("/api/social/facebook/select-page", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_id: pageId }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body?.error || "Unable to set Facebook page.");
    }
    return body;
  };

  const handleFacebookShareRequest = async (
    quoteId: string,
    quoteText: string,
    row: QuoteRow,
    rowId: string | number,
  ) => {
    if (!facebookEnabled) {
      pushToast("Facebook sharing is disabled.", "error");
      return;
    }
    setFbShareLoading(true);
    try {
      const dims = selectedDimensions();
      const renderStyle = resolveShareStyle(row, dims);
      const fileOrVoid = await generateImageQuotePng({
        text: quoteText,
        background: resolveBackground(renderStyle, rowId),
        style: renderStyle,
        dimensions: dims,
        fileName: `quote-${quoteId}.png`,
        returnFile: true,
      });
      const file = fileOrVoid instanceof File ? fileOrVoid : null;
      if (!file) {
        throw new Error("Unable to render quote image.");
      }
      const imageDataUrl = await fileToDataUrl(file);
      const caption = buildFacebookCaption(row);

      const res = await fetch("/api/social/facebook/connected-pages", { cache: "no-store" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Connect Facebook first.");
      }
      const pages: Array<{ id: string; name: string }> = Array.isArray(body.pages)
        ? body.pages
            .map((page: { page_id?: string; page_name?: string | null }) => ({
              id: String(page.page_id ?? ""),
              name: page.page_name ?? "Untitled Page",
            }))
            .filter((page) => page.id)
        : [];
      if (pages.length === 0) {
        window.location.href = "/settings/social";
        return;
      }
      if (pages.length === 1) {
        await markFacebookPageActive(pages[0].id);
        await queuePublishToFacebook(quoteId);
        const runRes = await fetch("/api/publish/run-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quote_id: quoteId, caption, imageDataUrl }),
        });
        const runBody = await runRes.json().catch(() => ({}));
        if (!runRes.ok) {
          throw new Error(runBody?.error || "Unable to publish now.");
        }
        pushToast(`Published to ${pages[0].name}`);
        return;
      }
      setFbShareCaption(caption);
      setFbShareImageDataUrl(imageDataUrl);
      setFbSharePages(pages);
      setFbShareQuoteId(quoteId);
      setFbSharePickerOpen(true);
    } catch (err) {
      pushToast((err as Error).message || "Connect Facebook first", "error");
    } finally {
      setFbShareLoading(false);
    }
  };

  const handleShareImage = async (row: QuoteRow, text: string, idx: number, rowId: string | number) => {
    setShareIdx(idx);
    try {
      const caption = buildCaptionForShare(row, text);
      const dims = selectedDimensions();
      const renderStyle = resolveShareStyle(row, dims);
      const fileOrVoid = await generateImageQuotePng({
        text,
        background: resolveBackground(renderStyle, rowId),
        style: renderStyle,
        dimensions: dims,
        fileName: `quote-${idx + 1}.png`,
        returnFile: true,
      });

      const file = fileOrVoid instanceof File ? fileOrVoid : null;
      if (file && typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: detailRow?.topic || "Quote",
          text: caption,
        });
        pushToast("Share sheet opened");
        return;
      }

      await generateImageQuotePng({
        text,
        background: resolveBackground(imageStyle, rowId),
        style: imageStyle,
        dimensions: dims,
        fileName: `quote-${idx + 1}.png`,
      });
      pushToast("Downloaded image (share not supported)");
    } catch (err) {
      const error = err as Error;
      if (error?.name === "AbortError" || /share canceled/i.test(error?.message || "")) {
        return;
      }
      console.error("Failed to share image", err);
      pushToast("Share failed", "error");
    } finally {
      setShareIdx((prev) => (prev === idx ? null : prev));
    }
  };

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

  const pushToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ type, message });
    setTimeout(() => setToast((prev) => (prev?.message === message ? null : prev)), 1500);
  };

  const saveFacebookPageSelection = async () => {
    if (!facebookEnabled) {
      pushToast("Facebook sharing is disabled.", "error");
      return;
    }
    if (!fbSelectedPageId) {
      pushToast("Pick a Facebook Page first", "error");
      return;
    }
    setFbPageSaving(true);
    try {
      const res = await fetch("/api/social/facebook/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: fbSelectedPageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Unable to save Page");
      }
      setFbStatus((prev) => ({
        ...prev,
        connected: true,
        pageId: data.page?.pageId ?? fbSelectedPageId,
        pageName: data.page?.pageName ?? prev.pageName ?? null,
      }));
      pushToast("Facebook Page saved");
    } catch (err) {
      console.error("Failed to save Facebook page", err);
      pushToast("Could not save Facebook page", "error");
    } finally {
      setFbPageSaving(false);
    }
  };

  const toggleEmojiSelection = (emoji: string) => {
    setSelectedEmojis((prev) => (prev.includes(emoji) ? prev.filter((item) => item !== emoji) : [...prev, emoji]));
  };

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
    const safeQuoteType = form.quoteType === "image" ? "image" : "text";

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
          language: resolvedLanguage || "hi",
          style: form.style.trim() || null,
          count: safeCount,
          wordLimit: safeWordLimit,
          hook: trimmedHook || null,
          quoteType: safeQuoteType,
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
            quote_type: safeQuoteType,
            hook: trimmedHook || null,
            word_limit: safeWordLimit ?? null,
            image_quotes: safeQuoteType === "image" ? (body.quotes || []).map((q: string) => ({ text: q })) : null,
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
    const currentCount = extractQuoteList(editRow).length || 0;
    const rawWordLimit = Number(form.wordLimit);
    const safeWordLimit =
      Number.isFinite(rawWordLimit) && rawWordLimit > 0 ? Math.max(4, Math.min(rawWordLimit, 100)) : undefined;
    const baselineWordLimit = editRow.word_limit ?? defaultForm.wordLimit;
    const wordLimitChanged = typeof safeWordLimit === "number" && safeWordLimit !== baselineWordLimit;
    const safeQuoteType = form.quoteType === "image" ? "image" : "text";
    const quoteTypeChanged = (editRow.quote_type ?? "text") !== safeQuoteType;
    const shouldRegenerate =
      requestedCount !== currentCount || Boolean(trimmedHook) || wordLimitChanged || quoteTypeChanged;
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
          language: resolvedLanguage || "hi",
          style: form.style || null,
          count: shouldRegenerate ? requestedCount : undefined,
          wordLimit: typeof safeWordLimit === "number" ? safeWordLimit : undefined,
          hook: trimmedHook || null,
          quoteType: safeQuoteType,
          regenerate: shouldRegenerate,
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
          quote_type: safeQuoteType,
          hook: trimmedHook || null,
          word_limit: typeof safeWordLimit === "number" ? safeWordLimit : editRow.word_limit ?? null,
          quotes: editRow.quotes,
          image_quotes:
            safeQuoteType === "image"
              ? (body.quote?.image_quotes as Array<{ text: string }> | undefined) ?? extractQuoteList(editRow).map((text) => ({ text }))
              : null,
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
                quote_type: safeQuoteType,
                hook: trimmedHook || updated.hook || null,
                word_limit: safeWordLimit ?? updated.word_limit ?? null,
                image_quotes: updated.image_quotes ?? null,
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

            <table className="min-w-full text-left text-sm text-dark dark:text-dark-8">
              <thead className="bg-gray-1 text-xs font-semibold uppercase text-gray-6 dark:bg-dark-3 dark:text-dark-7">
                <tr>
                  <th className="px-4 py-3">Quotes</th>
                  <th className="px-4 py-3">Topic</th>
                  <th className="px-4 py-3">Tone</th>
                  <th className="px-4 py-3">Count</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-3 dark:divide-stroke-dark">
                {pagedRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-gray-6 dark:text-dark-6">
                      No quotes found for your search.
                    </td>
                  </tr>
                ) : (
                  pagedRows.map((row) => (
                    <tr key={row.id} className="hover:bg-gray-1/60 align-top dark:hover:bg-dark-3/70">
                      <td className="px-4 py-3 text-sm text-gray-7 dark:text-dark-7">
                        <div className="line-clamp-2 font-medium text-dark dark:text-dark-8">
                          {extractQuoteList(row)[0] || "—"}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase">
                          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary dark:bg-primary/20">
                            {row.persona || "Persona —"}
                          </span>
                          <span className="rounded-full bg-gray-2 px-3 py-1 text-gray-7 dark:bg-dark-3 dark:text-dark-8">
                            {labelForLanguage(row.language) || "Language —"}
                          </span>
                          <span className="rounded-full bg-gray-2 px-3 py-1 text-gray-7 dark:bg-dark-3 dark:text-dark-8">
                            {row.style || "Style —"}
                          </span>
                          <span className="rounded-full bg-gray-2 px-3 py-1 text-gray-7 dark:bg-dark-3 dark:text-dark-8">
                            {row.quote_type === "image" ? "Image" : "Text"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium text-dark dark:text-dark-8">{row.topic || "—"}</td>
                      <td className="px-4 py-3 text-gray-7 dark:text-dark-7">{row.tone || "—"}</td>
                      <td className="px-4 py-3 text-gray-7 dark:text-dark-7">{extractQuoteList(row).length}</td>
                      <td className="px-4 py-3 text-gray-6 dark:text-dark-6">
                        {new Date(row.created_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {publishJobs[row.id]?.status ? (
                          <span
                            title={publishJobs[row.id]?.last_error || undefined}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase",
                              publishJobs[row.id]?.status === "published" &&
                                "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-200",
                              publishJobs[row.id]?.status === "publishing" &&
                                "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
                              publishJobs[row.id]?.status === "queued" &&
                                "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200",
                              publishJobs[row.id]?.status === "failed" &&
                                "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-200",
                            )}
                          >
                            {publishJobs[row.id]?.status}
                          </span>
                        ) : (
                          <span className="text-gray-5 dark:text-dark-6">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2 text-xs font-semibold">
                          <button
                            className="rounded-md border border-gray-3 px-3 py-1 text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                            onClick={() => {
                              setDetailRow(row);
                            }}
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
                                count: extractQuoteList(row).length || row.quotes?.length || 5,
                                wordLimit: row.word_limit ?? defaultForm.wordLimit,
                                hook: row.hook ?? "",
                                quoteType: row.quote_type ?? "text",
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
            <div className="mt-4 max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-card-2 dark:bg-dark-2 dark:border dark:border-stroke-dark">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
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
                  <span>Quote format</span>
                  <span className="text-xs font-normal text-gray-6 dark:text-dark-6">(text or image overlay)</span>
                </div>
                <div className="mt-2 flex gap-2">
                  {[
                    { value: "text", label: "Text" },
                    { value: "image", label: "Image" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`flex-1 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                        form.quoteType === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-gray-3 bg-white text-gray-7 hover:bg-gray-1 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                      }`}
                      onClick={() => setForm((prev) => ({ ...prev, quoteType: option.value as "text" | "image" }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </label>

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

            <hr className="mt-6 mb-4 border-t border-gray-3 dark:border-stroke-dark" />

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  className="flex w-full items-center justify-center rounded-xl border border-gray-3 px-4 py-3 text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3 disabled:opacity-60 sm:w-1/2"
                  onClick={() => {
                    setShowModal(false);
                    setEditRow(null);
                    setForm({ ...defaultForm });
                    setSubmitStatus({ type: "idle" });
                    setLanguageQuery(labelForLanguage(defaultForm.language));
                  }}
                  disabled={submitStatus.type === "loading"}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  onClick={(e) => {
                    if (editRow) {
                      e.preventDefault();
                      handleUpdate();
                    }
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70 sm:w-1/2"
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
              </div>
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
            <div className="mt-4 flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-card-2 dark:border dark:border-stroke-dark dark:bg-dark-2">
              <div className="mb-4 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Quote pack</p>
                    <h2 className="text-xl font-bold text-dark dark:text-dark-8">{detailRow.topic || "Quote details"}</h2>
                    <p className="text-sm text-gray-6 dark:text-dark-6">
                      Tone: {detailRow.tone || "—"} · Persona: {detailRow.persona || "—"} · Language:{" "}
                      {detailRow.language || "—"}
                    </p>
                    {buildHashtags(detailRow).length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {buildHashtags(detailRow).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-gray-3 bg-gray-1 px-3 py-1 text-[11px] font-semibold text-gray-7 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-7"
                          >
                            {tag}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              const tags = buildHashtags(detailRow).join(" ");
                              await navigator.clipboard.writeText(tags);
                              pushToast("Hashtags copied");
                            } catch (err) {
                              console.error("Failed to copy hashtags", err);
                              pushToast("Failed to copy hashtags", "error");
                            }
                          }}
                          className="rounded-md border border-gray-3 px-3 py-1 text-xs font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-3"
                        >
                          Copy hashtags
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailRow(null)}
                      className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div className="w-full rounded-xl border border-gray-3 bg-gray-1 p-3 text-xs font-semibold text-gray-7 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-7">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] uppercase tracking-wide text-gray-6 dark:text-dark-6">Emojis</span>
                    <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-6 dark:text-dark-6">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={autoEmojis}
                        onChange={(e) => setAutoEmojis(e.target.checked)}
                      />
                      Auto by topic/tone
                    </label>
                  </div>
                  {autoEmojiList.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {autoEmojiList.map((emoji) => (
                        <span
                          key={`auto-${emoji}`}
                          className="rounded-full border border-gray-3 bg-white px-2.5 py-1 text-sm dark:border-stroke-dark dark:bg-dark-2"
                          title="Auto suggestion"
                        >
                          {emoji}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {combinedEmojis.length === 0 && (
                      <span className="text-[11px] text-gray-5 dark:text-dark-6">No emojis selected yet.</span>
                    )}
                    {selectedEmojis.map((emoji) => (
                      <button
                        key={`selected-${emoji}`}
                        type="button"
                        onClick={() => toggleEmojiSelection(emoji)}
                        className="flex items-center gap-1 rounded-full border border-gray-3 bg-white px-2.5 py-1 text-sm transition hover:bg-gray-2 dark:border-stroke-dark dark:bg-dark-2 dark:hover:bg-dark-4"
                        aria-label={`Remove ${emoji}`}
                      >
                        <span>{emoji}</span>
                        <span className="text-[11px] text-gray-5">×</span>
                      </button>
                    ))}
                    {selectedEmojis.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedEmojis([])}
                        className="rounded-full border border-gray-3 px-3 py-1 text-[11px] font-semibold text-gray-6 transition hover:bg-gray-2 dark:border-stroke-dark dark:text-dark-7 dark:hover:bg-dark-4"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {emojiPresets.map((emoji) => (
                      <button
                        key={`preset-${emoji}`}
                        type="button"
                        onClick={() => toggleEmojiSelection(emoji)}
                        className="rounded-full border border-gray-3 bg-white px-2.5 py-1 text-sm transition hover:bg-gray-2 dark:border-stroke-dark dark:bg-dark-2 dark:hover:bg-dark-4"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm text-dark dark:text-dark-8">
                  {detailRow.quotes && detailRow.quotes.length > 0 ? (
                    detailRow.quote_type === "image" ? (
                      <div className="grid gap-4 md:grid-cols-[1.4fr_1fr]">
                        <div className="sticky top-3 h-fit space-y-3 rounded-xl border border-gray-3 bg-gray-1 p-3 text-xs font-semibold text-dark shadow-sm dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-8">
                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-6 dark:text-dark-6">Font</p>
                            <select
                              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm font-semibold text-dark dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-8"
                              value={imageStyle.fontFamily}
                              onChange={(e) =>
                                setImageStyle((prev) => ({
                                  ...prev,
                                  fontFamily: e.target.value,
                                }))
                              }
                            >
                              {fontOptions.map((font) => (
                                <option key={font.value} value={font.value}>
                                  {font.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-6 dark:text-dark-6">Font Size</p>
                            <input
                              type="range"
                              min={24}
                              max={72}
                              value={imageStyle.fontSize}
                              onChange={(e) =>
                                setImageStyle((prev) => ({
                                  ...prev,
                                  fontSize: Number(e.target.value),
                                }))
                              }
                              className="w-full accent-primary"
                            />
                            <div className="text-[11px] text-gray-6 dark:text-dark-6">Size: {imageStyle.fontSize}px</div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-6 dark:text-dark-6">Canvas Size</p>
                            <select
                              className="w-full rounded-lg border border-gray-3 bg-white px-3 py-2 text-sm font-semibold text-dark dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-8"
                              value={imageSizeKey}
                              onChange={(e) => setImageSizeKey(e.target.value as ImageSizeKey)}
                              >
                                {Object.entries(imageSizePresets).map(([key, val]) => (
                                  <option key={key} value={key}>
                                    {val.label}
                                  </option>
                                ))}
                              </select>
                            <p className="text-[11px] text-gray-6 dark:text-dark-6">
                              Tip: use <span className="font-semibold text-primary">Mobile Portrait</span> for phones or{" "}
                              <span className="font-semibold text-primary">Instagram Square</span> for feed posts.
                            </p>
                            {imageSizeKey === "custom" && (
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-7 dark:text-dark-7">
                                  <span className="min-w-[36px] text-right">W</span>
                                  <input
                                    type="number"
                                    min={320}
                                    max={4000}
                                    value={customSize.width}
                                    onChange={(e) =>
                                      setCustomSize((prev) => ({
                                        ...prev,
                                        width: Number(e.target.value),
                                      }))
                                    }
                                    className="w-full rounded-md border border-gray-3 bg-white px-2 py-1 text-sm font-semibold text-dark outline-none dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-8"
                                  />
                                </label>
                                <label className="flex items-center gap-2 text-[11px] font-semibold text-gray-7 dark:text-dark-7">
                                  <span className="min-w-[36px] text-right">H</span>
                                  <input
                                    type="number"
                                    min={320}
                                    max={4000}
                                    value={customSize.height}
                                    onChange={(e) =>
                                      setCustomSize((prev) => ({
                                        ...prev,
                                        height: Number(e.target.value),
                                      }))
                                    }
                                    className="w-full rounded-md border border-gray-3 bg-white px-2 py-1 text-sm font-semibold text-dark outline-none dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-8"
                                  />
                                </label>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-6 dark:text-dark-6">Text Align</p>
                            <div className="flex gap-2">
                              {(["left", "center", "right"] as CanvasTextAlign[]).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() =>
                                    setImageStyle((prev) => ({
                                      ...prev,
                                      textAlign: align,
                                    }))
                                  }
                                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                                    imageStyle.textAlign === align
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-gray-3 bg-white text-gray-7 hover:bg-gray-1 dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-7 dark:hover:bg-dark-4"
                                  }`}
                                >
                                  {align}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-6 dark:text-dark-6">Overlay</p>
                            <input
                              type="range"
                              min={0.2}
                              max={0.8}
                              step={0.05}
                              value={imageStyle.overlayOpacity}
                              onChange={(e) =>
                                setImageStyle((prev) => ({
                                  ...prev,
                                  overlayOpacity: Number(e.target.value),
                                }))
                              }
                              className="w-full accent-primary"
                            />
                            <div className="text-[11px] text-gray-6 dark:text-dark-6">
                              Darkness: {(imageStyle.overlayOpacity * 100).toFixed(0)}%
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-6 dark:text-dark-6">Background</p>
                            <div className="flex gap-2">
                              {[
                                { value: "texture", label: "Texture" },
                                { value: "solid", label: "Solid" },
                                { value: "gradient", label: "Gradient" },
                              ].map((bg) => (
                                <button
                                  key={bg.value}
                                  type="button"
                                  onClick={() =>
                                    setImageStyle((prev) => ({
                                      ...prev,
                                      backgroundType: bg.value as ImageStyle["backgroundType"],
                                    }))
                                  }
                                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${
                                    imageStyle.backgroundType === bg.value
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-gray-3 bg-white text-gray-7 hover:bg-gray-1 dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-7 dark:hover:bg-dark-4"
                                  }`}
                                >
                                  {bg.label}
                                </button>
                              ))}
                            </div>

                            {imageStyle.backgroundType === "texture" && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {imageBackgrounds.map((src) => (
                                  <button
                                    key={src}
                                    type="button"
                                    onClick={() =>
                                      setImageStyle((prev) => ({
                                        ...prev,
                                        backgroundValue: src,
                                      }))
                                    }
                                    className={`h-12 w-16 overflow-hidden rounded-md border ${
                                      imageStyle.backgroundValue === src ? "border-primary ring-2 ring-primary/30" : "border-gray-3"
                                    }`}
                                    style={{
                                      backgroundImage: `url(${src})`,
                                      backgroundSize: "cover",
                                      backgroundPosition: "center",
                                    }}
                                  />
                                ))}
                              </div>
                            )}

                            {imageStyle.backgroundType === "solid" && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {solidOptions.map((color) => (
                                  <button
                                    key={color}
                                    type="button"
                                    onClick={() =>
                                      setImageStyle((prev) => ({
                                        ...prev,
                                        backgroundValue: color,
                                      }))
                                    }
                                    className={`h-10 w-10 rounded-md border ${
                                      imageStyle.backgroundValue === color ? "border-primary ring-2 ring-primary/40" : "border-gray-3"
                                    }`}
                                    style={{ backgroundColor: color }}
                                  />
                                ))}
                              </div>
                            )}

                            {imageStyle.backgroundType === "gradient" && (
                              <div className="mt-2 grid grid-cols-2 gap-2">
                                {gradientOptions.map((grad) => (
                                  <button
                                    key={grad.label}
                                    type="button"
                                    onClick={() =>
                                      setImageStyle((prev) => ({
                                        ...prev,
                                        gradientColors: grad.colors,
                                      }))
                                    }
                                    className={`h-14 rounded-md border ${
                                      imageStyle.gradientColors?.[0] === grad.colors[0] &&
                                      imageStyle.gradientColors?.[1] === grad.colors[1]
                                        ? "border-primary ring-2 ring-primary/30"
                                        : "border-gray-3"
                                    }`}
                                    style={{
                                      backgroundImage: `linear-gradient(135deg, ${grad.colors[0]}, ${grad.colors[1]})`,
                                    }}
                                  >
                                    <span className="text-xs font-semibold text-white drop-shadow">{grad.label}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wide text-gray-6 dark:text-dark-6">Text Color</p>
                            <div className="flex flex-wrap gap-2">
                              {["#fdfdfd", "#000000", "#f7c948", "#f472b6", "#38bdf8", "#22c55e", "#f97316", "#e5e7eb"].map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  onClick={() =>
                                    setImageStyle((prev) => ({
                                      ...prev,
                                      color,
                                    }))
                                  }
                                  className={`h-9 w-9 rounded-full border-2 ${
                                    imageStyle.color === color ? "border-primary ring-2 ring-primary/40" : "border-gray-3"
                                  }`}
                                  style={{ backgroundColor: color }}
                                />
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex flex-col gap-4">
                            {extractQuoteList(detailRow)
                              .filter(Boolean)
                              .map((q, idx) => (
                                <div
                                  key={`${idx}-${q.slice(0, 12)}`}
                                  className="relative w-full overflow-hidden rounded-xl border border-gray-3 bg-gray-1 shadow-sm dark:border-stroke-dark dark:bg-dark-3"
                                  style={{
                                    ...backgroundCss(imageStyle, detailRow.id),
                                    aspectRatio: `${previewDims.width}/${previewDims.height}`,
                                    minHeight: `${Math.max(
                                      160,
                                      Math.round(320 * (previewDims.height / previewDims.width)),
                                    )}px`,
                                  }}
                >
                  <div className="absolute right-2 top-2 flex gap-1">
                    <button
                      type="button"
                      aria-label="Copy quote"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(q);
                          setCopiedIdx(idx);
                          setTimeout(() => setCopiedIdx((prev) => (prev === idx ? null : prev)), 1200);
                          pushToast("Quote copied");
                        } catch (err) {
                          console.error("Failed to copy quote", err);
                          pushToast("Failed to copy quote", "error");
                        }
                      }}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/60 bg-white/20 text-white transition hover:bg-white/30"
                    >
                                      {copiedIdx === idx ? (
                                        <CheckIcon className="h-4 w-4 text-green-200" />
                                      ) : (
                                        <CopyIcon className="h-4 w-4" />
                                      )}
                                    </button>
                                    <div className="relative">
                                      <button
                                        type="button"
                                        aria-label="Share quote image"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setShareMenuPosition(event.currentTarget);
                                          setShareMenuId((prev) => (prev === `image-${idx}` ? null : `image-${idx}`));
                                        }}
                                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/60 bg-white/20 text-white transition hover:bg-white/30"
                                      >
                                        {shareIdx === idx ? (
                                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                        ) : (
                                          "⇪"
                                        )}
                                      </button>
                                      {shareMenuId === `image-${idx}` && shareMenuPos && (
                                        <ModalPortal>
                                          <div
                                            onClick={(event) => event.stopPropagation()}
                                            className="fixed z-[20001] w-44 rounded-lg border border-white/40 bg-white/95 p-2 text-xs font-semibold text-gray-7 shadow-lg backdrop-blur dark:border-stroke-dark dark:bg-dark-2"
                                            style={{ top: shareMenuPos.top, left: shareMenuPos.left }}
                                          >
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setShareMenuId(null);
                                              handleShareImage(detailRow, q, idx, detailRow.id);
                                            }}
                                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:bg-gray-1 dark:hover:bg-dark-3"
                                          >
                                            Device share
                                          </button>
                                        {facebookEnabled && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setShareMenuId(null);
                                              handleFacebookShareRequest(detailRow.id, q, detailRow, detailRow.id);
                                            }}
                                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:bg-gray-1 dark:hover:bg-dark-3"
                                          >
                                            Facebook
                                          </button>
                                            )}
                                            {instagramEnabled && (
                                              <button
                                                type="button"
                                                disabled
                                                className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-left opacity-60"
                                              >
                                                Instagram
                                              </button>
                                            )}
                                            {linkedinEnabled && (
                                              <button
                                                type="button"
                                                disabled
                                                className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-left opacity-60"
                                              >
                                                LinkedIn
                                              </button>
                                            )}
                                          </div>
                                        </ModalPortal>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      aria-label="Download quote image"
                                      onClick={async () => {
                                        setDownloadIdx(idx);
                                        try {
                                          const dims = selectedDimensions();
                                          await generateImageQuotePng({
                                            text: q,
                                            background: resolveBackground(imageStyle, detailRow.id),
                                            style: imageStyle,
                                            dimensions: dims,
                                            fileName: `quote-${idx + 1}.png`,
                                          });
                                        } catch (err) {
                                          console.error("Failed to download quote image", err);
                                          setSubmitStatus({
                                            type: "error",
                                            message: "Could not download quote image.",
                                          });
                                        } finally {
                                          setDownloadIdx((prev) => (prev === idx ? null : prev));
                                        }
                                      }}
                                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-white/60 bg-white/20 text-white transition hover:bg-white/30"
                                    >
                                      {downloadIdx === idx ? (
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                      ) : (
                                        "⬇"
                                      )}
                                    </button>
                                  </div>
                                  <div className="flex h-full items-center px-4 py-6">
                                    <p
                                      className="whitespace-pre-line break-words text-base font-semibold leading-snug drop-shadow"
                                      style={{
                                        color: imageStyle.color,
                                        fontFamily: imageStyle.fontFamily,
                                        fontSize: imageStyle.fontSize,
                                        textAlign: imageStyle.textAlign,
                                        width: "100%",
                                        maxWidth: "82%",
                                        margin: "0 auto",
                                      }}
                                    >
                                      {q}
                                    </p>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <ol className="space-y-2">
                        {extractQuoteList(detailRow)
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
                              <div className="flex gap-2">
                                <div className="relative">
                                  <button
                                    type="button"
                                    aria-label="Share quote"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setShareMenuPosition(event.currentTarget);
                                      setShareMenuId((prev) => (prev === `text-${idx}` ? null : `text-${idx}`));
                                    }}
                                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-3 bg-white text-gray-6 transition hover:bg-gray-2 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                                  >
                                    ⇪
                                  </button>
                                  {shareMenuId === `text-${idx}` && shareMenuPos && (
                                    <ModalPortal>
                                      <div
                                        onClick={(event) => event.stopPropagation()}
                                        className="fixed z-[20001] w-44 rounded-lg border border-gray-3 bg-white p-2 text-xs font-semibold text-gray-7 shadow-lg dark:border-stroke-dark dark:bg-dark-2 dark:text-dark-7"
                                        style={{ top: shareMenuPos.top, left: shareMenuPos.left }}
                                      >
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setShareMenuId(null);
                                            handleShareText(detailRow, q);
                                          }}
                                          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:bg-gray-1 dark:hover:bg-dark-3"
                                        >
                                          Device share
                                        </button>
                                        {facebookEnabled && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setShareMenuId(null);
                                              handleFacebookShareRequest(detailRow.id, q, detailRow, detailRow.id);
                                            }}
                                            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition hover:bg-gray-1 dark:hover:bg-dark-3"
                                          >
                                            Facebook
                                          </button>
                                        )}
                                        {instagramEnabled && (
                                          <button
                                            type="button"
                                            disabled
                                            className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-left opacity-60"
                                          >
                                            Instagram
                                          </button>
                                        )}
                                        {linkedinEnabled && (
                                          <button
                                            type="button"
                                            disabled
                                            className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-left opacity-60"
                                          >
                                            LinkedIn
                                          </button>
                                        )}
                                      </div>
                                    </ModalPortal>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  aria-label="Copy quote"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(q);
                                      setCopiedIdx(idx);
                                      setTimeout(() => setCopiedIdx((prev) => (prev === idx ? null : prev)), 1200);
                                      pushToast("Quote copied");
                                    } catch (err) {
                                      console.error("Failed to copy quote", err);
                                      pushToast("Failed to copy quote", "error");
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
                              </div>
                            </li>
                          ))}
                      </ol>
                    )
                  ) : (
                    <p className="text-gray-6 dark:text-dark-6">No quotes available.</p>
                  )}
              </div>
            </div>
          </div>
        </ModalPortal>
      )}

      {fbSharePickerOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/60 px-4 py-12"
            role="dialog"
            aria-modal="true"
          >
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-card-2 dark:border dark:border-stroke-dark dark:bg-dark-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">Facebook</p>
                  <h2 className="text-lg font-bold text-dark dark:text-dark-8">Choose a Page</h2>
                  <p className="text-sm text-gray-6 dark:text-dark-6">Select the page to publish this quote.</p>
                </div>
                <button
                  type="button"
                    onClick={() => {
                      setFbSharePickerOpen(false);
                      setFbSharePages([]);
                      setFbShareQuoteId(null);
                      setFbShareCaption(null);
                      setFbShareImageDataUrl(null);
                    }}
                    className="rounded-full bg-gray-1 px-3 py-1 text-sm font-semibold text-gray-7 hover:bg-gray-2 dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                  >
                    Close
                </button>
              </div>
              <div className="mt-4 space-y-2">
                {fbSharePages.map((page) => (
                  <button
                    key={page.id}
                    type="button"
                    onClick={async () => {
                      if (!fbShareQuoteId) return;
                      if (!fbShareCaption || !fbShareImageDataUrl) {
                        pushToast("Unable to render share image.", "error");
                        return;
                      }
                      try {
                        await markFacebookPageActive(page.id);
                        await queuePublishToFacebook(fbShareQuoteId);
                        const runRes = await fetch("/api/publish/run-now", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            quote_id: fbShareQuoteId,
                            caption: fbShareCaption,
                            imageDataUrl: fbShareImageDataUrl,
                          }),
                        });
                        const runBody = await runRes.json().catch(() => ({}));
                        if (!runRes.ok) {
                          throw new Error(runBody?.error || "Unable to publish now.");
                        }
                        pushToast(`Published to ${page.name}`);
                        setFbSharePickerOpen(false);
                        setFbSharePages([]);
                        setFbShareQuoteId(null);
                        setFbShareCaption(null);
                        setFbShareImageDataUrl(null);
                      } catch (err) {
                        pushToast((err as Error).message || "Unable to publish", "error");
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-lg border border-gray-3 px-3 py-2 text-left text-sm font-semibold text-gray-7 transition hover:bg-gray-1 dark:border-stroke-dark dark:bg-dark-3 dark:text-dark-7 dark:hover:bg-dark-4"
                  >
                    <span>{page.name}</span>
                    <span className="text-xs text-gray-5">{page.id}</span>
                  </button>
                ))}
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
            <div className="mt-4 w-full max-w-xl rounded-2xl bg-white p-6 shadow-card-2 dark:border dark:border-stroke-dark dark:bg-dark-2">
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

      {toast && (
        <ModalPortal>
          <div
            className={`fixed top-4 right-4 z-[50000] rounded-lg border px-4 py-3 text-sm shadow-lg transition dark:border-stroke-dark ${
              toast.type === "success"
                ? "border-green-200 bg-white text-green-800 dark:bg-dark-2 dark:text-green-200 dark:border-green-500/40"
                : "border-red-200 bg-white text-red-700 dark:bg-dark-2 dark:text-red-200 dark:border-red-500/40"
            }`}
            role="status"
            aria-live="polite"
          >
            {toast.message}
          </div>
        </ModalPortal>
      )}
    </div>
  );
}
