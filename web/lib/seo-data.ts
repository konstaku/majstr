import type { Lang } from "./i18n";

// Keyword-aligned, per-language SEO data sourced from dedicated RU/UK diaspora
// keyword research. `slug` is the latin URL token (matches how users search,
// e.g. "manikyur"); `lead` is the service-noun phrase used in <title> (with
// nominative city) and <h1> (with prepositional city); `sub` is a
// profession-specific sentence injected into body copy to keep pages unique
// (important for Yandex's text-originality scoring). English mirrors the same
// shape for the English-searching diaspora.

export interface ProfSeo {
  slug: string;
  lead: string;
  sub?: string; // profession subtopics — body-copy uniqueness
}

// "How to choose / what to ask" line per profession (second body paragraph).
// Falls back to a generic tip in content.ts when a profession isn't listed.
export const PROFESSION_TIPS: Record<string, Record<Lang, string>> = {
  manicurist: {
    ru: "Перед записью уточните, какие материалы использует мастер, и посмотрите фото готовых работ.",
    uk: "Перед записом уточніть, які матеріали використовує майстер, і перегляньте фото робіт.",
    en: "Before booking, check which materials the master uses and look at photos of finished work.",
  },
  pedicurist: {
    ru: "Уточните вид педикюра (аппаратный, классический) и есть ли обработка стерильными инструментами.",
    uk: "Уточніть вид педикюру (апаратний, класичний) та чи є обробка стерильними інструментами.",
    en: "Ask about the type of pedicure (hardware or classic) and whether instruments are sterilized.",
  },
  hairdresser: {
    ru: "Обсудите желаемый результат и принесите фото-примеры — так мастеру проще понять задачу.",
    uk: "Обговоріть бажаний результат і принесіть фото-приклади — так майстру простіше зрозуміти задачу.",
    en: "Discuss the result you want and bring photo examples — it helps the master understand the task.",
  },
  beautician: {
    ru: "Расскажите о типе кожи и целях ухода, чтобы мастер подобрал подходящие процедуры.",
    uk: "Розкажіть про тип шкіри та цілі догляду, щоб майстер підібрав відповідні процедури.",
    en: "Tell the master about your skin type and goals so they can recommend the right treatments.",
  },
  massage: {
    ru: "Уточните вид массажа, длительность сеанса и возможность выезда на дом.",
    uk: "Уточніть вид масажу, тривалість сеансу та можливість виїзду додому.",
    en: "Check the type of massage, the session length and whether home visits are possible.",
  },
  electrician: {
    ru: "Заранее опишите задачу и спросите про выезд, сроки и оценку стоимости работ.",
    uk: "Заздалегідь опишіть завдання та запитайте про виїзд, терміни й оцінку вартості робіт.",
    en: "Describe the job in advance and ask about call-outs, timing and a cost estimate.",
  },
  plumber: {
    ru: "Опишите проблему и спросите про срочный выезд и гарантию на работу.",
    uk: "Опишіть проблему та запитайте про терміновий виїзд і гарантію на роботу.",
    en: "Describe the problem and ask about urgent call-outs and a warranty on the work.",
  },
  dentist: {
    ru: "Уточните, какие услуги и страховки доступны, и запишитесь на первичную консультацию.",
    uk: "Уточніть, які послуги та страховки доступні, і запишіться на первинну консультацію.",
    en: "Ask which services and insurance are available, and book an initial consultation.",
  },
  translator: {
    ru: "Уточните язык, тип документа и нужна ли заверенная (присяжная) копия перевода.",
    uk: "Уточніть мову, тип документа та чи потрібна завірена (присяжна) копія перекладу.",
    en: "Specify the language, the document type and whether a sworn (certified) translation is needed.",
  },
  photographer: {
    ru: "Обсудите формат съёмки, локацию и сроки получения готовых фотографий.",
    uk: "Обговоріть формат зйомки, локацію та терміни отримання готових фотографій.",
    en: "Discuss the shoot format, the location and the turnaround time for the final photos.",
  },
  tutor: {
    ru: "Уточните предмет, уровень и формат занятий — онлайн или очно.",
    uk: "Уточніть предмет, рівень і формат занять — онлайн чи очно.",
    en: "Specify the subject, the level and the format — online or in person.",
  },
};

