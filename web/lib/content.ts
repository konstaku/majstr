import { mastersCount, type Lang } from "./i18n";
import { CITY_REGION, PROFESSION_TIPS } from "./seo-data";

// On-page copy builders. Strategy (from RU/UK keyword research):
//  • <title> uses city NOMINATIVE + count  ("Маникюр Милан — 24 мастера")
//  • <h1>/body use city PREPOSITIONAL       ("Маникюр в Милане")
//  • landing pages own "{profession} {city}"; profession hubs target
//    "{profession} Италия" (no city); city hubs target "мастера {city}".
// Counts are only surfaced in titles when impressive (≥5) to avoid the
// "— 2 мастера" credibility hit and number-agreement bugs.
// English mirrors the same structure for the diaspora searching in English;
// it has no case system, so cityNom and cityPrep collapse to the same form.

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
        : lang === "en"
          ? "Ukrainian-speaking masters"
          : "україномовні майстри";
  return `${lead} ${cityNom} — ${tail}${BRAND}`;
}

export function landingDescription(
  lang: Lang,
  lead: string,
  cityPrep: string
): string {
  if (lang === "ru")
    return `${lead} ${cityPrep}. Проверенные русскоязычные мастера: портфолио, цены, отзывы и запись напрямую в Telegram. Бесплатно, без посредников.`;
  if (lang === "en")
    return `${lead} ${cityPrep}. Verified Ukrainian- and Russian-speaking masters: portfolios, prices, reviews and booking directly on Telegram. Free, no middlemen.`;
  return `${lead} ${cityPrep}. Перевірені україномовні майстри: портфоліо, ціни, відгуки та запис напряму в Telegram. Безкоштовно, без посередників.`;
}

// A truthful, city-specific sentence (region varies per city) so landing pages
// don't read as near-duplicates — important for Yandex text-originality.
function regionSentence(lang: Lang, cityPrep: string, cityId: string): string {
  const region = CITY_REGION[cityId]?.[lang];
  if (!region) return "";
  if (lang === "ru")
    return `Мастера работают ${cityPrep} и в соседних городах региона ${region}.`;
  if (lang === "en")
    return `Masters work ${cityPrep} and in nearby towns of the ${region} region.`;
  return `Майстри працюють ${cityPrep} та в сусідніх містах регіону ${region}.`;
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
        : lang === "en"
          ? `${lead} ${cityPrep} — ${mastersCount(count, lang)} in the Majstr directory.`
          : `${lead} ${cityPrep} — ${mastersCount(count, lang)} у каталозі Majstr.`
      : lang === "ru"
        ? `${lead} ${cityPrep}. Проверенные русскоязычные мастера в каталоге Majstr.`
        : lang === "en"
          ? `${lead} ${cityPrep}. Verified Ukrainian- and Russian-speaking masters in the Majstr directory.`
          : `${lead} ${cityPrep}. Перевірені україномовні майстри в каталозі Majstr.`;
  const region = regionSentence(lang, cityPrep, cityId);
  if (lang === "ru") {
    return `${opener} Все мастера говорят по-русски и по-украински и понимают клиентов из Украины и стран СНГ. ${region}${sub ? " " + sub : ""} Смотрите портфолио, цены и реальные отзывы, сравнивайте специалистов и записывайтесь напрямую через Telegram — бесплатно и без посредников.`;
  }
  if (lang === "en") {
    return `${opener} All masters speak Ukrainian and Russian and understand clients from Ukraine and the CIS. ${region}${sub ? " " + sub : ""} Browse portfolios, prices and real reviews, compare specialists and book directly via Telegram — free and without middlemen.`;
  }
  return `${opener} Усі майстри говорять українською та російською і розуміють потреби клієнтів з України. ${region}${sub ? " " + sub : ""} Дивіться портфоліо, ціни та реальні відгуки, порівнюйте спеціалістів і записуйтесь напряму через Telegram — безкоштовно й без посередників.`;
}

