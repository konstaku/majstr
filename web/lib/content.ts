import { mastersCount, type Lang } from "./i18n";
import { CITY_REGION, PROFESSION_TIPS } from "./seo-data";

// On-page copy builders. Strategy (from RU/UK keyword research):
//  • <title> uses city NOMINATIVE + count  ("Маникюр Милан — 24 мастера")
//  • <h1>/body use city PREPOSITIONAL       ("Маникюр в Милане")
//  • landing pages own "{profession} {city}"; profession hubs target
//    "{profession} Италия" (no city); city hubs target "мастера {city}".
// Counts are only surfaced in titles when impressive (≥5) to avoid the
// "— 2 мастера" credibility hit and number-agreement bugs.

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const BRAND = " | Majstr";

export interface Faq {
  q: string;
  a: string;
}

// ── Landing: profession × city ────────────────────────────────────────────────
export function landingH1(lead: string, cityPrep: string): string {
  return `${lead} ${cityPrep}`;
}

export function landingTitle(
  lang: Lang,
  lead: string,
  cityNom: string,
  count: number
): string {
  const tail =
    count >= 5
      ? mastersCount(count, lang)
      : lang === "ru"
        ? "русскоязычные мастера"
        : "україномовні майстри";
  return `${lead} ${cityNom} — ${tail}${BRAND}`;
}

export function landingDescription(
  lang: Lang,
  lead: string,
  cityPrep: string
): string {
  return lang === "ru"
    ? `${lead} ${cityPrep}. Проверенные русскоязычные мастера: портфолио, цены, отзывы и запись напрямую в Telegram. Бесплатно, без посредников.`
    : `${lead} ${cityPrep}. Перевірені україномовні майстри: портфоліо, ціни, відгуки та запис напряму в Telegram. Безкоштовно, без посередників.`;
}

// A truthful, city-specific sentence (region varies per city) so landing pages
// don't read as near-duplicates — important for Yandex text-originality.
function regionSentence(lang: Lang, cityPrep: string, cityId: string): string {
  const region = CITY_REGION[cityId]?.[lang];
  if (!region) return "";
  return lang === "ru"
    ? `Мастера работают ${cityPrep} и в соседних городах региона ${region}.`
    : `Майстри працюють ${cityPrep} та в сусідніх містах регіону ${region}.`;
}

export function landingIntro(
  lang: Lang,
  lead: string,
  cityPrep: string,
  cityId: string,
  count: number,
  sub?: string
): string {
  // Count-aware opener (avoids "1 мастеров" and the thin "— 2 мастера" look).
  const opener =
    count >= 5
      ? lang === "ru"
        ? `${lead} ${cityPrep} — ${mastersCount(count, lang)} в каталоге Majstr.`
        : `${lead} ${cityPrep} — ${mastersCount(count, lang)} у каталозі Majstr.`
      : lang === "ru"
        ? `${lead} ${cityPrep}. Проверенные русскоязычные мастера в каталоге Majstr.`
        : `${lead} ${cityPrep}. Перевірені україномовні майстри в каталозі Majstr.`;
  const region = regionSentence(lang, cityPrep, cityId);
  if (lang === "ru") {
    return `${opener} Все мастера говорят по-русски и по-украински и понимают клиентов из Украины и стран СНГ. ${region}${sub ? " " + sub : ""} Смотрите портфолио, цены и реальные отзывы, сравнивайте специалистов и записывайтесь напрямую через Telegram — бесплатно и без посредников.`;
  }
  return `${opener} Усі майстри говорять українською та російською і розуміють потреби клієнтів з України. ${region}${sub ? " " + sub : ""} Дивіться портфоліо, ціни та реальні відгуки, порівнюйте спеціалістів і записуйтесь напряму через Telegram — безкоштовно й без посередників.`;
}

// Second body paragraph — profession-specific "how to choose" guidance.
export function landingBody(lang: Lang, professionID: string): string {
  const tip =
    PROFESSION_TIPS[professionID]?.[lang] ??
    (lang === "ru"
      ? "напишите мастеру в Telegram, опишите задачу и уточните цену и сроки."
      : "напишіть майстру в Telegram, опишіть завдання та уточніть ціну й терміни.");
  return lang === "ru"
    ? `Как выбрать мастера: ${tip} На Majstr вы пишете напрямую в Telegram — без посредников и комиссии — и обсуждаете все детали на родном языке.`
    : `Як обрати майстра: ${tip} На Majstr ви пишете напряму в Telegram — без посередників і комісії — та обговорюєте всі деталі рідною мовою.`;
}

