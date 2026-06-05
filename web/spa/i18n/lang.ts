// Single source of truth for app languages and reference-entity name
// resolution. Shared by the website and the onboarding wizard.

export const APP_LANGS = [
  "en",
  "uk",
  "ru",
  "it",
  "pt",
  "de",
  "fr",
  "tr",
  "es",
] as const;
export type AppLang = (typeof APP_LANGS)[number];

// Self-name per language (for accessible labels / screen readers).
export const LANG_ENDONYM: Record<AppLang, string> = {
  en: "English",
  uk: "Українська",
  ru: "Русский",
  it: "Italiano",
  pt: "Português",
  de: "Deutsch",
  fr: "Français",
  tr: "Türkçe",
  es: "Español",
};

// Always-present primary languages. RU is intentionally NOT primary —
// it lives in the "other languages" disclosure (still label-only there).
const PERMANENT: readonly string[] = ["en", "uk"];

// The one contextual slot: the user's system language iff it is one of
// ours and not already primary, and never RU (RU stays in "other").
export function contextualLang(sysRaw?: string | null): AppLang | null {
  if (!sysRaw) return null;
  const sys = sysRaw.toLowerCase().split(/[-_]/)[0];
  if (!(APP_LANGS as readonly string[]).includes(sys)) return null;
  if (PERMANENT.includes(sys) || sys === "ru") return null;
  return sys as AppLang;
}

// Primary visible set (2 or 3): en, uk, [contextual].
export function primaryLangs(sysRaw?: string | null): AppLang[] {
  const c = contextualLang(sysRaw);
  return (["en", "uk", c] as (AppLang | null)[]).filter(
    (x): x is AppLang => x != null
  );
}

// Everything else, reachable via the disclosure.
export function hiddenLangs(sysRaw?: string | null): AppLang[] {
  const p = new Set(primaryLangs(sysRaw));
  return APP_LANGS.filter((x) => !p.has(x));
}

// Per the project decision, Russian is shown WITHOUT a flag (text label).
export const LANG_OPTIONS: { code: AppLang; label: string }[] = [
  { code: "en", label: "🇬🇧 EN" },
  { code: "uk", label: "🇺🇦 UA" },
  { code: "ru", label: "RU" },
  { code: "it", label: "🇮🇹 IT" },
  { code: "pt", label: "🇵🇹 PT" },
  { code: "de", label: "🇩🇪 DE" },
  { code: "fr", label: "🇫🇷 FR" },
  { code: "tr", label: "🇹🇷 TR" },
  { code: "es", label: "🇪🇸 ES" },
];

// Legacy data uses "ua"; the app uses "uk". Treat them as the same key.
function readKey(name: Record<string, unknown>, key: string): string {
  const direct = name[key];
  if (typeof direct === "string" && direct.trim()) return direct;
  if (key === "uk" && typeof name["ua"] === "string" && (name["ua"] as string).trim())
    return name["ua"] as string;
  if (key === "ua" && typeof name["uk"] === "string" && (name["uk"] as string).trim())
    return name["uk"] as string;
  return "";
}

// Resolve a localized name from a {en,uk/ua,ru,it,pt,de,fr,tr,...} object
// with a deterministic fallback chain so nothing ever renders blank, even
// before a translation exists: requested → en → uk → any non-empty → id.
export function localizedName(
  name: unknown,
  lang: string,
  fallbackId?: string
): string {
  if (!name || typeof name !== "object") return fallbackId ?? "";
  const obj = name as Record<string, unknown>;
  const chain = [lang, "en", "uk", "ru", "it", "pt", "de", "fr", "tr", "es"];
  for (const l of chain) {
    const v = readKey(obj, l);
    if (v) return v;
  }
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return fallbackId ?? "";
}
