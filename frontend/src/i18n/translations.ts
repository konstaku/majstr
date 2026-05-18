export type LangTranslations = {
  nav: { search: string; addMaster: string; faq: string; howItWorks: string; forBusiness: string };
  footer: {
    terms: string;
    faq: string;
    moderation: string;
    feedback: string;
    tagline: string;
    copyright: string;
    madeWith: string;
  };
  main: {
    liveIn: string;
    lookingFor: string;
    allMasters: string;
    allCountry: string;
    inCity: string;
    searching: string;
    cannotSearch: string;
    appTitle: string;
    cityKicker: string;
    tradeKicker: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitle: string;
    liveLabel: string;
    searchBtn: string;
    vettedStrip: string;
    testimonialLabel: string;
    testimonialQuote: string;
    testimonialAttr: string;
    telegramNote: string;
  };
  how: {
    label: string;
    step1Title: string;
    step1Desc: string;
    step2Title: string;
    step2Desc: string;
    step3Title: string;
    step3Desc: string;
  };
  browse: { label: string; allCategories: string; browseLabel: string };
  results: { found: string; empty: string; tryChanging: string; sortedByRating: string };
  modal: { noAbout: string; languages: string; about: string; skills: string; contact: string };
  masterCard: { details: string; noReviews: string; verified: string; memberSince: string };
  badge: { newThisWeek: string; recentlyAdded: string };
  cta: { microcopy: string };
  login: { loading: string; error: string; home: string };
  availability: { available: string; next_week: string; busy: string };
  countryNames: Record<string, string>;
};

