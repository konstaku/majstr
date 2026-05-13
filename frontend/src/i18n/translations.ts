export type LangTranslations = {
  nav: { search: string; addMaster: string; faq: string };
  footer: { terms: string; faq: string; moderation: string; feedback: string };
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
  results: { found: string; empty: string; tryChanging: string };
  modal: { noAbout: string };
  masterCard: { details: string };
  login: { loading: string; error: string; home: string };
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
    results: {
      found: "Знайдено майстрів:",
      empty: "Майстрів за вашим запитом не знайдено.",
      tryChanging: "Спробуйте змінити місто або категорію.",
    },
    modal: { noAbout: "Нажаль, майстер немає детального опису 🤷‍♂️" },
    masterCard: { details: "Детальніше" },
    login: {
      loading: "Вхід в систему...",
      error: "Помилка входу: токен відсутній",
      home: "На головну",
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
    results: {
      found: "Masters found:",
      empty: "No masters found for your request.",
      tryChanging: "Try changing the city or category.",
    },
    modal: { noAbout: "Unfortunately, the master has no detailed description 🤷‍♂️" },
    masterCard: { details: "Details" },
    login: {
      loading: "Logging in...",
      error: "Login error: no token",
      home: "Go home",
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
    results: {
      found: "Artigiani trovati:",
      empty: "Nessun artigiano trovato per la tua ricerca.",
      tryChanging: "Prova a cambiare città o categoria.",
    },
    modal: { noAbout: "Purtroppo, l'artigiano non ha una descrizione dettagliata 🤷‍♂️" },
    masterCard: { details: "Dettagli" },
    login: {
      loading: "Accesso in corso...",
      error: "Errore di accesso: nessun token",
      home: "Vai alla home",
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
    results: {
      found: "Artesãos encontrados:",
      empty: "Nenhum artesão encontrado para a sua pesquisa.",
      tryChanging: "Tente mudar a cidade ou categoria.",
    },
    modal: { noAbout: "Infelizmente, o artesão não tem uma descrição detalhada 🤷‍♂️" },
    masterCard: { details: "Detalhes" },
    login: {
      loading: "A iniciar sessão...",
      error: "Erro de login: sem token",
      home: "Ir para o início",
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
