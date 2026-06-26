import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useTelegramContext } from "../surface/useTelegramContext";

// The Mini App ships in two languages only: Ukrainian for uk-language
// Telegram clients, English for everyone else.
export const ONB_LANGS = ["en", "uk"] as const;
export type OnbLang = (typeof ONB_LANGS)[number];
const DEFAULT: OnbLang = "en";

function mapTg(code?: string | null): OnbLang | null {
  if (!code) return null;
  const b = code.toLowerCase().split("-")[0];
  return (ONB_LANGS as readonly string[]).includes(b)
    ? (b as OnbLang)
    : null;
}

function tokenLang(s?: string | null): OnbLang | null {
  if (!s) return null;
  for (const tok of s.split(/[^a-zA-Z]+/)) {
    const l = tok.toLowerCase();
    if ((ONB_LANGS as readonly string[]).includes(l)) return l as OnbLang;
  }
  return null;
}

// Priority: ?lng= (bot web_app button) > start_param (website startapp deep
// link) > Telegram app language > en. Unknown codes (it, ru, …) fall through
// to the next signal, so a non-Ukrainian user always lands on English.
export function resolveOnbLang(
  search: string,
  startParam: string | null,
  tgLangCode?: string | null
): OnbLang {
  const q = new URLSearchParams(search).get("lng");
  if (q && (ONB_LANGS as readonly string[]).includes(q.toLowerCase()))
    return q.toLowerCase() as OnbLang;
  return tokenLang(startParam) || mapTg(tgLangCode) || DEFAULT;
}

type Dict = Record<string, string>;

const UK: Dict = {
  "step.profile": "Профіль",
  "step.profession": "Професія",
  "step.location": "Місцезнаходження",
  "step.bio": "Про вас",
  "step.contact": "Контакти",
  "draftChoose.title": "У вас є незавершена картка",
  "draftChoose.statusDraft": "Чернетка",
  "draftChoose.untitled": "Без назви",
  "draftChoose.continue": "Продовжити редагування",
  "draftChoose.startOver": "Почати заново",
  "draftChoose.delete": "Видалити чернетку",
  "draftChoose.confirmStartOver":
    "Почати заново? Поточну чернетку буде видалено без можливості відновлення.",
  "draftChoose.confirmDelete":
    "Видалити чернетку? Цю дію не можна скасувати.",
  "draftChoose.deletedTitle": "Чернетку видалено",
  "draftChoose.deletedText": "Можете створити нову картку, коли буде зручно.",
  "draftChoose.newEntry": "Створити нову картку",
  "draftChoose.error": "Не вдалося. Спробуйте ще раз.",
  "nav.next": "Далі",
  "nav.submit": "Надіслати",
  "nav.back": "Назад",
  "success.title": "Дякуємо!",
  "success.text":
    "Вашу картку надіслано на модерацію. Ми повідомимо вас у Telegram, щойно її буде схвалено.",
  "success.done": "Готово",
  "submit.failTitle": "Не вдалося надіслати",
  "submit.failOk": "Зрозуміло",
  "submit.errExists": "У вас вже є активна картка майстра.",
  "submit.errOffline":
    "Немає звʼязку. Дані збережено — спробуйте надіслати ще раз.",
  "submit.errValidation": "Перевірте заповнені поля: {fields}",
  "submit.errGeneric": "Не вдалося надіслати. Спробуйте ще раз.",
  "common.required": "Обовʼязкове поле",
  "common.optional": "Необовʼязково.",
  "err.min2": "Мінімум 2 символи",
  "err.max25": "Максимум 25 символів",
  "err.min30": "Мінімум 30 символів",
  "err.max600": "Максимум 600 символів",
  "profile.usePhoto": "Використати фото з Telegram",
  "profile.skipPhoto": "Продовжити без фото — це необовʼязково.",
  "profile.uploading": "Завантажуємо…",
  "profile.uploadDevice": "Завантажити з пристрою",
  "profile.removePhoto": "Прибрати фото",
  "profile.uploadError":
    "Не вдалося завантажити. Перевірте інтернет і спробуйте ще раз.",
  "profile.fileTooLarge": "Файл завеликий (макс. 5 МБ).",
  "profile.nameLabel": "Ваше імʼя",
  "profile.namePlaceholder": "Як вас звати?",
  "profile.nameHint": "Це побачать клієнти на вашій картці.",
  "prof.categoryLabel": "Категорія",
  "prof.chooseCategory": "Оберіть категорію",
  "prof.professionLabel": "Професія",
  "prof.chooseProfession": "Оберіть професію",
  "prof.chooseCategoryFirst": "Спершу оберіть категорію",
  "prof.langLabel": "Мови спілкування",
  "prof.langHint": "Оберіть хоча б одну мову.",
  "prof.maxLangs": "Максимум 5 мов.",
  "prof.langRequired": "Оберіть хоча б одну мову",
  "loc.cityLabel": "Найближче велике місто",
  "loc.chooseCity": "Оберіть місто",
  "loc.cityHint":
    "Це місто буде на вашій картці. Це не означає, що ви не працюєте в інших.",
  "loc.countryLabel": "Країна",
  "loc.italy": "🇮🇹 Італія",
  "loc.fr": "🇫🇷 Франція",
  "loc.countryHint": "Картку буде розміщено в каталозі цієї країни.",
  "bio.servicesLabel": "Опишіть свої послуги (до 3 варіантів)",
  "bio.serviceRequired": "Вкажіть хоча б одну послугу",
  "bio.aboutLabel": "Про вас",
  "bio.aboutPlaceholder":
    "Що ви робите, в якому районі, як з вами зручно звʼязатися, як скоро ви відповідаєте.",
  "bio.aboutHint": "Від 30 до 600 символів.",
  "bio.editLater": "Можна відредагувати пізніше.",
  "contact.whatsapp": "Також у WhatsApp",
  "contact.hint": "Як з вами звʼязатися?",
  "contact.shareNumber": "Поділитися номером з Telegram",
  "contact.shareManual": "Введіть номер вручну нижче.",
  "contact.shareDenied": "Доступ не надано. Введіть номер вручну нижче.",
  "contact.shareFailed":
    "Не вдалося отримати номер автоматично. Введіть його вручну нижче.",
  "contact.phoneLabel": "Телефон",
  "contact.phonePlaceholder": "+39 333 123 45 67",
  "contact.phoneHint": "Клієнти телефонуватимуть на цей номер.",
  "contact.telegramLabel": "Telegram",
  "contact.instagramLabel": "Instagram",
  "picker.search": "Пошук",
  "picker.empty": "Нічого не знайшли.",
  "picker.close": "Закрити",
  "tag.add": "+ Додати послугу",
  "tag.addConfirm": "Додати",
  "tag.namePlaceholder": "Назва послуги",
  "tag.noHash": "Без символу # на початку",
  "tag.minChars": "Мінімум {n} символи",
  "tag.maxChars": "Максимум {n} символів",
  "tag.dup": "Така послуга вже є",
  "tag.atMax": "Можна вказати до 3 послуг.",
  "tag.example": "Наприклад: «Заміна мастила», «Сервіс BMW», «Техогляд».",
  "tag.suggested": "Запропоновані:",
  "draft.errExists":
    "У вас вже є активна картка майстра — створити ще одну не можна.",
  "draft.errSession": "Сесію не підтверджено. Закрийте і відкрийте міні-застосунок.",
  "draft.errValidation": "Дані не збережено — помилка перевірки ({fields}).",
  "draft.errCode": "Не вдалося зберегти (помилка {status}).",
  "draft.errOffline":
    "Немає звʼязку. Дані збережено локально — повторимо пізніше.",
};