export const translations: Record<string, LangTranslations> = {
  uk: {
    nav: { search: "Пошук", addMaster: "Додати майстра", faq: "FAQ", howItWorks: "Як це працює", forBusiness: "Для бізнесу" },
    footer: {
      terms: "Умови використання",
      faq: "Питання та відповіді",
      moderation: "Політика модерації",
      feedback: "Зворотній звʼязок",
      tagline: "Ваш сусідський майстер, просто українець. Знаходьте перевірених спеціалістів в Італії та Португалії.",
      copyright: "© 2025 Majstr. Всі права захищені.",
      madeWith: "Зроблено з ❤️ 🇺🇦 для української громади",
    },
    main: {
      liveIn: "Я мешкаю в",
      lookingFor: "та шукаю",
      allMasters: "Всі майстри",
      allCountry: "Вся {country}",
      inCity: "в",
      searching: "Шукаємо...",
      cannotSearch: "Неможливо виконати запит",
      appTitle: "Majstr : Знаходь українських майстрів",
      cityKicker: "Місто",
      tradeKicker: "Спеціальність",
    },
    hero: {
      eyebrow: "2 400+ перевірених українських майстрів в Італії та Португалії",
      title: "Знайди перевіреного майстра,",
      titleAccent: "що говорить твоєю мовою.",
      subtitle: "Знаходьте сантехніків, електриків, косметологів, IT-спеціалістів та інших — надійних, перевірених, готових до роботи.",
      liveLabel: "Онлайн · Оновлено щойно",
      searchBtn: "ПОШУК →",
      vettedStrip: "Перевірені · Вільномовні · Готові",
      testimonialLabel: "Що кажуть клієнти",
      testimonialQuote: "Хочу поділитися відгуком про роботу з Максимом, якого знайшов тут. Він організував наш переїзд із Санремо до Лекко. Хлопці акуратно запакували та перевезли всі меблі, включаючи холодильник, пральну машину та інші великі речі. На місці все розвантажили та підняли на високий поверх. Все виконано чітко та вчасно. Настійно рекомендую роботу з Максимом.",
      testimonialAttr: "КОСТЯНТИН К. · САНРЕМО · ★ 5/5",
      telegramNote: "Telegram · Без посередників · Безкоштовно",
    },
    how: {
      label: "Як це працює",
      step1Title: "Знайди",
      step1Desc: "Пошук за містом та навичкою",
      step2Title: "Контакт",
      step2Desc: "Напиши через Telegram",
      step3Title: "Замов",
      step3Desc: "Домовся напряму",
    },
    browse: { label: "Переглянути за категорією", allCategories: "Всі категорії", browseLabel: "Перегляд →" },
    results: {
      found: "Знайдено майстрів:",
      empty: "Майстрів за вашим запитом не знайдено.",
      tryChanging: "Спробуйте змінити місто або категорію.",
      sortedByRating: "МАЙСТРІВ · ЗА РЕЙТИНГОМ",
    },
    modal: {
      noAbout: "Нажаль, майстер не має детального опису 🤷‍♂️",
      languages: "Мови",
      about: "Про майстра",
      skills: "Навички",
      contact: "Зв'язатися",
    },
    masterCard: { details: "OPEN", noReviews: "Поки немає відгуків", verified: "Профіль підтверджено", memberSince: "Учасник з" },
    badge: { newThisWeek: "Новий цього тижня", recentlyAdded: "Щойно доданий" },
    cta: { microcopy: "3 хв · Безкоштовно · Telegram" },
    login: {
      loading: "Вхід в систему...",
      error: "Посилання для входу недійсне або застаріле. Відкрийте бота ще раз.",
      home: "На головну",
    },
    availability: {
      available: "Доступний цього тижня",
      next_week: "Доступний наступного тижня",
      busy: "Зайнятий",
    },
    countryNames: { IT: "Італія", PT: "Португалія" },
  },

  en: {
    nav: { search: "Search", addMaster: "Add master", faq: "FAQ", howItWorks: "How it works", forBusiness: "For business" },
    footer: {
      terms: "Terms of use",
      faq: "FAQ",
      moderation: "Moderation policy",
      feedback: "Feedback",
      tagline: "Your neighbourhood craftsman, just Ukrainian. Connecting skilled workers with clients across Italy and Portugal.",
      copyright: "© 2025 Majstr. All rights reserved.",
      madeWith: "Made with ❤️ 🇺🇦 for the Ukrainian community",
    },
    main: {
      liveIn: "I live in",
      lookingFor: "and looking for",
      allMasters: "All masters",
      allCountry: "All {country}",
      inCity: "in",
      searching: "Searching...",
      cannotSearch: "Cannot perform search",
      appTitle: "Majstr : Find Ukrainian craftsmen",
      cityKicker: "City",
      tradeKicker: "Trade",
    },
    hero: {
      eyebrow: "2,400+ verified Ukrainian masters in Italy & Portugal",
      title: "Find trusted masters",
      titleAccent: "who speak your language.",
      subtitle: "Find plumbers, electricians, beauticians, IT experts and more — trusted, vetted, ready to work.",
      liveLabel: "Live · Updated just now",
      searchBtn: "SEARCH →",
      vettedStrip: "Vetted · Fluent · Ready",
      testimonialLabel: "What clients say",
      testimonialQuote: "I want to share a review of working with Maxim, whom I found here. He organized our move from Sanremo to Lecco. They packed and carefully transported all the furniture, including the refrigerator, washing machine, and other large items. They unloaded everything on site and transported it to a high floor. Everything was done efficiently and on time. I highly recommend working with Maxim.",
      testimonialAttr: "KONSTANTIN K. · SANREMO · ★ 5/5",
      telegramNote: "Via Telegram · No middlemen · Free",
    },
    how: {
      label: "How it works",
      step1Title: "Find",
      step1Desc: "Search by city & skill",
      step2Title: "Contact",
      step2Desc: "Message via Telegram",
      step3Title: "Hire",
      step3Desc: "Book your job directly",
    },
    browse: { label: "Browse by Category", allCategories: "All Categories", browseLabel: "Browse →" },
    results: {
      found: "Masters found:",
      empty: "No masters found for your request.",
      tryChanging: "Try changing the city or category.",
      sortedByRating: "RESULTS · SORTED BY RATING",
    },
    modal: {
      noAbout: "Unfortunately, the master has no detailed description 🤷‍♂️",
      languages: "Languages",
      about: "About",
      skills: "Skills",
      contact: "Contact",
    },
    masterCard: { details: "OPEN", noReviews: "No reviews yet", verified: "Profile verified", memberSince: "Member since" },
    badge: { newThisWeek: "New this week", recentlyAdded: "Recently added" },
    cta: { microcopy: "3 min · Free · Via Telegram" },
    login: {
      loading: "Logging in...",
      error: "This login link is invalid or has expired. Please open the bot again.",
      home: "Go home",
    },
    availability: {
      available: "Available this week",
      next_week: "Available next week",
      busy: "Busy",
    },
    countryNames: { IT: "Italy", PT: "Portugal" },
  },

  it: {
    nav: { search: "Cerca", addMaster: "Aggiungi artigiano", faq: "FAQ", howItWorks: "Come funziona", forBusiness: "Per le aziende" },
    footer: {
      terms: "Termini di utilizzo",
      faq: "Domande frequenti",
      moderation: "Politica di moderazione",
      feedback: "Contattaci",
      tagline: "Il tuo artigiano di quartiere, semplicemente ucraino. Connetti lavoratori qualificati con clienti in tutta Italia e Portogallo.",
      copyright: "© 2025 Majstr. Tutti i diritti riservati.",
      madeWith: "Fatto con ❤️ 🇺🇦 per la comunità ucraina",
    },
    main: {
      liveIn: "Abito a",
      lookingFor: "e cerco",
      allMasters: "Tutti gli artigiani",
      allCountry: "Tutta la {country}",
      inCity: "a",
      searching: "Ricerca in corso...",
      cannotSearch: "Impossibile eseguire la ricerca",
      appTitle: "Majstr : Trova artigiani ucraini",
      cityKicker: "Città",
      tradeKicker: "Mestiere",
    },
    hero: {
      eyebrow: "2.400+ artigiani ucraini verificati in Italia e Portogallo",
      title: "Trova artigiani di fiducia",
      titleAccent: "che parlano la tua lingua.",
      subtitle: "Trova idraulici, elettricisti, estetiste, esperti IT e altro — affidabili, verificati, pronti a lavorare.",
      liveLabel: "Live · Aggiornato adesso",
      searchBtn: "CERCA →",
      vettedStrip: "Verificati · Fluenti · Pronti",
      testimonialLabel: "Cosa dicono i clienti",
      testimonialQuote: "Voglio condividere una recensione su Maxim, che ho trovato qui. Ha organizzato il nostro trasloco da Sanremo a Lecco. Hanno imballato e trasportato con cura tutti i mobili, inclusi il frigorifero, la lavatrice e altri oggetti ingombranti. Hanno scaricato tutto sul posto e portato a un piano alto. Tutto è stato fatto in modo efficiente e puntuale. Raccomando vivamente Maxim.",
      testimonialAttr: "KONSTANTIN K. · SANREMO · ★ 5/5",
      telegramNote: "Via Telegram · Senza intermediari · Gratuito",
    },
    how: {
      label: "Come funziona",
      step1Title: "Trova",
      step1Desc: "Cerca per città e competenza",
      step2Title: "Contatta",
      step2Desc: "Scrivi su Telegram",
      step3Title: "Assumi",
      step3Desc: "Prenota direttamente",
    },
    browse: { label: "Sfoglia per Categoria", allCategories: "Tutte le Categorie", browseLabel: "Sfoglia →" },
    results: {
      found: "Artigiani trovati:",
      empty: "Nessun artigiano trovato per la tua ricerca.",
      tryChanging: "Prova a cambiare città o categoria.",
      sortedByRating: "ARTIGIANI · PER VALUTAZIONE",
    },
    modal: {
      noAbout: "Purtroppo, l'artigiano non ha una descrizione dettagliata 🤷‍♂️",
      languages: "Lingue",
      about: "Chi sono",
      skills: "Competenze",
      contact: "Contatta",
    },
    masterCard: { details: "OPEN", noReviews: "Nessuna recensione", verified: "Profilo verificato", memberSince: "Membro da" },
    badge: { newThisWeek: "Nuovo questa settimana", recentlyAdded: "Aggiunto di recente" },
    cta: { microcopy: "3 min · Gratis · Via Telegram" },
    login: {
      loading: "Accesso in corso...",
      error: "Il link di accesso non è valido o è scaduto. Riapri il bot.",
      home: "Vai alla home",
    },
    availability: {
      available: "Disponibile questa settimana",
      next_week: "Disponibile la prossima settimana",
      busy: "Occupato",
    },
    countryNames: { IT: "Italia", PT: "Portogallo" },
  },

  pt: {
    nav: { search: "Pesquisar", addMaster: "Adicionar artesão", faq: "FAQ", howItWorks: "Como funciona", forBusiness: "Para empresas" },
    footer: {
      terms: "Termos de uso",
      faq: "Perguntas frequentes",
      moderation: "Política de moderação",
      feedback: "Feedback",
      tagline: "O seu artesão de bairro, simplesmente ucraniano. A ligar trabalhadores qualificados a clientes em toda a Itália e Portugal.",
      copyright: "© 2025 Majstr. Todos os direitos reservados.",
      madeWith: "Feito com ❤️ 🇺🇦 para a comunidade ucraniana",
    },
    main: {
      liveIn: "Moro em",
      lookingFor: "e procuro",
      allMasters: "Todos os artesãos",
      allCountry: "Todo o {country}",
      inCity: "em",
      searching: "A pesquisar...",
      cannotSearch: "Não é possível realizar a pesquisa",
      appTitle: "Majstr : Encontre artesãos ucranianos",
      cityKicker: "Cidade",
      tradeKicker: "Ofício",
    },
    hero: {
      eyebrow: "2.400+ artesãos ucranianos verificados em Itália e Portugal",
      title: "Encontre artesãos de confiança",
      titleAccent: "que falam a sua língua.",
      subtitle: "Encontre canalizadores, eletricistas, esteticistas, especialistas em TI e mais — de confiança, verificados, prontos a trabalhar.",
      liveLabel: "Live · Actualizado agora",
      searchBtn: "PESQUISAR →",
      vettedStrip: "Verificados · Fluentes · Prontos",
      testimonialLabel: "O que dizem os clientes",
      testimonialQuote: "Quero partilhar uma avaliação sobre o Maxim, que encontrei aqui. Ele organizou a nossa mudança de Sanremo para Lecco. Embalaram e transportaram com cuidado todos os móveis, incluindo o frigorífico, a máquina de lavar e outros artigos grandes. Descarregaram tudo no local e levaram a um andar alto. Tudo foi feito de forma eficiente e a tempo. Recomendo vivamente o Maxim.",
      testimonialAttr: "KONSTANTIN K. · SANREMO · ★ 5/5",
      telegramNote: "Via Telegram · Sem intermediários · Gratuito",
    },
    how: {
      label: "Como funciona",
      step1Title: "Encontre",
      step1Desc: "Pesquise por cidade e competência",
      step2Title: "Contacte",
      step2Desc: "Escreva pelo Telegram",
      step3Title: "Contrate",
      step3Desc: "Reserve diretamente",
    },
    browse: { label: "Explorar por Categoria", allCategories: "Todas as Categorias", browseLabel: "Explorar →" },
    results: {
      found: "Artesãos encontrados:",
      empty: "Nenhum artesão encontrado para a sua pesquisa.",
      tryChanging: "Tente mudar a cidade ou categoria.",
      sortedByRating: "ARTESÃOS · POR AVALIAÇÃO",
    },
    modal: {
      noAbout: "Infelizmente, o artesão não tem uma descrição detalhada 🤷‍♂️",
      languages: "Idiomas",
      about: "Sobre",
      skills: "Competências",
      contact: "Contactar",
    },
    masterCard: { details: "OPEN", noReviews: "Sem avaliações", verified: "Perfil verificado", memberSince: "Membro desde" },
    badge: { newThisWeek: "Novo esta semana", recentlyAdded: "Adicionado recentemente" },
    cta: { microcopy: "3 min · Grátis · Via Telegram" },
    login: {
      loading: "A iniciar sessão...",
      error: "O link de acesso é inválido ou expirou. Abre o bot novamente.",
      home: "Ir para o início",
    },
    availability: {
      available: "Disponível esta semana",
      next_week: "Disponível na próxima semana",
      busy: "Ocupado",
    },
    countryNames: { IT: "Itália", PT: "Portugal" },
  },
};

