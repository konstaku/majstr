"use client";

import { createContext, Dispatch, ReactNode, useReducer } from "react";
import { reducer } from "./reducer";
import type { State } from "./schema/state/state.schema";
import type { Action } from "./reducer";

// SSR-safe: never touch localStorage/navigator at module load. The language is
// normally seeded from the URL (`initial.lang`); this is only a client fallback.
function getInitialLang(): string {
  if (typeof window === "undefined") return "uk";
  try {
    const saved = localStorage.getItem("lang");
    if (saved) return saved;
    const browser = navigator.language.split("-")[0].toLowerCase();
    const known = ["en", "uk", "ru", "it", "pt", "de", "fr", "tr", "es"];
    return known.includes(browser) ? browser : "uk";
  } catch {
    return "uk";
  }
}

const BASE_STATE: State = {
  masters: [],
  professions: [],
  locations: [],
  profCategories: [],
  countries: [],
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
  const seeded: State = {
    ...BASE_STATE,
    lang: initial?.lang ?? getInitialLang(),
    ...initial,
  };
  const [state, dispatch] = useReducer(reducer, seeded);

  return (
    <MasterContext.Provider value={{ state, dispatch }}>
      {children}
    </MasterContext.Provider>
  );
}