const EN: Dict = {
  "step.profile": "Profile",
  "step.profession": "Profession",
  "step.location": "Location",
  "step.bio": "About you",
  "step.contact": "Contacts",
  "draftChoose.title": "You have an unfinished card",
  "draftChoose.statusDraft": "Draft",
  "draftChoose.untitled": "Untitled",
  "draftChoose.continue": "Continue editing",
  "draftChoose.startOver": "Start over",
  "draftChoose.delete": "Delete draft",
  "draftChoose.confirmStartOver":
    "Start over? Your current draft will be permanently deleted.",
  "draftChoose.confirmDelete": "Delete this draft? This can't be undone.",
  "draftChoose.deletedTitle": "Draft deleted",
  "draftChoose.deletedText": "You can create a new card whenever you like.",
  "draftChoose.newEntry": "Create a new card",
  "draftChoose.error": "Something went wrong. Please try again.",
  "nav.next": "Next",
  "nav.submit": "Submit",
  "nav.back": "Back",
  "success.title": "Thank you!",
  "success.text":
    "Your card has been submitted for review. We'll notify you in Telegram as soon as it's approved.",
  "success.done": "Done",
  "submit.failTitle": "Couldn't submit",
  "submit.failOk": "Got it",
  "submit.errExists": "You already have an active master card.",
  "submit.errOffline": "No connection. Your data is saved — try submitting again.",
  "submit.errValidation": "Check these fields: {fields}",
  "submit.errGeneric": "Couldn't submit. Please try again.",
  "common.required": "Required",
  "common.optional": "Optional.",
  "err.min2": "At least 2 characters",
  "err.max25": "At most 25 characters",
  "err.min30": "At least 30 characters",
  "err.max600": "At most 600 characters",
  "profile.usePhoto": "Use my Telegram photo",
  "profile.skipPhoto": "Continue without a photo — it's optional.",
  "profile.uploading": "Uploading…",
  "profile.uploadDevice": "Upload from device",
  "profile.removePhoto": "Remove photo",
  "profile.uploadError": "Upload failed. Check your connection and try again.",
  "profile.fileTooLarge": "File too large (max 5 MB).",
  "profile.nameLabel": "Your name",
  "profile.namePlaceholder": "What's your name?",
  "profile.nameHint": "Clients will see this on your card.",
  "prof.categoryLabel": "Category",
  "prof.chooseCategory": "Choose a category",
  "prof.professionLabel": "Profession",
  "prof.chooseProfession": "Choose a profession",
  "prof.chooseCategoryFirst": "Choose a category first",
  "prof.langLabel": "Languages you speak",
  "prof.langHint": "Choose at least one language.",
  "prof.maxLangs": "Maximum 5 languages.",
  "prof.langRequired": "Choose at least one language",
  "loc.cityLabel": "Nearest major city",
  "loc.chooseCity": "Choose a city",
  "loc.cityHint":
    "This city goes on your card. It doesn't mean you don't work in others.",
  "loc.countryLabel": "Country",
  "loc.italy": "🇮🇹 Italy",
  "loc.fr": "🇫🇷 France",
  "loc.countryHint": "Your card will be listed in this country's catalogue.",
  "bio.servicesLabel": "Describe your services (up to 3)",
  "bio.serviceRequired": "Add at least one service",
  "bio.aboutLabel": "About you",
  "bio.aboutPlaceholder":
    "What you do, in which area, how to best reach you, how quickly you reply.",
  "bio.aboutHint": "From 30 to 600 characters.",
  "bio.editLater": "You can edit this later.",
  "contact.whatsapp": "Also on WhatsApp",
  "contact.hint": "How can clients reach you?",
  "contact.shareNumber": "Share my number via Telegram",
  "contact.shareManual": "Enter your number manually below.",
  "contact.shareDenied": "Access denied. Enter your number manually below.",
  "contact.shareFailed":
    "Couldn't get the number automatically. Enter it manually below.",
  "contact.phoneLabel": "Phone",
  "contact.phonePlaceholder": "+39 333 123 45 67",
  "contact.phoneHint": "Clients will call this number.",
  "contact.telegramLabel": "Telegram",
  "contact.instagramLabel": "Instagram",
  "picker.search": "Search",
  "picker.empty": "Nothing found.",
  "picker.close": "Close",
  "tag.add": "+ Add a service",
  "tag.addConfirm": "Add",
  "tag.namePlaceholder": "Service name",
  "tag.noHash": "No # at the start",
  "tag.minChars": "At least {n} characters",
  "tag.maxChars": "At most {n} characters",
  "tag.dup": "That service is already added",
  "tag.atMax": "Up to 3 services.",
  "tag.example": "E.g. “Oil change”, “BMW service”, “Inspection”.",
  "tag.suggested": "Suggested:",
  "draft.errExists":
    "You already have an active master card — you can't create another.",
  "draft.errSession": "Session not verified. Close and reopen the Mini App.",
  "draft.errValidation": "Not saved — validation error ({fields}).",
  "draft.errCode": "Couldn't save (error {status}).",
  "draft.errOffline": "No connection. Saved locally — we'll retry later.",
};

const DICTS: Record<OnbLang, Dict> = {
  en: EN,
  uk: UK,
};

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

interface OnbI18n {
  lang: OnbLang;
  t: TFunc;
}

const Ctx = createContext<OnbI18n | null>(null);

export function OnboardingI18nProvider({ children }: { children: ReactNode }) {
  const { startParam, user } = useTelegramContext();

  const value = useMemo<OnbI18n>(() => {
    const lang = resolveOnbLang(
      typeof window !== "undefined" ? window.location.search : "",
      startParam,
      user?.language_code
    );
    const dict = DICTS[lang];
    const t: TFunc = (key, vars) => {
      let s = dict[key] ?? EN[key] ?? UK[key] ?? key;
      if (vars)
        s = s.replace(/\{(\w+)\}/g, (_, k) =>
          vars[k] != null ? String(vars[k]) : `{${k}}`
        );
      return s;
    };
    return { lang, t };
  }, [startParam, user?.language_code]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOnbT(): OnbI18n {
  const ctx = useContext(Ctx);
  if (!ctx)
    throw new Error("useOnbT must be used within <OnboardingI18nProvider>");
  return ctx;
}