translations.ru = {
  nav: { search: "Поиск", addMaster: "Добавить мастера", faq: "FAQ", howItWorks: "Как это работает", forBusiness: "Для бизнеса" },
  footer: {
    terms: "Условия использования",
    faq: "Вопросы и ответы",
    moderation: "Политика модерации",
    feedback: "Обратная связь",
    tagline: "Ваш соседский мастер, просто украинец. Соединяем квалифицированных специалистов с клиентами по всей Италии и Португалии.",
    copyright: "© 2025 Majstr. Все права защищены.",
    madeWith: "Сделано с ❤️ 🇺🇦 для украинского сообщества",
  },
  main: {
    liveIn: "Я живу в",
    lookingFor: "и ищу",
    allMasters: "Все мастера",
    allCountry: "Вся {country}",
    inCity: "в",
    searching: "Идёт поиск...",
    cannotSearch: "Не удалось выполнить поиск",
    appTitle: "Majstr : Найди украинских мастеров",
    cityKicker: "Город",
    tradeKicker: "Специальность",
  },
  hero: {
    eyebrow: "2 400+ проверенных украинских мастеров в Италии и Португалии",
    title: "Найдите проверенного мастера,",
    titleAccent: "который говорит на вашем языке.",
    subtitle: "Найдите сантехников, электриков, косметологов, IT-специалистов и других — надёжных, проверенных, готовых к работе.",
    liveLabel: "Онлайн · Обновлено только что",
    searchBtn: "ПОИСК →",
    vettedStrip: "Проверены · Свободно говорят · Готовы",
    testimonialLabel: "Что говорят клиенты",
    testimonialQuote: "Хочу поделиться отзывом о работе с Максимом, которого нашёл здесь. Он организовал наш переезд из Сан-Ремо в Лекко. Ребята аккуратно упаковали и перевезли всю мебель, включая холодильник, стиральную машину и другие крупные вещи. На месте всё разгрузили и подняли на высокий этаж. Всё сделано чётко и вовремя. Настоятельно рекомендую работу с Максимом.",
    testimonialAttr: "КОНСТАНТИН К. · САН-РЕМО · ★ 5/5",
    telegramNote: "Через Telegram · Без посредников · Бесплатно",
  },
  how: {
    label: "Как это работает",
    step1Title: "Найдите",
    step1Desc: "Поиск по городу и навыку",
    step2Title: "Свяжитесь",
    step2Desc: "Напишите через Telegram",
    step3Title: "Закажите",
    step3Desc: "Договоритесь напрямую",
  },
  browse: { label: "Просмотр по категории", allCategories: "Все категории", browseLabel: "Просмотр →" },
  results: {
    found: "Найдено мастеров:",
    empty: "По вашему запросу мастера не найдены.",
    tryChanging: "Попробуйте изменить город или категорию.",
    sortedByRating: "МАСТЕРОВ · ПО РЕЙТИНГУ",
  },
  modal: {
    noAbout: "К сожалению, у мастера нет подробного описания 🤷‍♂️",
    languages: "Языки",
    about: "О мастере",
    skills: "Навыки",
    contact: "Связаться",
  },
  masterCard: { details: "OPEN", noReviews: "Пока нет отзывов", verified: "Профиль подтверждён", memberSince: "Участник с" },
  badge: { newThisWeek: "Новый на этой неделе", recentlyAdded: "Недавно добавлен" },
  cta: { microcopy: "3 мин · Бесплатно · Через Telegram" },
  login: {
    loading: "Вход в систему...",
    error: "Ссылка для входа недействительна или устарела. Откройте бота снова.",
    home: "На главную",
  },
  availability: {
    available: "Доступен на этой неделе",
    next_week: "Доступен на следующей неделе",
    busy: "Занят",
  },
  countryNames: { IT: "Италия", PT: "Португалия" },
};

