import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useTelegramContext } from "../surface/useTelegramContext";

export const ONB_LANGS = ["uk", "en", "it", "ru"] as const;
export type OnbLang = (typeof ONB_LANGS)[number];
const DEFAULT: OnbLang = "uk";

function mapTg(code?: string | null): OnbLang | null {
  if (!code) return null;
  const b = code.toLowerCase().split("-")[0];
  if (b === "uk") return "uk";
  if (b === "it") return "it";
  if (b === "ru") return "ru";
  if (b === "en") return "en";
  return null;
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
// link) > Telegram app language > uk.
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
  "nav.next": "Далі",
  "nav.submit": "Надіслати",
  "nav.back": "Назад",
  "success.title": "Дякуємо!",
  "success.text":
    "Вашу картку надіслано на модерацію. Ми повідомимо вас у Telegram, щойно її буде схвалено.",
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
  "loc.countryHint": "Поки що Majstr працює тільки в Італії.",
  "bio.servicesLabel": "Послуги (від 1 до 3)",
  "bio.serviceRequired": "Вкажіть хоча б одну послугу",
  "bio.aboutLabel": "Про вас",
  "bio.aboutPlaceholder":
    "Що ви робите, в якому районі, як з вами зручно звʼязатися, як скоро ви відповідаєте.",
  "bio.aboutHint": "Від 30 до 600 символів.",
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
  "nav.next": "Next",
  "nav.submit": "Submit",
  "nav.back": "Back",
  "success.title": "Thank you!",
  "success.text":
    "Your card has been submitted for review. We'll notify you in Telegram as soon as it's approved.",
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
  "loc.countryHint": "For now Majstr works only in Italy.",
  "bio.servicesLabel": "Services (1 to 3)",
  "bio.serviceRequired": "Add at least one service",
  "bio.aboutLabel": "About you",
  "bio.aboutPlaceholder":
    "What you do, in which area, how to best reach you, how quickly you reply.",
  "bio.aboutHint": "From 30 to 600 characters.",
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

const IT: Dict = {
  "step.profile": "Profilo",
  "step.profession": "Professione",
  "step.location": "Località",
  "step.bio": "Su di te",
  "step.contact": "Contatti",
  "nav.next": "Avanti",
  "nav.submit": "Invia",
  "nav.back": "Indietro",
  "success.title": "Grazie!",
  "success.text":
    "La tua scheda è stata inviata per la revisione. Ti avviseremo su Telegram appena sarà approvata.",
  "submit.failTitle": "Invio non riuscito",
  "submit.failOk": "Ho capito",
  "submit.errExists": "Hai già una scheda attiva.",
  "submit.errOffline": "Nessuna connessione. Dati salvati — riprova a inviare.",
  "submit.errValidation": "Controlla questi campi: {fields}",
  "submit.errGeneric": "Invio non riuscito. Riprova.",
  "common.required": "Obbligatorio",
  "common.optional": "Facoltativo.",
  "err.min2": "Almeno 2 caratteri",
  "err.max25": "Massimo 25 caratteri",
  "err.min30": "Almeno 30 caratteri",
  "err.max600": "Massimo 600 caratteri",
  "profile.usePhoto": "Usa la mia foto di Telegram",
  "profile.uploading": "Caricamento…",
  "profile.uploadDevice": "Carica dal dispositivo",
  "profile.removePhoto": "Rimuovi foto",
  "profile.uploadError": "Caricamento non riuscito. Controlla la connessione e riprova.",
  "profile.fileTooLarge": "File troppo grande (max 5 MB).",
  "profile.nameLabel": "Il tuo nome",
  "profile.namePlaceholder": "Come ti chiami?",
  "profile.nameHint": "I clienti lo vedranno sulla tua scheda.",
  "prof.categoryLabel": "Categoria",
  "prof.chooseCategory": "Scegli una categoria",
  "prof.professionLabel": "Professione",
  "prof.chooseProfession": "Scegli una professione",
  "prof.chooseCategoryFirst": "Scegli prima una categoria",
  "prof.langLabel": "Lingue parlate",
  "prof.langHint": "Scegli almeno una lingua.",
  "prof.maxLangs": "Massimo 5 lingue.",
  "prof.langRequired": "Scegli almeno una lingua",
  "loc.cityLabel": "Città principale più vicina",
  "loc.chooseCity": "Scegli una città",
  "loc.cityHint":
    "Questa città apparirà sulla tua scheda. Non significa che non lavori in altre.",
  "loc.countryLabel": "Paese",
  "loc.italy": "🇮🇹 Italia",
  "loc.countryHint": "Per ora Majstr funziona solo in Italia.",
  "bio.servicesLabel": "Servizi (da 1 a 3)",
  "bio.serviceRequired": "Aggiungi almeno un servizio",
  "bio.aboutLabel": "Su di te",
  "bio.aboutPlaceholder":
    "Cosa fai, in quale zona, come contattarti meglio, quanto rapidamente rispondi.",
  "bio.aboutHint": "Da 30 a 600 caratteri.",
  "contact.hint": "Come possono contattarti i clienti?",
  "contact.shareNumber": "Condividi il numero via Telegram",
  "contact.shareManual": "Inserisci il numero manualmente qui sotto.",
  "contact.shareDenied": "Accesso negato. Inserisci il numero manualmente qui sotto.",
  "contact.shareFailed":
    "Impossibile ottenere il numero automaticamente. Inseriscilo manualmente qui sotto.",
  "contact.phoneLabel": "Telefono",
  "contact.phonePlaceholder": "+39 333 123 45 67",
  "contact.phoneHint": "I clienti chiameranno questo numero.",
  "contact.telegramLabel": "Telegram",
  "contact.instagramLabel": "Instagram",
  "picker.search": "Cerca",
  "picker.empty": "Nessun risultato.",
  "picker.close": "Chiudi",
  "tag.add": "+ Aggiungi un servizio",
  "tag.addConfirm": "Aggiungi",
  "tag.namePlaceholder": "Nome del servizio",
  "tag.noHash": "Senza # all'inizio",
  "tag.minChars": "Almeno {n} caratteri",
  "tag.maxChars": "Massimo {n} caratteri",
  "tag.dup": "Servizio già aggiunto",
  "tag.atMax": "Fino a 3 servizi.",
  "tag.example": "Es. “Cambio olio”, “Assistenza BMW”, “Revisione”.",
  "tag.suggested": "Suggeriti:",
  "draft.errExists":
    "Hai già una scheda attiva — non puoi crearne un'altra.",
  "draft.errSession": "Sessione non verificata. Chiudi e riapri la Mini App.",
  "draft.errValidation": "Non salvato — errore di validazione ({fields}).",
  "draft.errCode": "Salvataggio non riuscito (errore {status}).",
  "draft.errOffline": "Nessuna connessione. Salvato localmente — riproveremo.",
};

const RU: Dict = {
  "step.profile": "Профиль",
  "step.profession": "Профессия",
  "step.location": "Местоположение",
  "step.bio": "О вас",
  "step.contact": "Контакты",
  "nav.next": "Далее",
  "nav.submit": "Отправить",
  "nav.back": "Назад",
  "success.title": "Спасибо!",
  "success.text":
    "Ваша карточка отправлена на модерацию. Мы сообщим вам в Telegram, как только её одобрят.",
  "submit.failTitle": "Не удалось отправить",
  "submit.failOk": "Понятно",
  "submit.errExists": "У вас уже есть активная карточка мастера.",
  "submit.errOffline": "Нет связи. Данные сохранены — попробуйте отправить ещё раз.",
  "submit.errValidation": "Проверьте поля: {fields}",
  "submit.errGeneric": "Не удалось отправить. Попробуйте ещё раз.",
  "common.required": "Обязательное поле",
  "common.optional": "Необязательно.",
  "err.min2": "Минимум 2 символа",
  "err.max25": "Максимум 25 символов",
  "err.min30": "Минимум 30 символов",
  "err.max600": "Максимум 600 символов",
  "profile.usePhoto": "Использовать фото из Telegram",
  "profile.uploading": "Загружаем…",
  "profile.uploadDevice": "Загрузить с устройства",
  "profile.removePhoto": "Убрать фото",
  "profile.uploadError": "Не удалось загрузить. Проверьте интернет и повторите.",
  "profile.fileTooLarge": "Файл слишком большой (макс. 5 МБ).",
  "profile.nameLabel": "Ваше имя",
  "profile.namePlaceholder": "Как вас зовут?",
  "profile.nameHint": "Это увидят клиенты на вашей карточке.",
  "prof.categoryLabel": "Категория",
  "prof.chooseCategory": "Выберите категорию",
  "prof.professionLabel": "Профессия",
  "prof.chooseProfession": "Выберите профессию",
  "prof.chooseCategoryFirst": "Сначала выберите категорию",
  "prof.langLabel": "Языки общения",
  "prof.langHint": "Выберите хотя бы один язык.",
  "prof.maxLangs": "Максимум 5 языков.",
  "prof.langRequired": "Выберите хотя бы один язык",
  "loc.cityLabel": "Ближайший крупный город",
  "loc.chooseCity": "Выберите город",
  "loc.cityHint":
    "Этот город будет на вашей карточке. Это не значит, что вы не работаете в других.",
  "loc.countryLabel": "Страна",
  "loc.italy": "🇮🇹 Италия",
  "loc.countryHint": "Пока Majstr работает только в Италии.",
  "bio.servicesLabel": "Услуги (от 1 до 3)",
  "bio.serviceRequired": "Укажите хотя бы одну услугу",
  "bio.aboutLabel": "О вас",
  "bio.aboutPlaceholder":
    "Что вы делаете, в каком районе, как удобно с вами связаться, как быстро отвечаете.",
  "bio.aboutHint": "От 30 до 600 символов.",
  "contact.hint": "Как с вами связаться?",
  "contact.shareNumber": "Поделиться номером через Telegram",
  "contact.shareManual": "Введите номер вручную ниже.",
  "contact.shareDenied": "Доступ не предоставлен. Введите номер вручную ниже.",
  "contact.shareFailed":
    "Не удалось получить номер автоматически. Введите его вручную ниже.",
  "contact.phoneLabel": "Телефон",
  "contact.phonePlaceholder": "+39 333 123 45 67",
  "contact.phoneHint": "Клиенты будут звонить на этот номер.",
  "contact.telegramLabel": "Telegram",
  "contact.instagramLabel": "Instagram",
  "picker.search": "Поиск",
  "picker.empty": "Ничего не найдено.",
  "picker.close": "Закрыть",
  "tag.add": "+ Добавить услугу",
  "tag.addConfirm": "Добавить",
  "tag.namePlaceholder": "Название услуги",
  "tag.noHash": "Без символа # в начале",
  "tag.minChars": "Минимум {n} символа",
  "tag.maxChars": "Максимум {n} символов",
  "tag.dup": "Такая услуга уже есть",
  "tag.atMax": "Можно указать до 3 услуг.",
  "tag.example": "Например: «Замена масла», «Сервис BMW», «Техосмотр».",
  "tag.suggested": "Предложенные:",
  "draft.errExists":
    "У вас уже есть активная карточка мастера — создать ещё одну нельзя.",
  "draft.errSession": "Сессия не подтверждена. Закройте и откройте мини-приложение.",
  "draft.errValidation": "Не сохранено — ошибка проверки ({fields}).",
  "draft.errCode": "Не удалось сохранить (ошибка {status}).",
  "draft.errOffline": "Нет связи. Сохранено локально — повторим позже.",
};

const DICTS: Record<OnbLang, Dict> = { uk: UK, en: EN, it: IT, ru: RU };

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
      let s = dict[key] ?? UK[key] ?? key;
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