// Second body paragraph — profession-specific "how to choose" guidance.
export function landingBody(lang: Lang, professionID: string): string {
  const tip =
    PROFESSION_TIPS[professionID]?.[lang] ??
    (lang === "ru"
      ? "напишите мастеру в Telegram, опишите задачу и уточните цену и сроки."
      : lang === "en"
        ? "message the master on Telegram, describe your task and confirm the price and timing."
        : "напишіть майстру в Telegram, опишіть завдання та уточніть ціну й терміни.");
  if (lang === "ru")
    return `Как выбрать мастера: ${tip} На Majstr вы пишете напрямую в Telegram — без посредников и комиссии — и обсуждаете все детали на родном языке.`;
  if (lang === "en")
    return `How to choose a master: ${tip} On Majstr you message directly on Telegram — no middlemen and no commission — and discuss every detail in your own language.`;
  return `Як обрати майстра: ${tip} На Majstr ви пишете напряму в Telegram — без посередників і комісії — та обговорюєте всі деталі рідною мовою.`;
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
  if (lang === "en") {
    return [
      {
        q: `How much does ${lower(lead)} ${cityPrep} cost?`,
        a: `Prices depend on the master and the service — each specialist lists their prices in their profile. Compare offers and reviews in the Majstr directory before booking.`,
      },
      {
        q: `Do the masters speak Ukrainian and Russian?`,
        a: `Yes. Every specialist in the Majstr directory speaks Ukrainian and Russian, and many also speak Italian, so you can discuss every detail in your own language.`,
      },
      {
        q: `How do I book a master?`,
        a: `Booking is free and happens directly on Telegram: open the master's profile and message them in one click — no middlemen and no commission.`,
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
  if (lang === "ru")
    return `${name}: ${lower(profName)} ${cityPrep}. Говорит по-русски и по-украински. Портфолио, цены и отзывы — запись напрямую через Telegram, бесплатно.`;
  if (lang === "en")
    return `${name}: ${lower(profName)} ${cityPrep}. Speaks Ukrainian and Russian. Portfolio, prices and reviews — book directly via Telegram, free.`;
  return `${name}: ${lower(profName)} ${cityPrep}. Говорить українською та російською. Портфоліо, ціни та відгуки — запис напряму через Telegram, безкоштовно.`;
}

// ── City hub ──────────────────────────────────────────────────────────────────
export function cityHubTitle(lang: Lang, cityPrep: string): string {
  if (lang === "ru") return `Русскоязычные мастера ${cityPrep}${BRAND}`;
  if (lang === "en") return `Ukrainian- & Russian-speaking masters ${cityPrep}${BRAND}`;
  return `Україномовні майстри ${cityPrep}${BRAND}`;
}
export function cityHubDescription(lang: Lang, cityPrep: string): string {
  if (lang === "ru")
    return `Каталог русскоязычных специалистов ${cityPrep}: маникюр, парикмахеры, косметологи, электрики, врачи и другие мастера. Отзывы, цены, запись бесплатно.`;
  if (lang === "en")
    return `Directory of Ukrainian- and Russian-speaking specialists ${cityPrep}: manicurists, hairdressers, beauticians, electricians, doctors and more. Reviews, prices, free booking.`;
  return `Каталог україномовних спеціалістів ${cityPrep}: манікюр, перукарі, косметологи, електрики, лікарі та інші майстри. Відгуки, ціни, запис безкоштовно.`;
}

// ── Profession hub (all cities) ───────────────────────────────────────────────
export function professionHubTitle(lang: Lang, lead: string): string {
  if (lang === "ru") return `${lead} в Италии — русскоязычные мастера${BRAND}`;
  if (lang === "en") return `${lead} in Italy — Ukrainian-speaking masters${BRAND}`;
  return `${lead} в Італії — україномовні майстри${BRAND}`;
}
export function professionHubDescription(lang: Lang, lead: string): string {
  if (lang === "ru")
    return `Русскоязычные мастера: ${lower(lead)} в городах Италии — Милан, Рим, Турин, Неаполь, Флоренция и другие. Цены, отзывы, запись в Telegram. Бесплатно.`;
  if (lang === "en")
    return `Ukrainian-speaking masters: ${lower(lead)} in cities across Italy — Milan, Rome, Turin, Naples, Florence and more. Prices, reviews, booking on Telegram. Free.`;
  return `Україномовні майстри: ${lower(lead)} у містах Італії — Мілан, Рим, Турин, Неаполь, Флоренція та інші. Ціни, відгуки, запис у Telegram. Безкоштовно.`;
}
