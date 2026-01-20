export type ReelPresetConfig = {
  key: string;
  label: string;
  background: {
    color: string;
    overlay?: string | null;
  };
  text: {
    font: string;
    color: string;
    shadow?: string | null;
    boxColor?: string | null;
  };
  textAnimation: string;
  palette: {
    accent: string;
    secondary: string;
  };
};

const PRESETS: ReelPresetConfig[] = [
  {
    key: "quote_minimal",
    label: "Quote Minimal",
    background: { color: "#0f172a", overlay: "rgba(15,23,42,0.45)" },
    text: { font: "Inter, Arial, sans-serif", color: "#f8fafc", boxColor: "rgba(0,0,0,0.35)" },
    textAnimation: "fade-scale",
    palette: { accent: "#22d3ee", secondary: "#94a3b8" },
  },
  {
    key: "quote_bold",
    label: "Quote Bold",
    background: { color: "#111827", overlay: "rgba(15,23,42,0.5)" },
    text: { font: "Poppins, Arial, sans-serif", color: "#ffffff", boxColor: "rgba(17,24,39,0.55)" },
    textAnimation: "pop",
    palette: { accent: "#f97316", secondary: "#fcd34d" },
  },
  {
    key: "quote_neon",
    label: "Quote Neon",
    background: { color: "#020617", overlay: "rgba(14,116,144,0.28)" },
    text: { font: "Orbitron, Arial, sans-serif", color: "#e0f2fe", boxColor: "rgba(14,116,144,0.45)" },
    textAnimation: "glow",
    palette: { accent: "#38bdf8", secondary: "#818cf8" },
  },
  {
    key: "quote_dark",
    label: "Quote Dark",
    background: { color: "#0b0f19", overlay: "rgba(2,6,23,0.6)" },
    text: { font: "Merriweather Sans, Arial, sans-serif", color: "#e2e8f0", boxColor: "rgba(2,6,23,0.65)" },
    textAnimation: "fade",
    palette: { accent: "#f43f5e", secondary: "#64748b" },
  },
  {
    key: "quote_aesthetic",
    label: "Quote Aesthetic",
    background: { color: "#1f2937", overlay: "rgba(30,41,59,0.4)" },
    text: { font: "Playfair Display, Georgia, serif", color: "#fef3c7", boxColor: "rgba(15,23,42,0.4)" },
    textAnimation: "float",
    palette: { accent: "#f9a8d4", secondary: "#fcd34d" },
  },
  {
    key: "quote_glass",
    label: "Quote Glass",
    background: { color: "#0f172a", overlay: "rgba(148,163,184,0.2)" },
    text: { font: "Inter, Arial, sans-serif", color: "#f8fafc", boxColor: "rgba(15,23,42,0.35)" },
    textAnimation: "fade-scale",
    palette: { accent: "#38bdf8", secondary: "#e2e8f0" },
  },
  {
    key: "quote_kids",
    label: "Quote Kids",
    background: { color: "#312e81", overlay: "rgba(67,56,202,0.3)" },
    text: { font: "Comic Sans MS, Trebuchet MS, Arial, sans-serif", color: "#fef9c3", boxColor: "rgba(30,27,75,0.35)" },
    textAnimation: "bounce",
    palette: { accent: "#facc15", secondary: "#fb7185" },
  },
  {
    key: "quote_cartoon_text",
    label: "Quote Cartoon Text",
    background: { color: "#1e293b", overlay: "rgba(56,189,248,0.2)" },
    text: { font: "Bangers, Impact, Arial, sans-serif", color: "#f8fafc", boxColor: "rgba(15,23,42,0.5)" },
    textAnimation: "pop",
    palette: { accent: "#f97316", secondary: "#38bdf8" },
  },
];

export function listPresets() {
  return PRESETS.map((preset) => ({ key: preset.key, label: preset.label }));
}

export function resolvePreset(options: { template?: string | null; style?: string | null; platform?: string | null }) {
  const fallback = (process.env.DEFAULT_REEL_PRESET || "quote_minimal").trim();
  const key = (options.template || options.style || fallback).toString().trim().toLowerCase();
  const match = PRESETS.find((preset) => preset.key === key);
  if (match) return match;
  return PRESETS[0];
}