translations.de = {
  nav: { search: "Suchen", addMaster: "Fachkraft hinzufügen", faq: "FAQ", howItWorks: "So funktioniert's", forBusiness: "Für Unternehmen" },
  footer: {
    terms: "Nutzungsbedingungen",
    faq: "Häufige Fragen",
    moderation: "Moderationsrichtlinie",
    feedback: "Feedback",
    tagline: "Deine Fachkraft aus der Nachbarschaft, einfach ukrainisch. Wir bringen qualifizierte Fachkräfte und Kunden in ganz Italien und Portugal zusammen.",
    copyright: "© 2025 Majstr. Alle Rechte vorbehalten.",
    madeWith: "Gemacht mit ❤️ 🇺🇦 für die ukrainische Community",
  },
  main: {
    liveIn: "Ich wohne in",
    lookingFor: "und suche",
    allMasters: "Alle Fachkräfte",
    allCountry: "Ganz {country}",
    inCity: "in",
    searching: "Suche läuft...",
    cannotSearch: "Suche nicht möglich",
    appTitle: "Majstr : Finde ukrainische Fachkräfte",
    cityKicker: "Stadt",
    tradeKicker: "Beruf",
  },
  hero: {
    eyebrow: "2.400+ geprüfte ukrainische Fachkräfte in Italien und Portugal",
    title: "Finde geprüfte Fachkräfte,",
    titleAccent: "die deine Sprache sprechen.",
    subtitle: "Finde Installateure, Elektriker, Kosmetiker, IT-Profis und mehr — vertrauenswürdig, geprüft, einsatzbereit.",
    liveLabel: "Live · Gerade aktualisiert",
    searchBtn: "SUCHEN →",
    vettedStrip: "Geprüft · Sprachgewandt · Einsatzbereit",
    testimonialLabel: "Was Kunden sagen",
    testimonialQuote: "Ich möchte einen Erfahrungsbericht über die Zusammenarbeit mit Maxim teilen, den ich hier gefunden habe. Er hat unseren Umzug von Sanremo nach Lecco organisiert. Sie haben alle Möbel sorgfältig verpackt und transportiert, einschließlich Kühlschrank, Waschmaschine und anderer großer Gegenstände. Sie haben alles vor Ort ausgeladen und in ein hohes Stockwerk gebracht. Alles wurde effizient und pünktlich erledigt. Ich empfehle die Zusammenarbeit mit Maxim wärmstens.",
    testimonialAttr: "KONSTANTIN K. · SANREMO · ★ 5/5",
    telegramNote: "Über Telegram · Ohne Vermittler · Kostenlos",
  },
  how: {
    label: "So funktioniert's",
    step1Title: "Finden",
    step1Desc: "Suche nach Stadt und Können",
    step2Title: "Kontakt",
    step2Desc: "Schreib über Telegram",
    step3Title: "Beauftragen",
    step3Desc: "Vereinbare direkt",
  },
  browse: { label: "Nach Kategorie stöbern", allCategories: "Alle Kategorien", browseLabel: "Stöbern →" },
  results: {
    found: "Gefundene Fachkräfte:",
    empty: "Keine Fachkräfte für deine Anfrage gefunden.",
    tryChanging: "Versuch, die Stadt oder Kategorie zu ändern.",
    sortedByRating: "ERGEBNISSE · NACH BEWERTUNG",
  },
  modal: {
    noAbout: "Leider hat diese Fachkraft keine ausführliche Beschreibung 🤷‍♂️",
    languages: "Sprachen",
    about: "Über",
    skills: "Fähigkeiten",
    contact: "Kontakt",
  },
  masterCard: { details: "OPEN", noReviews: "Noch keine Bewertungen", verified: "Profil bestätigt", memberSince: "Dabei seit" },
  badge: { newThisWeek: "Neu diese Woche", recentlyAdded: "Kürzlich hinzugefügt" },
  cta: { microcopy: "3 Min · Kostenlos · Über Telegram" },
  login: {
    loading: "Anmeldung läuft...",
    error: "Der Login-Link ist ungültig oder abgelaufen. Bitte öffne den Bot erneut.",
    home: "Zur Startseite",
  },
  availability: {
    available: "Diese Woche verfügbar",
    next_week: "Nächste Woche verfügbar",
    busy: "Ausgelastet",
  },
  countryNames: { IT: "Italien", PT: "Portugal" },
};

