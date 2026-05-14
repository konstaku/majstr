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
      testimonialQuote: "Марко полагодив наш котел того ж дня. Говорив чудовою українською. Врятував наші вихідні.",
      testimonialAttr: "MARCO B. · ROMA · ★ 5/5",
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
      error: "Помилка входу: токен відсутній",
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
      testimonialQuote: "Marko fixed our boiler same day. Spoke fluent Ukrainian. Saved our weekend.",
      testimonialAttr: "MARCO B. · ROMA · ★ 5/5",
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
      error: "Login error: no token",
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
      testimonialQuote: "Marko ha riparato la caldaia lo stesso giorno. Parlava ucraino perfettamente. Ha salvato il nostro weekend.",
      testimonialAttr: "MARCO B. · ROMA · ★ 5/5",
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
      error: "Errore di accesso: nessun token",
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
      testimonialQuote: "O Marko reparou a caldeira no mesmo dia. Falava ucraniano fluentemente. Salvou o nosso fim de semana.",
      testimonialAttr: "MARCO B. · ROMA · ★ 5/5",
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
      error: "Erro de login: sem token",
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

export const COUNTRY_TO_LANG: Record<string, string> = {
  IT: "it",
  PT: "pt",
  ES: "es",
  DE: "de",
  FR: "fr",
  PL: "pl",
};

export const LANG_FLAGS: Record<string, string> = {
  uk: "🇺🇦",
  en: "🇬🇧",
  it: "🇮🇹",
  pt: "🇵🇹",
  es: "🇪🇸",
  de: "🇩🇪",
  fr: "🇫🇷",
  pl: "🇵🇱",
};

export const LANG_LABELS: Record<string, string> = {
  uk: "UA",
  en: "EN",
  it: "IT",
  pt: "PT",
  es: "ES",
  de: "DE",
  fr: "FR",
  pl: "PL",
};
