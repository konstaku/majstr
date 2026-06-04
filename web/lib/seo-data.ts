import type { Lang } from "./i18n";

// Keyword-aligned, per-language SEO data sourced from dedicated RU/UK diaspora
// keyword research. `slug` is the latin URL token (matches how users search,
// e.g. "manikyur"); `lead` is the service-noun phrase used in <title> (with
// nominative city) and <h1> (with prepositional city); `sub` is a
// profession-specific sentence injected into body copy to keep pages unique
// (important for Yandex's text-originality scoring).

export interface ProfSeo {
  slug: string;
  lead: string;
  sub?: string;
}

export const PROFESSION_SEO: Record<string, Record<Lang, ProfSeo>> = {
  manicurist: {
    ru: { slug: "manikyur", lead: "Маникюр", sub: "Аппаратный и комбинированный маникюр, наращивание, гель-лак, дизайн и укрепление ногтей." },
    uk: { slug: "manikyur", lead: "Манікюр", sub: "Апаратний і комбінований манікюр, нарощування, гель-лак, дизайн та зміцнення нігтів." },
  },
  pedicurist: {
    ru: { slug: "pedikyur", lead: "Педикюр" },
    uk: { slug: "pedykyur", lead: "Педикюр" },
  },
  hairdresser: {
    ru: { slug: "parikmaher", lead: "Парикмахер", sub: "Стрижки, окрашивание, мелирование, укладки и уход за волосами." },
    uk: { slug: "perukar", lead: "Перукар", sub: "Стрижки, фарбування, мелірування, укладки та догляд за волоссям." },
  },
  beautician: {
    ru: { slug: "kosmetolog", lead: "Косметолог", sub: "Чистка лица, пилинги, уходовые процедуры и аппаратная косметология." },
    uk: { slug: "kosmetolog", lead: "Косметолог", sub: "Чистка обличчя, пілінги, доглядові процедури та апаратна косметологія." },
  },
  makeup_artist: {
    ru: { slug: "vizazhist", lead: "Визажист" },
    uk: { slug: "vizazhyst", lead: "Візажист" },
  },
  eyebrows: {
    ru: { slug: "brovist", lead: "Мастер бровей" },
    uk: { slug: "brovist", lead: "Майстер брів" },
  },
  eyelash_extension: {
    ru: { slug: "naraschivanie-resnic", lead: "Наращивание ресниц" },
    uk: { slug: "naroshchuvannya-vij", lead: "Нарощування вій" },
  },
  depilation: {
    ru: { slug: "depilyaciya", lead: "Депиляция" },
    uk: { slug: "depilyaciya", lead: "Депіляція" },
  },
  massage: {
    ru: { slug: "massazh", lead: "Массаж", sub: "Классический, лечебный, антицеллюлитный и расслабляющий массаж, выезд на дом." },
    uk: { slug: "masazh", lead: "Масаж", sub: "Класичний, лікувальний, антицелюлітний та розслаблюючий масаж, виїзд додому." },
  },
  tattoo_artist: {
    ru: { slug: "tatu", lead: "Тату-мастер" },
    uk: { slug: "tatu", lead: "Тату-майстер" },
  },
  electrician: {
    ru: { slug: "elektrik", lead: "Электрик", sub: "Вызов на дом, мелкий ремонт, проводка, розетки и подключение техники." },
    uk: { slug: "elektryk", lead: "Електрик", sub: "Виклик додому, дрібний ремонт, проводка, розетки та підключення техніки." },
  },
  plumber: {
    ru: { slug: "santehnik", lead: "Сантехник", sub: "Устранение протечек, установка сантехники, ремонт труб и подключение бытовой техники." },
    uk: { slug: "santehnik", lead: "Сантехнік", sub: "Усунення протікань, встановлення сантехніки, ремонт труб та підключення техніки." },
  },
  carpenter: {
    ru: { slug: "stolyar", lead: "Столяр" },
    uk: { slug: "teslyar", lead: "Тесляр" },
  },
  painter: {
    ru: { slug: "malyar", lead: "Маляр" },
    uk: { slug: "malyar", lead: "Маляр" },
  },
  mechanic: {
    ru: { slug: "mehanik", lead: "Механик" },
    uk: { slug: "mehanik", lead: "Механік" },
  },
  automechanic: {
    ru: { slug: "avtoslesar", lead: "Автомеханик" },
    uk: { slug: "avtoslyusar", lead: "Автомеханік" },
  },
  construction_worker: {
    ru: { slug: "stroitel", lead: "Строитель" },
    uk: { slug: "budivelnyk", lead: "Будівельник" },
  },
  moving_service: {
    ru: { slug: "perevozki", lead: "Грузоперевозки" },
    uk: { slug: "perevezennya", lead: "Вантажоперевезення" },
  },
  mover: {
    ru: { slug: "gruzchik", lead: "Грузчик" },
    uk: { slug: "vantazhnyk", lead: "Вантажник" },
  },
  photographer: {
    ru: { slug: "fotograf", lead: "Фотограф", sub: "Семейная, индивидуальная и репортажная съёмка, фотосессии в Италии." },
    uk: { slug: "fotograf", lead: "Фотограф", sub: "Сімейна, індивідуальна та репортажна зйомка, фотосесії в Італії." },
  },
  translator: {
    ru: { slug: "perevodchik", lead: "Переводчик", sub: "Устный и письменный перевод, сопровождение в учреждениях, перевод документов." },
    uk: { slug: "perekladach", lead: "Перекладач", sub: "Усний та письмовий переклад, супровід в установах, переклад документів." },
  },
  assistance_with_documents: {
    ru: { slug: "pomosh-s-dokumentami", lead: "Помощь с документами" },
    uk: { slug: "dopomoga-z-dokumentamy", lead: "Допомога з документами" },
  },
  tutor: {
    ru: { slug: "repetitor", lead: "Репетитор" },
    uk: { slug: "repetytor", lead: "Репетитор" },
  },
  language_teacher: {
    ru: { slug: "prepodavatel-yazyka", lead: "Преподаватель языка" },
    uk: { slug: "vykladach-movy", lead: "Викладач мови" },
  },
  teacher: {
    ru: { slug: "uchitel", lead: "Учитель" },
    uk: { slug: "vchytel", lead: "Вчитель" },
  },
  art_teacher: {
    ru: { slug: "uchitel-risovaniya", lead: "Учитель рисования" },
    uk: { slug: "vchytel-malyuvannya", lead: "Вчитель малювання" },
  },
  childcare_worker: {
    ru: { slug: "nyanya", lead: "Няня" },
    uk: { slug: "nyanya", lead: "Няня" },
  },
  dentist: {
    ru: { slug: "stomatolog", lead: "Стоматолог", sub: "Лечение и удаление зубов, гигиена, протезирование и консультации на родном языке." },
    uk: { slug: "stomatolog", lead: "Стоматолог", sub: "Лікування та видалення зубів, гігієна, протезування і консультації рідною мовою." },
  },
  doctor: {
    ru: { slug: "vrach", lead: "Русскоязычный врач" },
    uk: { slug: "likar", lead: "Україномовний лікар" },
  },
  psychologist: {
    ru: { slug: "psiholog", lead: "Психолог" },
    uk: { slug: "psyholog", lead: "Психолог" },
  },
  lawyer: {
    ru: { slug: "yurist", lead: "Юрист" },
    uk: { slug: "yuryst", lead: "Юрист" },
  },
  accountant: {
    ru: { slug: "buhgalter", lead: "Бухгалтер" },
    uk: { slug: "buhgalter", lead: "Бухгалтер" },
  },
  chef: {
    ru: { slug: "povar", lead: "Повар" },
    uk: { slug: "kuhar", lead: "Кухар" },
  },
  taxi: {
    ru: { slug: "taksi", lead: "Такси" },
    uk: { slug: "taksi", lead: "Таксі" },
  },
  driver: {
    ru: { slug: "voditel", lead: "Водитель" },
    uk: { slug: "vodiy", lead: "Водій" },
  },
  housekeeper: {
    ru: { slug: "gornichnaya", lead: "Горничная" },
    uk: { slug: "pokoivka", lead: "Покоївка" },
  },
};

