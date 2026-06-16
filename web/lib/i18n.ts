import type { LocName } from "./api";

// Supported locales. The URL is the single source of truth for language —
// every locale here is a real, indexed /[lang]/... route. The data layer is
// language-agnostic, so adding a locale = adding it here + authoring its copy.
export const LANGS = ["uk", "ru", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "uk";

export function isLang(x: string): x is Lang {
  return (LANGS as readonly string[]).includes(x);
}

// Content gate for English. While false, `en` routes still render and are
// reachable via the language switcher, but are excluded from the sitemap +
// hreflang and marked noindex per page — so we never publish thin/duplicate
// pages. One switch drives sitemap inclusion, hreflang inclusion, and the
// per-page robots flag. Flip to true once English template copy is authored.
// 2026-06-16: set false for launch — EN body copy is still template-thin, so we
// keep /en routes reachable but out of the index to avoid thin duplicate pages.
export const EN_INDEXED = false;

// Locales advertised to crawlers (sitemap entries + hreflang alternates).
// While `en` is gated it stays out of this list but its routes still render.
export const INDEXED_LANGS: readonly Lang[] = EN_INDEXED
  ? LANGS
  : LANGS.filter((l) => l !== "en");

// Whether a locale should be indexed. Drives the per-page `robots` flag — a
// gated locale renders but is marked noindex,follow (keeps link equity flowing
// while keeping thin pages out of the index).
export function isIndexable(lang: Lang): boolean {
  return lang !== "en" || EN_INDEXED;
}

// Map a UI lang to the key used in the API's localized name objects.
// The API uses `ua` for Ukrainian. Nominative vs prepositional:
//   nominative  → ua / ru
//   prepositional → ua_alt / ru_alt   (e.g. Milan → "Мілані" / "Милане")
const NAME_KEY: Record<Lang, keyof LocName> = { uk: "ua", ru: "ru", en: "en" };
// English has no case system, so there's no prepositional variant — fall back to
// the nominative `en` key (prepName already degrades to nomName when missing).
const PREP_KEY: Record<Lang, keyof LocName> = {
  uk: "ua_alt",
  ru: "ru_alt",
  en: "en",
};

export function nomName(name: LocName | undefined, lang: Lang): string {
  return name?.[NAME_KEY[lang]] ?? name?.en ?? "";
}
export function prepName(name: LocName | undefined, lang: Lang): string {
  return name?.[PREP_KEY[lang]] ?? nomName(name, lang);
}

export const HTML_LANG: Record<Lang, string> = { uk: "uk", ru: "ru", en: "en" };
export const OG_LOCALE: Record<Lang, string> = {
  uk: "uk_UA",
  ru: "ru_RU",
  en: "en_US",
};

// ── Pluralization (RU & UK share the one/few/many rule) ───────────────────────
export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && !(m100 >= 12 && m100 <= 14)) return forms[1];
  return forms[2];
}

const MASTER_FORMS: Record<Lang, [string, string, string]> = {
  ru: ["мастер", "мастера", "мастеров"],
  uk: ["майстер", "майстри", "майстрів"],
  en: ["master", "masters", "masters"],
};

/** "24 мастера" / "1 майстер" / "24 masters". English uses the simple
 *  singular/plural rule, not the Slavic one/few/many forms. */
export function mastersCount(n: number, lang: Lang): string {
  if (lang === "en") return `${n} ${n === 1 ? "master" : "masters"}`;
  return `${n} ${plural(n, MASTER_FORMS[lang])}`;
}

// ── UI strings ────────────────────────────────────────────────────────────────
type Dict = Record<string, string>;
export const T: Record<Lang, Dict> = {
  ru: {
    home: "Главная",
    italy: "Италия",
    bookTelegram: "Записаться в Telegram",
    viewProfile: "Открыть профиль",
    allMasters: "Все мастера",
    otherCities: "В других городах",
    otherProfessions: "Другие специалисты в",
    inCity: "в",
    speaksNote: "Все мастера говорят по-русски и по-украински",
    noContactNote: "Контакты открываются в профиле на Majstr",
    free: "Бесплатно · без посредников",
    faqTitle: "Частые вопросы",
    masonryTagline: "Каталог русскоязычных мастеров в Италии",
    professionsIn: "Специалисты в",
    citiesFor: "Города",
    backToCity: "Все специалисты города",
  },
  uk: {
    home: "Головна",
    italy: "Італія",
    bookTelegram: "Записатися в Telegram",
    viewProfile: "Відкрити профіль",
    allMasters: "Усі майстри",
    otherCities: "В інших містах",
    otherProfessions: "Інші майстри у",
    inCity: "у",
    speaksNote: "Усі майстри говорять українською та російською",
    noContactNote: "Контакти відкриваються в профілі на Majstr",
    free: "Безкоштовно · без посередників",
    faqTitle: "Часті запитання",
    masonryTagline: "Каталог україномовних майстрів в Італії",
    professionsIn: "Майстри у",
    citiesFor: "Міста",
    backToCity: "Усі майстри міста",
  },
  en: {
    home: "Home",
    italy: "Italy",
    bookTelegram: "Book on Telegram",
    viewProfile: "Open profile",
    allMasters: "All masters",
    otherCities: "In other cities",
    otherProfessions: "Other specialists in",
    inCity: "in",
    speaksNote: "All masters speak Ukrainian and Russian",
    noContactNote: "Contacts open in the profile on Majstr",
    free: "Free · no middlemen",
    faqTitle: "Frequently asked questions",
    masonryTagline: "Directory of Ukrainian- and Russian-speaking masters in Italy",
    professionsIn: "Specialists in",
    citiesFor: "Cities",
    backToCity: "All specialists in the city",
  },
};
