"use client";

import {
  createContext,
  Dispatch,
  ReactNode,
  useEffect,
  useReducer,
} from "react";
import { reducer } from "./reducer";
import { ACTIONS } from "./data/actions";
import type { State } from "./schema/state/state.schema";
import type { Action } from "./reducer";

// Languages the interactive app surfaces (onboarding/claim/etc.) may switch to.
// The SEO catalogue is URL-driven (uk/ru/en) and ignores this.
const KNOWN_LANGS = ["en", "uk", "ru", "it", "pt", "de", "fr", "tr", "es"];

// Client-only: the saved language, else a supported browser language, else null.
// Returns null during SSR so the first render matches the server (no hydration
// mismatch) — the provider adopts it after mount instead.
function clientLang(): string | null {
  if (typeof window === "undefined") return null;
  const saved = localStorage.getItem("lang");
  if (saved) return saved;
  const browser = navigator.language?.split("-")[0]?.toLowerCase();
  return browser && KNOWN_LANGS.includes(browser) ? browser : null;
}

const BASE_STATE: State = {
  masters: [],
  professions: [],
  locations: [],
  profCategories: [],
  countries: [],
  communities: [],
  searchParams: {
    selectedCity: "",
    selectedProfession: "",
    selectedProfessionCategory: "",
  },
  user: {
    firstName: "",
    lastName: "",
    username: "",
    isLoggedIn: false,
    photo: null,
  },
  countryID: "IT",
  countrySet: true,
  loading: true,
  error: "",
  lang: "uk",
};

type ContextType = {
  state: State;
  dispatch: Dispatch<Action>;
};

export const MasterContext = createContext<ContextType>({
  state: BASE_STATE,
  dispatch: () => undefined,
});

type MasterContextProviderProps = {
  children: ReactNode;
  // Server-provided seed: reference data + masters + lang, so the very first
  // (server) render already contains content for crawlers.
  initial?: Partial<State>;
};

export function MasterContextProvider({
  children,
  initial,
}: MasterContextProviderProps) {
  // `lang` is seeded from the URL locale (the single source of truth) and is
  // never mutated on the client — switching language is a navigation, so the
  // remount re-seeds it from the new URL. The `?? "uk"` is only a defensive
  // default; every server page provides `initial.lang`.
  const seeded: State = {
    ...BASE_STATE,
    ...initial,
    lang: initial?.lang ?? "uk",
  };
  const [state, dispatch] = useReducer(reducer, seeded);

  // App surfaces render WITHOUT a server seed (outside the SEO catalogue, which
  // is URL-driven and never mutates lang). Only for them: after mount, adopt the
  // saved/browser language (SSR-safe — see clientLang).
  useEffect(() => {
    if (initial) return;
    const lang = clientLang();
    if (lang && lang !== seeded.lang) {
      dispatch({ type: ACTIONS.SET_LANGUAGE, payload: { lang } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MasterContext.Provider value={{ state, dispatch }}>
      {children}
    </MasterContext.Provider>
  );
}
