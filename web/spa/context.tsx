"use client";

import { createContext, Dispatch, ReactNode, useReducer } from "react";
import { reducer } from "./reducer";
import type { State } from "./schema/state/state.schema";
import type { Action } from "./reducer";

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

  return (
    <MasterContext.Provider value={{ state, dispatch }}>
      {children}
    </MasterContext.Provider>
  );
}
