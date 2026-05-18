// Generic bio templates per language — randomly pre-fill the "About you" field
// so users have a starting point and don't stall on a blank textarea.
// Languages not listed here fall back to English.

export const BIO_TEMPLATES: Record<string, string[]> = {
  uk: [
    "Надаю якісні послуги в зручний для вас час. Відповідаю на повідомлення протягом кількох годин, часто — швидше. Є всі необхідні інструменти, ціни чесні, терміни дотримую.",
    "Досвідчений майстер з кількарічним досвідом роботи в Італії. Виїзд у зручний для вас час, в тому числі у вихідні. Консультую безкоштовно — просто напишіть.",
    "Акуратна робота, прозорі ціни, пунктуальність. Приїду до вас у зручний час. Відповідаю оперативно — пишіть або телефонуйте.",
  ],
  ru: [
    "Предоставляю качественные услуги в удобное для вас время. Отвечаю на сообщения в течение нескольких часов, нередко быстрее. Все необходимые инструменты есть, цены честные, сроки соблюдаю.",
    "Опытный мастер с многолетним стажем работы в Италии. Выезд в удобное для вас время, включая выходные. Консультирую бесплатно — просто напишите.",
    "Аккуратная работа, прозрачные цены, пунктуальность. Приеду к вам в удобное время. Отвечаю оперативно — пишите или звоните.",
  ],
  it: [
    "Offro servizi di qualità all'orario che ti conviene. Rispondo ai messaggi entro poche ore, spesso prima. Tutto il necessario a disposizione, prezzi onesti, rispetto dei tempi.",
    "Artigiano esperto con diversi anni di lavoro in Italia. Disponibile nei giorni feriali e nei fine settimana. Consulenza gratuita — scrivimi.",
    "Lavoro preciso, prezzi trasparenti, puntualità. Vengo da te quando ti fa comodo. Risposta rapida — scrivi o chiama.",
  ],
  pt: [
    "Ofereço serviços de qualidade no horário que lhe for conveniente. Respondo às mensagens em poucas horas, muitas vezes mais depressa. Tenho todo o material necessário, preços honestos, cumpro os prazos.",
    "Profissional experiente com vários anos de trabalho em Itália. Disponível em dias úteis e fins de semana. Consulta gratuita — escreva-me.",
  ],
  de: [
    "Ich biete qualitativ hochwertige Leistungen zu einem für Sie günstigen Zeitpunkt. Ich antworte auf Nachrichten innerhalb weniger Stunden, oft schneller. Alle nötigen Werkzeuge dabei, faire Preise, Termine werden eingehalten.",
    "Erfahrener Handwerker mit mehrjähriger Erfahrung in Italien. Verfügbar werktags und am Wochenende. Kostenlose Beratung — schreib mir einfach.",
  ],
  fr: [
    "Je propose des services de qualité à l'heure qui vous convient. Je réponds aux messages en quelques heures, souvent plus vite. Tout le matériel nécessaire, tarifs honnêtes, délais respectés.",
    "Artisan expérimenté avec plusieurs années d'expérience en Italie. Disponible en semaine et le week-end. Consultation gratuite — écrivez-moi.",
  ],
  tr: [
    "Size uygun bir zamanda kaliteli hizmet sunuyorum. Mesajlara birkaç saat içinde yanıt veriyorum, çoğu zaman daha hızlı. Gerekli tüm ekipman elimde, fiyatlar dürüst, teslim tarihleri tutuluyor.",
    "İtalya'da yıllarca çalışmış deneyimli bir usta. Hafta içi ve hafta sonları müsaitim. Ücretsiz danışma — sadece yazın.",
  ],
  es: [
    "Ofrezco servicios de calidad a la hora que te venga bien. Respondo mensajes en pocas horas, a menudo antes. Todo el material necesario, precios honestos, plazos cumplidos.",
    "Artesano experimentado con varios años de trabajo en Italia. Disponible entre semana y los fines de semana. Consulta gratuita — escríbeme.",
  ],
  en: [
    "I provide quality services at a time convenient for you. I reply within a few hours, often sooner. All necessary tools on hand, fair prices, deadlines respected.",
    "Experienced craftsman with several years of work in Italy. Available on weekdays and weekends. Free consultation — just write to me.",
    "Neat work, transparent pricing, punctual. I'll come to your location when it suits you. Quick to respond — text or call.",
  ],
};

export function pickBioTemplate(lang: string): string {
  const pool = BIO_TEMPLATES[lang] ?? BIO_TEMPLATES.en;
  return pool[Math.floor(Math.random() * pool.length)];
}