export function landingFaq(
  lang: Lang,
  lead: string,
  cityPrep: string
): Faq[] {
  if (lang === "ru") {
    return [
      {
        q: `Сколько стоит ${lower(lead)} ${cityPrep}?`,
        a: `Стоимость зависит от мастера и услуги — каждый специалист указывает цены в своём профиле. Сравните предложения и отзывы в каталоге Majstr перед записью.`,
      },
      {
        q: `Говорят ли мастера по-русски?`,
        a: `Да. Все специалисты в каталоге Majstr — русскоязычные, многие также говорят по-украински и по-итальянски, поэтому все детали можно обсудить на родном языке.`,
      },
      {
        q: `Как записаться к мастеру?`,
        a: `Запись бесплатная и происходит напрямую через Telegram: откройте профиль мастера и напишите ему в один клик — без посредников и комиссии.`,
      },
    ];
  }
  return [
    {
      q: `Скільки коштує ${lower(lead)} ${cityPrep}?`,
      a: `Вартість залежить від майстра й послуги — кожен спеціаліст вказує ціни у своєму профілі. Порівняйте пропозиції та відгуки в каталозі Majstr перед записом.`,
    },
    {
      q: `Чи говорять майстри українською?`,
      a: `Так. Усі спеціалісти в каталозі Majstr — україномовні, багато хто також володіє російською та італійською, тож усі деталі можна обговорити рідною мовою.`,
    },
    {
      q: `Як записатися до майстра?`,
      a: `Запис безкоштовний і відбувається напряму через Telegram: відкрийте профіль майстра та напишіть йому в один клік — без посередників і комісії.`,
    },
  ];
}

// ── Master page ───────────────────────────────────────────────────────────────
export function masterTitle(
  lang: Lang,
  name: string,
  profName: string,
  cityPrep: string
): string {
  return `${name} — ${profName} ${cityPrep}${BRAND}`;
}
export function masterDescription(
  lang: Lang,
  name: string,
  profName: string,
  cityPrep: string
): string {
  return lang === "ru"
    ? `${name}: ${lower(profName)} ${cityPrep}. Говорит по-русски и по-украински. Портфолио, цены и отзывы — запись напрямую через Telegram, бесплатно.`
    : `${name}: ${lower(profName)} ${cityPrep}. Говорить українською та російською. Портфоліо, ціни та відгуки — запис напряму через Telegram, безкоштовно.`;
}

// ── City hub ──────────────────────────────────────────────────────────────────
export function cityHubTitle(lang: Lang, cityPrep: string): string {
  return lang === "ru"
    ? `Русскоязычные мастера ${cityPrep}${BRAND}`
    : `Україномовні майстри ${cityPrep}${BRAND}`;
}
export function cityHubDescription(lang: Lang, cityPrep: string): string {
  return lang === "ru"
    ? `Каталог русскоязычных специалистов ${cityPrep}: маникюр, парикмахеры, косметологи, электрики, врачи и другие мастера. Отзывы, цены, запись бесплатно.`
    : `Каталог україномовних спеціалістів ${cityPrep}: манікюр, перукарі, косметологи, електрики, лікарі та інші майстри. Відгуки, ціни, запис безкоштовно.`;
}

// ── Profession hub (all cities) ───────────────────────────────────────────────
export function professionHubTitle(lang: Lang, lead: string): string {
  return lang === "ru"
    ? `${lead} в Италии — русскоязычные мастера${BRAND}`
    : `${lead} в Італії — україномовні майстри${BRAND}`;
}
export function professionHubDescription(lang: Lang, lead: string): string {
  return lang === "ru"
    ? `Русскоязычные мастера: ${lower(lead)} в городах Италии — Милан, Рим, Турин, Неаполь, Флоренция и другие. Цены, отзывы, запись в Telegram. Бесплатно.`
    : `Україномовні майстри: ${lower(lead)} у містах Італії — Мілан, Рим, Турин, Неаполь, Флоренція та інші. Ціни, відгуки, запис у Telegram. Безкоштовно.`;
}