// Full prepositional phrase per city per language ("в Милане" / "у Мілані").
// Baked in to avoid grammar bugs (RU is always "в"/"во"; UK alternates у/в).
// Cities not listed fall back to a derived phrase in data.ts.
export const CITY_PREP: Record<string, Record<Lang, string>> = {
  turin: { ru: "в Турине", uk: "у Турині" },
  milan: { ru: "в Милане", uk: "у Мілані" },
  brescia: { ru: "в Брешиа", uk: "у Брешії" },
  rome: { ru: "в Риме", uk: "в Римі" },
  naples: { ru: "в Неаполе", uk: "у Неаполі" },
  bologna: { ru: "в Болонье", uk: "в Болоньї" },
  florence: { ru: "во Флоренции", uk: "у Флоренції" },
  bari: { ru: "в Бари", uk: "в Барі" },
  catania: { ru: "в Катании", uk: "у Катанії" },
  genoa: { ru: "в Генуе", uk: "у Генуї" },
  venice: { ru: "в Венеции", uk: "у Венеції" },
  messina: { ru: "в Мессине", uk: "у Мессіні" },
  verona: { ru: "в Вероне", uk: "у Вероні" },
  padua: { ru: "в Падуе", uk: "у Падуї" },
  lecce: { ru: "в Лечче", uk: "у Лечче" },
};