translations.fr = {
  nav: { search: "Rechercher", addMaster: "Ajouter un artisan", faq: "FAQ", howItWorks: "Comment ça marche", forBusiness: "Pour les entreprises" },
  footer: {
    terms: "Conditions d'utilisation",
    faq: "Questions fréquentes",
    moderation: "Politique de modération",
    feedback: "Votre avis",
    tagline: "Votre artisan de quartier, tout simplement ukrainien. Nous mettons en relation des professionnels qualifiés et des clients partout en Italie et au Portugal.",
    copyright: "© 2025 Majstr. Tous droits réservés.",
    madeWith: "Fait avec ❤️ 🇺🇦 pour la communauté ukrainienne",
  },
  main: {
    liveIn: "J'habite à",
    lookingFor: "et je cherche",
    allMasters: "Tous les artisans",
    allCountry: "Toute la {country}",
    inCity: "à",
    searching: "Recherche en cours...",
    cannotSearch: "Impossible d'effectuer la recherche",
    appTitle: "Majstr : Trouvez des artisans ukrainiens",
    cityKicker: "Ville",
    tradeKicker: "Métier",
  },
  hero: {
    eyebrow: "2 400+ artisans ukrainiens vérifiés en Italie et au Portugal",
    title: "Trouvez des artisans de confiance",
    titleAccent: "qui parlent votre langue.",
    subtitle: "Trouvez des plombiers, électriciens, esthéticiennes, experts IT et plus encore — fiables, vérifiés, prêts à travailler.",
    liveLabel: "En direct · Mis à jour à l'instant",
    searchBtn: "RECHERCHER →",
    vettedStrip: "Vérifiés · À l'aise dans la langue · Prêts",
    testimonialLabel: "Ce que disent les clients",
    testimonialQuote: "Je veux partager un avis sur ma collaboration avec Maxim, que j'ai trouvé ici. Il a organisé notre déménagement de Sanremo à Lecco. Ils ont emballé et transporté avec soin tous les meubles, y compris le réfrigérateur, le lave-linge et d'autres objets volumineux. Ils ont tout déchargé sur place et monté à un étage élevé. Tout a été fait efficacement et dans les temps. Je recommande vivement de travailler avec Maxim.",
    testimonialAttr: "KONSTANTIN K. · SANREMO · ★ 5/5",
    telegramNote: "Via Telegram · Sans intermédiaires · Gratuit",
  },
  how: {
    label: "Comment ça marche",
    step1Title: "Trouvez",
    step1Desc: "Recherche par ville et compétence",
    step2Title: "Contactez",
    step2Desc: "Écrivez via Telegram",
    step3Title: "Engagez",
    step3Desc: "Réservez directement",
  },
  browse: { label: "Parcourir par catégorie", allCategories: "Toutes les catégories", browseLabel: "Parcourir →" },
  results: {
    found: "Artisans trouvés :",
    empty: "Aucun artisan trouvé pour votre recherche.",
    tryChanging: "Essayez de changer de ville ou de catégorie.",
    sortedByRating: "RÉSULTATS · PAR NOTE",
  },
  modal: {
    noAbout: "Malheureusement, cet artisan n'a pas de description détaillée 🤷‍♂️",
    languages: "Langues",
    about: "À propos",
    skills: "Compétences",
    contact: "Contact",
  },
  masterCard: { details: "OPEN", noReviews: "Pas encore d'avis", verified: "Profil vérifié", memberSince: "Membre depuis" },
  badge: { newThisWeek: "Nouveau cette semaine", recentlyAdded: "Ajouté récemment" },
  cta: { microcopy: "3 min · Gratuit · Via Telegram" },
  login: {
    loading: "Connexion en cours...",
    error: "Le lien de connexion est invalide ou a expiré. Rouvre le bot.",
    home: "Accueil",
  },
  availability: {
    available: "Disponible cette semaine",
    next_week: "Disponible la semaine prochaine",
    busy: "Occupé",
  },
  countryNames: { IT: "Italie", PT: "Portugal" },
};

