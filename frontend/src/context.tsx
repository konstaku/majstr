import { createContext, Dispatch, ReactNode, useReducer } from "react";
import { reducer } from "./reducer";
import type { State } from "./schema/state/state.schema";

import type { Action } from "./reducer";

function getInitialLang(): string {
  const saved = localStorage.getItem("lang");
  if (saved) return saved;
  const browser = navigator.language.split("-")[0].toLowerCase();
  const known = ["uk", "en", "it", "pt", "es", "de", "fr", "pl"];
  return known.includes(browser) ? browser : "uk";
}

const INITIAL_STATE: State = {
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
  lang: getInitialLang(),
};

type ContextType = {
  state: State;
  dispatch: Dispatch<Action>;
};

export const MasterContext = createContext<ContextType>({
  state: INITIAL_STATE,
  dispatch: () => undefined,
});

type MasterContextProviderProps = {
  children: ReactNode;
};

export function MasterContextProvider({
  children,
}: MasterContextProviderProps) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  return (
    <MasterContext.Provider value={{ state, dispatch }}>
      {children}
    </MasterContext.Provider>
  );
}
