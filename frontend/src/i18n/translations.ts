export type LangTranslations = {
  nav: { search: string; addMaster: string; faq: string };
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
  };
  hero: {
    eyebrow: string;
    title: string;
    titleAccent: string;
    subtitle: string;
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
  browse: { label: string; allCategories: string };
  results: { found: string; empty: string; tryChanging: string };
  modal: { noAbout: string; languages: string; about: string; skills: string; contact: string };
  masterCard: { details: string };
  login: { loading: string; error: string; home: string };
  availability: { available: string; next_week: string; busy: string };
  countryNames: Record<string, string>;
};

export const translations: Record<string, LangTranslations> = {
  uk: {
    nav: { search: "Пошук", addMaster: "Додати майстра", faq: "FAQ" },
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
    },
    hero: {
      eyebrow: "2 400+ перевірених українських майстрів в Італії та Португалії",
      title: "Ваш сусідський майстер,",
      titleAccent: "просто українець.",
      subtitle: "Знаходьте сантехніків, електриків, косметологів, IT-спеціалістів та інших — надійних, перевірених, готових до роботи.",
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
    browse: { label: "Переглянути за категорією", allCategories: "Всі категорії" },
    results: {
      found: "Знайдено майстрів:",
      empty: "Майстрів за вашим запитом не знайдено.",
      tryChanging: "Спробуйте змінити місто або категорію.",
    },
    modal: {
      noAbout: "Нажаль, майстер не має детального опису 🤷‍♂️",
      languages: "Мови",
      about: "Про майстра",
      skills: "Навички",
      contact: "Зв'язатися",
    },
    masterCard: { details: "Детальніше" },
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
    nav: { search: "Search", addMaster: "Add master", faq: "FAQ" },
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
    },
    hero: {
      eyebrow: "2,400+ verified Ukrainian masters in Italy & Portugal",
      title: "Your neighbourhood craftsman,",
      titleAccent: "just Ukrainian.",
      subtitle: "Find plumbers, electricians, beauticians, IT experts and more — trusted, vetted, ready to work.",
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
    browse: { label: "Browse by Category", allCategories: "All Categories" },
    results: {
      found: "Masters found:",
      empty: "No masters found for your request.",
      tryChanging: "Try changing the city or category.",
    },
    modal: {
      noAbout: "Unfortunately, the master has no detailed description 🤷‍♂️",
      languages: "Languages",
      about: "About",
      skills: "Skills",
      contact: "Contact",
    },
    masterCard: { details: "Details" },
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
    nav: { search: "Cerca", addMaster: "Aggiungi artigiano", faq: "FAQ" },
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
    },
    hero: {
      eyebrow: "2.400+ artigiani ucraini verificati in Italia e Portogallo",
      title: "Il tuo artigiano di quartiere,",
      titleAccent: "semplicemente ucraino.",
      subtitle: "Trova idraulici, elettricisti, estetiste, esperti IT e altro — affidabili, verificati, pronti a lavorare.",
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
    browse: { label: "Sfoglia per Categoria", allCategories: "Tutte le Categorie" },
    results: {
      found: "Artigiani trovati:",
      empty: "Nessun artigiano trovato per la tua ricerca.",
      tryChanging: "Prova a cambiare città o categoria.",
    },
    modal: {
      noAbout: "Purtroppo, l'artigiano non ha una descrizione dettagliata 🤷‍♂️",
      languages: "Lingue",
      about: "Chi sono",
      skills: "Competenze",
      contact: "Contatta",
    },
    masterCard: { details: "Dettagli" },
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
    nav: { search: "Pesquisar", addMaster: "Adicionar artesão", faq: "FAQ" },
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
    },
    hero: {
      eyebrow: "2.400+ artesãos ucranianos verificados em Itália e Portugal",
      title: "O seu artesão de bairro,",
      titleAccent: "simplesmente ucraniano.",
      subtitle: "Encontre canalizadores, eletricistas, esteticistas, especialistas em TI e mais — de confiança, verificados, prontos a trabalhar.",
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
    browse: { label: "Explorar por Categoria", allCategories: "Todas as Categorias" },
    results: {
      found: "Artesãos encontrados:",
      empty: "Nenhum artesão encontrado para a sua pesquisa.",
      tryChanging: "Tente mudar a cidade ou categoria.",
    },
    modal: {
      noAbout: "Infelizmente, o artesão não tem uma descrição detalhada 🤷‍♂️",
      languages: "Idiomas",
      about: "Sobre",
      skills: "Competências",
      contact: "Contactar",
    },
    masterCard: { details: "Detalhes" },
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
