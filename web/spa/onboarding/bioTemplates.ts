// Maps spoken-language codes (from LANGUAGE_OPTIONS) → readable name in each UI language.
// UI lang key: OnbLang ("uk", "ru", "en", ...). Inner key: LANGUAGE_OPTIONS code ("ua", "it", ...).

const LANG_CODE_NAMES: Record<string, Record<string, string>> = {
  uk: {
    ua: "українська",
    it: "італійська",
    en: "англійська",
    ru: "російська",
    pl: "польська",
    de: "німецька",
    fr: "французька",
    es: "іспанська",
  },
  ru: {
    ua: "украинский",
    it: "итальянский",
    en: "английский",
    ru: "русский",
    pl: "польский",
    de: "немецкий",
    fr: "французский",
    es: "испанский",
  },
};

const LANG_CODE_NAMES_EN: Record<string, string> = {
  ua: "Ukrainian",
  it: "Italian",
  en: "English",
  ru: "Russian",
  pl: "Polish",
  de: "German",
  fr: "French",
  es: "Spanish",
};

export function buildBioTemplate(
  lang: string,
  professionName: string,
  cityName: string,
  languageCodes: string[]
): string {
  const namesMap = LANG_CODE_NAMES[lang] ?? {};
  const langList = languageCodes
    .map((code) => namesMap[code] ?? LANG_CODE_NAMES_EN[code] ?? code)
    .join(", ");

  if (lang === "uk") {
    return `Послуги з ${professionName} у ${cityName}. Говорю ${langList}. Доступний у всі робочі дні.`;
  }
  if (lang === "ru") {
    return `Услуги ${professionName} в ${cityName}. Говорю на ${langList}. Доступен во все рабочие дни.`;
  }
  return `${professionName} services in ${cityName}. I speak ${langList}. Available on all working days.`;
}
