import type { LocName } from "./api";

// SEO content languages. uk + ru are the launch targets; the data layer is
// language-agnostic so more can be added.
export const LANGS = ["uk", "ru"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "uk";

export function isLang(x: string): x is Lang {
  return (LANGS as readonly string[]).includes(x);
}

// The UI offers ~9 languages, but only uk/ru have SEO routes. Map any UI
// language to a valid URL locale so navigation never builds a 404 path like
// /en/medicine. RU stays RU; everything else falls back to the default (uk).
export function urlLang(x: string): Lang {
  return x === "ru" ? "ru" : DEFAULT_LANG;
}

// Map a UI lang to the key used in the API's localized name objects.
// The API uses `ua` for Ukrainian. Nominative vs prepositional:
//   nominative  → ua / ru
//   prepositional → ua_alt / ru_alt   (e.g. Milan → "Мілані" / "Милане")
const NAME_KEY: Record<Lang, keyof LocName> = { uk: "ua", ru: "ru" };
const PREP_KEY: Record<Lang, keyof LocName> = { uk: "ua_alt", ru: "ru_alt" };

export function nomName(name: LocName | undefined, lang: Lang): string {
  return name?.[NAME_KEY[lang]] ?? name?.en ?? "";
}
export function prepName(name: LocName | undefined, lang: Lang): string {
  return name?.[PREP_KEY[lang]] ?? nomName(name, lang);
}

export const HTML_LANG: Record<Lang, string> = { uk: "uk", ru: "ru" };
export const OG_LOCALE: Record<Lang, string> = { uk: "uk_UA", ru: "ru_RU" };

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
};

/** "24 мастера" / "1 майстер" */
export function mastersCount(n: number, lang: Lang): string {
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
};