translations.tr = {
  nav: { search: "Ara", addMaster: "Usta ekle", faq: "SSS", howItWorks: "Nasıl çalışır", forBusiness: "İşletmeler için" },
  footer: {
    terms: "Kullanım koşulları",
    faq: "Sıkça sorulan sorular",
    moderation: "Moderasyon politikası",
    feedback: "Geri bildirim",
    tagline: "Mahallenizdeki usta, sadece Ukraynalı. İtalya ve Portekiz genelinde yetenekli ustaları müşterilerle buluşturuyoruz.",
    copyright: "© 2025 Majstr. Tüm hakları saklıdır.",
    madeWith: "Ukrayna topluluğu için ❤️ 🇺🇦 ile yapıldı",
  },
  main: {
    liveIn: "Şurada yaşıyorum:",
    lookingFor: "ve şunu arıyorum:",
    allMasters: "Tüm ustalar",
    allCountry: "{country} geneli",
    inCity: "şurada:",
    searching: "Aranıyor...",
    cannotSearch: "Arama yapılamadı",
    appTitle: "Majstr : Ukraynalı ustaları bul",
    cityKicker: "Şehir",
    tradeKicker: "Meslek",
  },
  hero: {
    eyebrow: "İtalya ve Portekiz'de 2.400+ doğrulanmış Ukraynalı usta",
    title: "Güvenilir ustalar bulun,",
    titleAccent: "sizin dilinizi konuşan.",
    subtitle: "Tesisatçılar, elektrikçiler, güzellik uzmanları, BT uzmanları ve daha fazlasını bulun — güvenilir, doğrulanmış, çalışmaya hazır.",
    liveLabel: "Canlı · Az önce güncellendi",
    searchBtn: "ARA →",
    vettedStrip: "Doğrulanmış · Akıcı · Hazır",
    testimonialLabel: "Müşteriler ne diyor",
    testimonialQuote: "Burada bulduğum Maxim ile çalışmamla ilgili bir değerlendirme paylaşmak istiyorum. Sanremo'dan Lecco'ya taşınmamızı organize etti. Buzdolabı, çamaşır makinesi ve diğer büyük eşyalar dahil tüm mobilyaları özenle paketleyip taşıdılar. Her şeyi yerinde indirdiler ve yüksek bir kata çıkardılar. Her şey verimli ve zamanında yapıldı. Maxim ile çalışmayı kesinlikle tavsiye ederim.",
    testimonialAttr: "KONSTANTIN K. · SANREMO · ★ 5/5",
    telegramNote: "Telegram üzerinden · Aracısız · Ücretsiz",
  },
  how: {
    label: "Nasıl çalışır",
    step1Title: "Bul",
    step1Desc: "Şehir ve beceriye göre ara",
    step2Title: "İletişim",
    step2Desc: "Telegram'dan yaz",
    step3Title: "Anlaş",
    step3Desc: "Doğrudan iş sözleşin",
  },
  browse: { label: "Kategoriye göre göz at", allCategories: "Tüm kategoriler", browseLabel: "Göz at →" },
  results: {
    found: "Bulunan ustalar:",
    empty: "Aramanız için usta bulunamadı.",
    tryChanging: "Şehri veya kategoriyi değiştirmeyi deneyin.",
    sortedByRating: "SONUÇLAR · PUANA GÖRE",
  },
  modal: {
    noAbout: "Maalesef bu ustanın ayrıntılı bir açıklaması yok 🤷‍♂️",
    languages: "Diller",
    about: "Hakkında",
    skills: "Beceriler",
    contact: "İletişim",
  },
  masterCard: { details: "OPEN", noReviews: "Henüz değerlendirme yok", verified: "Profil doğrulandı", memberSince: "Üyelik tarihi" },
  badge: { newThisWeek: "Bu hafta yeni", recentlyAdded: "Yakın zamanda eklendi" },
  cta: { microcopy: "3 dk · Ücretsiz · Telegram üzerinden" },
  login: {
    loading: "Giriş yapılıyor...",
    error: "Giriş bağlantısı geçersiz veya süresi dolmuş. Lütfen botu tekrar aç.",
    home: "Ana sayfa",
  },
  availability: {
    available: "Bu hafta müsait",
    next_week: "Gelecek hafta müsait",
    busy: "Meşgul",
  },
  countryNames: { IT: "İtalya", PT: "Portekiz" },
};