// Italian region per city (nominative, RU/UK/EN). Used to add a truthful,
// city-specific sentence to landing pages so they aren't near-duplicates.
export const CITY_REGION: Record<string, Record<Lang, string>> = {
  turin: { ru: "Пьемонт", uk: "П'ємонт", en: "Piedmont" },
  milan: { ru: "Ломбардия", uk: "Ломбардія", en: "Lombardy" },
  brescia: { ru: "Ломбардия", uk: "Ломбардія", en: "Lombardy" },
  rome: { ru: "Лацио", uk: "Лаціо", en: "Lazio" },
  naples: { ru: "Кампания", uk: "Кампанія", en: "Campania" },
  bologna: { ru: "Эмилия-Романья", uk: "Емілія-Романья", en: "Emilia-Romagna" },
  florence: { ru: "Тоскана", uk: "Тоскана", en: "Tuscany" },
  bari: { ru: "Апулия", uk: "Апулія", en: "Apulia" },
  lecce: { ru: "Апулия", uk: "Апулія", en: "Apulia" },
  catania: { ru: "Сицилия", uk: "Сицилія", en: "Sicily" },
  messina: { ru: "Сицилия", uk: "Сицилія", en: "Sicily" },
  genoa: { ru: "Лигурия", uk: "Лігурія", en: "Liguria" },
  venice: { ru: "Венето", uk: "Венето", en: "Veneto" },
  verona: { ru: "Венето", uk: "Венето", en: "Veneto" },
  padua: { ru: "Венето", uk: "Венето", en: "Veneto" },
  bergamo: { ru: "Ломбардия", uk: "Ломбардія", en: "Lombardy" },
  palermo: { ru: "Сицилия", uk: "Сицилія", en: "Sicily" },
  // ── France ──
  nice: { ru: "Лазурный Берег", uk: "Лазурний Берег", en: "Côte d'Azur" },
  cannes: { ru: "Лазурный Берег", uk: "Лазурний Берег", en: "Côte d'Azur" },
  menton: { ru: "Лазурный Берег", uk: "Лазурний Берег", en: "Côte d'Azur" },
  frejus: { ru: "Лазурный Берег", uk: "Лазурний Берег", en: "Côte d'Azur" },
  toulon: { ru: "Лазурный Берег", uk: "Лазурний Берег", en: "Côte d'Azur" },
  "saint-tropez": { ru: "Лазурный Берег", uk: "Лазурний Берег", en: "Côte d'Azur" },
  marseille: { ru: "Прованс", uk: "Прованс", en: "Provence" },
  montpellier: { ru: "Окситания", uk: "Окситанія", en: "Occitanie" },
};

