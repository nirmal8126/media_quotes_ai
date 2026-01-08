export type LanguageOption = {
  code: string;
  label: string;
};

export const DEFAULT_LANGUAGE = "hi";

export const languageOptions: LanguageOption[] = [
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

export function resolveLanguageCode(input?: string | null) {
  const normalized = (input ?? "").trim().toLowerCase();
  if (!normalized || normalized === "choose a language...") return DEFAULT_LANGUAGE;

  const direct = languageOptions.find((lang) => lang.code.toLowerCase() === normalized);
  if (direct) return direct.code;

  const byLabel = languageOptions.find((lang) => lang.label.toLowerCase() === normalized);
  return byLabel?.code ?? DEFAULT_LANGUAGE;
}

export function labelForLanguage(input?: string | null) {
  if (!input) return "";
  const normalized = input.trim().toLowerCase();
  const found = languageOptions.find(
    (lang) => lang.code.toLowerCase() === normalized || lang.label.toLowerCase() === normalized,
  );
  return found?.label ?? input;
}