translations.es = {
  nav: { search: "Buscar", addMaster: "Añadir profesional", faq: "Preguntas frecuentes", howItWorks: "Cómo funciona", forBusiness: "Para empresas" },
  footer: {
    terms: "Condiciones de uso",
    faq: "Preguntas frecuentes",
    moderation: "Política de moderación",
    feedback: "Comentarios",
    tagline: "Tu profesional de barrio, simplemente ucraniano. Conectamos a trabajadores cualificados con clientes en toda Italia y Portugal.",
    copyright: "© 2025 Majstr. Todos los derechos reservados.",
    madeWith: "Hecho con ❤️ 🇺🇦 para la comunidad ucraniana",
  },
  main: {
    liveIn: "Vivo en",
    lookingFor: "y busco",
    allMasters: "Todos los profesionales",
    allCountry: "Todo {country}",
    inCity: "en",
    searching: "Buscando...",
    cannotSearch: "No se puede realizar la búsqueda",
    appTitle: "Majstr : Encuentra profesionales ucranianos",
    cityKicker: "Ciudad",
    tradeKicker: "Oficio",
  },
  hero: {
    eyebrow: "Más de 2.400 profesionales ucranianos verificados en Italia y Portugal",
    title: "Encuentra profesionales de confianza",
    titleAccent: "que hablan tu idioma.",
    subtitle: "Encuentra fontaneros, electricistas, esteticistas, expertos en TI y más — de confianza, verificados, listos para trabajar.",
    liveLabel: "En directo · Actualizado ahora mismo",
    searchBtn: "BUSCAR →",
    vettedStrip: "Verificados · Con fluidez · Listos",
    testimonialLabel: "Lo que dicen los clientes",
    testimonialQuote: "Quiero compartir una opinión sobre el trabajo con Maxim, a quien encontré aquí. Organizó nuestra mudanza de Sanremo a Lecco. Embalaron y transportaron con cuidado todos los muebles, incluidos el frigorífico, la lavadora y otros objetos grandes. Lo descargaron todo en el sitio y lo subieron a un piso alto. Todo se hizo de forma eficiente y a tiempo. Recomiendo encarecidamente trabajar con Maxim.",
    testimonialAttr: "KONSTANTIN K. · SANREMO · ★ 5/5",
    telegramNote: "Vía Telegram · Sin intermediarios · Gratis",
  },
  how: {
    label: "Cómo funciona",
    step1Title: "Encuentra",
    step1Desc: "Busca por ciudad y habilidad",
    step2Title: "Contacta",
    step2Desc: "Escribe por Telegram",
    step3Title: "Contrata",
    step3Desc: "Acuerda directamente",
  },
  browse: { label: "Explorar por categoría", allCategories: "Todas las categorías", browseLabel: "Explorar →" },
  results: {
    found: "Profesionales encontrados:",
    empty: "No se encontraron profesionales para tu búsqueda.",
    tryChanging: "Prueba a cambiar la ciudad o la categoría.",
    sortedByRating: "RESULTADOS · POR VALORACIÓN",
  },
  modal: {
    noAbout: "Lamentablemente, este profesional no tiene una descripción detallada 🤷‍♂️",
    languages: "Idiomas",
    about: "Acerca de",
    skills: "Habilidades",
    contact: "Contacto",
  },
  masterCard: { details: "OPEN", noReviews: "Aún sin valoraciones", verified: "Perfil verificado", memberSince: "Miembro desde" },
  badge: { newThisWeek: "Nuevo esta semana", recentlyAdded: "Añadido recientemente" },
  cta: { microcopy: "3 min · Gratis · Vía Telegram" },
  login: {
    loading: "Iniciando sesión...",
    error: "El enlace de acceso no es válido o ha caducado. Abre el bot de nuevo.",
    home: "Ir al inicio",
  },
  availability: {
    available: "Disponible esta semana",
    next_week: "Disponible la próxima semana",
    busy: "Ocupado",
  },
  countryNames: { IT: "Italia", PT: "Portugal" },
};

export const COUNTRY_TO_LANG: Record<string, string> = {
  IT: "it",
  PT: "pt",
  ES: "es",
  DE: "de",
  FR: "fr",
  PL: "pl",
};

// Canonical app languages. RU intentionally has NO flag (text label).
export const LANG_FLAGS: Record<string, string> = {
  en: "🇬🇧",
  uk: "🇺🇦",
  ru: "",
  it: "🇮🇹",
  pt: "🇵🇹",
  de: "🇩🇪",
  fr: "🇫🇷",
  tr: "🇹🇷",
  es: "🇪🇸",
};

export const LANG_LABELS: Record<string, string> = {
  en: "EN",
  uk: "UA",
  ru: "RU",
  it: "IT",
  pt: "PT",
  de: "DE",
  fr: "FR",
  tr: "TR",
  es: "ES",
};