export const PROFESSION_SEO: Record<string, Record<Lang, ProfSeo>> = {
  manicurist: {
    ru: { slug: "manikyur", lead: "Маникюр", sub: "Аппаратный и комбинированный маникюр, наращивание, гель-лак, дизайн и укрепление ногтей." },
    uk: { slug: "manikyur", lead: "Манікюр", sub: "Апаратний і комбінований манікюр, нарощування, гель-лак, дизайн та зміцнення нігтів." },
    en: { slug: "manicure", lead: "Manicure", sub: "Hardware and combined manicure, extensions, gel polish, nail design and strengthening." },
  },
  pedicurist: {
    ru: { slug: "pedikyur", lead: "Педикюр" },
    uk: { slug: "pedykyur", lead: "Педикюр" },
    en: { slug: "pedicure", lead: "Pedicure" },
  },
  hairdresser: {
    ru: { slug: "parikmaher", lead: "Парикмахер", sub: "Стрижки, окрашивание, мелирование, укладки и уход за волосами." },
    uk: { slug: "perukar", lead: "Перукар", sub: "Стрижки, фарбування, мелірування, укладки та догляд за волоссям." },
    en: { slug: "hairdresser", lead: "Hairdresser", sub: "Haircuts, coloring, highlights, styling and hair care." },
  },
  beautician: {
    ru: { slug: "kosmetolog", lead: "Косметолог", sub: "Чистка лица, пилинги, уходовые процедуры и аппаратная косметология." },
    uk: { slug: "kosmetolog", lead: "Косметолог", sub: "Чистка обличчя, пілінги, доглядові процедури та апаратна косметологія." },
    en: { slug: "beautician", lead: "Beautician", sub: "Facial cleansing, peels, skincare treatments and hardware cosmetology." },
  },
  makeup_artist: {
    ru: { slug: "vizazhist", lead: "Визажист" },
    uk: { slug: "vizazhyst", lead: "Візажист" },
    en: { slug: "makeup-artist", lead: "Makeup artist" },
  },
  eyebrows: {
    ru: { slug: "brovist", lead: "Мастер бровей" },
    uk: { slug: "brovist", lead: "Майстер брів" },
    en: { slug: "brow-artist", lead: "Brow artist" },
  },
  eyelash_extension: {
    ru: { slug: "naraschivanie-resnic", lead: "Наращивание ресниц" },
    uk: { slug: "naroshchuvannya-vij", lead: "Нарощування вій" },
    en: { slug: "eyelash-extensions", lead: "Eyelash extensions" },
  },
  depilation: {
    ru: { slug: "depilyaciya", lead: "Депиляция" },
    uk: { slug: "depilyaciya", lead: "Депіляція" },
    en: { slug: "waxing", lead: "Waxing" },
  },
  massage: {
    ru: { slug: "massazh", lead: "Массаж", sub: "Классический, лечебный, антицеллюлитный и расслабляющий массаж, выезд на дом." },
    uk: { slug: "masazh", lead: "Масаж", sub: "Класичний, лікувальний, антицелюлітний та розслаблюючий масаж, виїзд додому." },
    en: { slug: "massage", lead: "Massage", sub: "Classic, therapeutic, anti-cellulite and relaxing massage, with home visits." },
  },
  tattoo_artist: {
    ru: { slug: "tatu", lead: "Тату-мастер" },
    uk: { slug: "tatu", lead: "Тату-майстер" },
    en: { slug: "tattoo-artist", lead: "Tattoo artist" },
  },
  electrician: {
    ru: { slug: "elektrik", lead: "Электрик", sub: "Вызов на дом, мелкий ремонт, проводка, розетки и подключение техники." },
    uk: { slug: "elektryk", lead: "Електрик", sub: "Виклик додому, дрібний ремонт, проводка, розетки та підключення техніки." },
    en: { slug: "electrician", lead: "Electrician", sub: "Home call-outs, small repairs, wiring, sockets and appliance hookups." },
  },
  plumber: {
    ru: { slug: "santehnik", lead: "Сантехник", sub: "Устранение протечек, установка сантехники, ремонт труб и подключение бытовой техники." },
    uk: { slug: "santehnik", lead: "Сантехнік", sub: "Усунення протікань, встановлення сантехніки, ремонт труб та підключення техніки." },
    en: { slug: "plumber", lead: "Plumber", sub: "Leak repair, fixture installation, pipe repair and appliance hookups." },
  },
  carpenter: {
    ru: { slug: "stolyar", lead: "Столяр" },
    uk: { slug: "teslyar", lead: "Тесляр" },
    en: { slug: "carpenter", lead: "Carpenter" },
  },
  painter: {
    ru: { slug: "malyar", lead: "Маляр" },
    uk: { slug: "malyar", lead: "Маляр" },
    en: { slug: "painter", lead: "Painter" },
  },
  mechanic: {
    ru: { slug: "mehanik", lead: "Механик" },
    uk: { slug: "mehanik", lead: "Механік" },
    en: { slug: "mechanic", lead: "Mechanic" },
  },
  automechanic: {
    ru: { slug: "avtoslesar", lead: "Автомеханик" },
    uk: { slug: "avtoslyusar", lead: "Автомеханік" },
    en: { slug: "auto-mechanic", lead: "Auto mechanic" },
  },
  construction_worker: {
    ru: { slug: "stroitel", lead: "Строитель" },
    uk: { slug: "budivelnyk", lead: "Будівельник" },
    en: { slug: "builder", lead: "Builder" },
  },
  moving_service: {
    ru: { slug: "perevozki", lead: "Грузоперевозки" },
    uk: { slug: "perevezennya", lead: "Вантажоперевезення" },
    en: { slug: "moving-service", lead: "Moving service" },
  },
  mover: {
    ru: { slug: "gruzchik", lead: "Грузчик" },
    uk: { slug: "vantazhnyk", lead: "Вантажник" },
    en: { slug: "mover", lead: "Mover" },
  },
  photographer: {
    ru: { slug: "fotograf", lead: "Фотограф", sub: "Семейная, индивидуальная и репортажная съёмка, фотосессии в Италии." },
    uk: { slug: "fotograf", lead: "Фотограф", sub: "Сімейна, індивідуальна та репортажна зйомка, фотосесії в Італії." },
    en: { slug: "photographer", lead: "Photographer", sub: "Family, individual and reportage shoots, photo sessions across Italy." },
  },
  translator: {
    ru: { slug: "perevodchik", lead: "Переводчик", sub: "Устный и письменный перевод, сопровождение в учреждениях, перевод документов." },
    uk: { slug: "perekladach", lead: "Перекладач", sub: "Усний та письмовий переклад, супровід в установах, переклад документів." },
    en: { slug: "translator", lead: "Translator", sub: "Interpreting and written translation, accompaniment at institutions, document translation." },
  },
  assistance_with_documents: {
    ru: { slug: "pomosh-s-dokumentami", lead: "Помощь с документами" },
    uk: { slug: "dopomoga-z-dokumentamy", lead: "Допомога з документами" },
    en: { slug: "document-help", lead: "Help with documents" },
  },
  tutor: {
    ru: { slug: "repetitor", lead: "Репетитор" },
    uk: { slug: "repetytor", lead: "Репетитор" },
    en: { slug: "tutor", lead: "Tutor" },
  },
  language_teacher: {
    ru: { slug: "prepodavatel-yazyka", lead: "Преподаватель языка" },
    uk: { slug: "vykladach-movy", lead: "Викладач мови" },
    en: { slug: "language-teacher", lead: "Language teacher" },
  },
  teacher: {
    ru: { slug: "uchitel", lead: "Учитель" },
    uk: { slug: "vchytel", lead: "Вчитель" },
    en: { slug: "teacher", lead: "Teacher" },
  },
  art_teacher: {
    ru: { slug: "uchitel-risovaniya", lead: "Учитель рисования" },
    uk: { slug: "vchytel-malyuvannya", lead: "Вчитель малювання" },
    en: { slug: "art-teacher", lead: "Art teacher" },
  },
  childcare_worker: {
    ru: { slug: "nyanya", lead: "Няня" },
    uk: { slug: "nyanya", lead: "Няня" },
    en: { slug: "babysitter", lead: "Babysitter" },
  },
  dentist: {
    ru: { slug: "stomatolog", lead: "Стоматолог", sub: "Лечение и удаление зубов, гигиена, протезирование и консультации на родном языке." },
    uk: { slug: "stomatolog", lead: "Стоматолог", sub: "Лікування та видалення зубів, гігієна, протезування і консультації рідною мовою." },
    en: { slug: "dentist", lead: "Dentist", sub: "Treatment and extractions, hygiene, prosthetics and consultations in your own language." },
  },
  doctor: {
    ru: { slug: "vrach", lead: "Русскоязычный врач" },
    uk: { slug: "likar", lead: "Україномовний лікар" },
    en: { slug: "doctor", lead: "Ukrainian-speaking doctor" },
  },
  psychologist: {
    ru: { slug: "psiholog", lead: "Психолог" },
    uk: { slug: "psyholog", lead: "Психолог" },
    en: { slug: "psychologist", lead: "Psychologist" },
  },
  lawyer: {
    ru: { slug: "yurist", lead: "Юрист" },
    uk: { slug: "yuryst", lead: "Юрист" },
    en: { slug: "lawyer", lead: "Lawyer" },
  },
  accountant: {
    ru: { slug: "buhgalter", lead: "Бухгалтер" },
    uk: { slug: "buhgalter", lead: "Бухгалтер" },
    en: { slug: "accountant", lead: "Accountant" },
  },
  chef: {
    ru: { slug: "povar", lead: "Повар" },
    uk: { slug: "kuhar", lead: "Кухар" },
    en: { slug: "chef", lead: "Chef" },
  },
  taxi: {
    ru: { slug: "taksi", lead: "Такси" },
    uk: { slug: "taksi", lead: "Таксі" },
    en: { slug: "taxi", lead: "Taxi" },
  },
  driver: {
    ru: { slug: "voditel", lead: "Водитель" },
    uk: { slug: "vodiy", lead: "Водій" },
    en: { slug: "driver", lead: "Driver" },
  },
  housekeeper: {
    ru: { slug: "gornichnaya", lead: "Горничная" },
    uk: { slug: "pokoivka", lead: "Покоївка" },
    en: { slug: "housekeeper", lead: "Housekeeper" },
  },
};

// Full prepositional phrase per city per language ("в Милане" / "у Мілані" /
// "in Milan"). Baked in to avoid grammar bugs (RU is always "в"/"во"; UK
// alternates у/в; EN is always "in"). Cities not listed fall back to a derived
// phrase in data.ts.
export const CITY_PREP: Record<string, Record<Lang, string>> = {
  turin: { ru: "в Турине", uk: "у Турині", en: "in Turin" },
  milan: { ru: "в Милане", uk: "у Мілані", en: "in Milan" },
  brescia: { ru: "в Брешиа", uk: "у Брешії", en: "in Brescia" },
  rome: { ru: "в Риме", uk: "в Римі", en: "in Rome" },
  naples: { ru: "в Неаполе", uk: "у Неаполі", en: "in Naples" },
  bologna: { ru: "в Болонье", uk: "в Болоньї", en: "in Bologna" },
  florence: { ru: "во Флоренции", uk: "у Флоренції", en: "in Florence" },
  bari: { ru: "в Бари", uk: "в Барі", en: "in Bari" },
  catania: { ru: "в Катании", uk: "у Катанії", en: "in Catania" },
  genoa: { ru: "в Генуе", uk: "у Генуї", en: "in Genoa" },
  venice: { ru: "в Венеции", uk: "у Венеції", en: "in Venice" },
  messina: { ru: "в Мессине", uk: "у Мессіні", en: "in Messina" },
  verona: { ru: "в Вероне", uk: "у Вероні", en: "in Verona" },
  padua: { ru: "в Падуе", uk: "у Падуї", en: "in Padua" },
  lecce: { ru: "в Лечче", uk: "у Лечче", en: "in Lecce" },
  bergamo: { ru: "в Бергамо", uk: "у Бергамо", en: "in Bergamo" },
  palermo: { ru: "в Палермо", uk: "у Палермо", en: "in Palermo" },
};
