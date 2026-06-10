import { describe, it, expect } from "vitest";
import { reducer } from "./reducer";
import type { State } from "./schema/state/state.schema";

const baseState = {
  masters: [],
  locations: [],
  professions: [],
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
    photo: null,
    isLoggedIn: false,
  },
  countryID: "IT",
  countrySet: false,
  loading: true,
  error: "",
  lang: "uk",
} as unknown as State;

describe("reducer", () => {
  it("POPULATE fills all five collections and clears loading", () => {
    const payload = {
      masters: [{ _id: "m1" }],
      professions: [{ id: "p1" }],
      profCategories: [{ id: "c1" }],
      locations: [{ id: "l1" }],
      countries: [{ id: "IT" }],
    };
    const next = reducer(baseState, { type: "POPULATE", payload });
    expect(next.masters).toEqual(payload.masters);
    expect(next.professions).toEqual(payload.professions);
    expect(next.profCategories).toEqual(payload.profCategories);
    expect(next.locations).toEqual(payload.locations);
    expect(next.countries).toEqual(payload.countries);
    expect(next.loading).toBe(false);
  });

  it("SET_COUNTRY sets the id and marks the country as chosen", () => {
    const next = reducer(baseState, { type: "SET_COUNTRY", payload: { countryID: "DE" } });
    expect(next.countryID).toBe("DE");
    expect(next.countrySet).toBe(true);
  });

  it("SET_CITY / SET_PROFESSION update searchParams without clobbering each other", () => {
    const withCity = reducer(baseState, {
      type: "SET_CITY",
      payload: { selectedCity: "milan" },
    });
    const withBoth = reducer(withCity, {
      type: "SET_PROFESSION",
      payload: { selectedProfessionCategory: "construction" },
    });
    expect(withBoth.searchParams.selectedCity).toBe("milan");
    expect(withBoth.searchParams.selectedProfessionCategory).toBe("construction");
  });

  it("RESET_SEARCH clears city and profession category", () => {
    const dirty = {
      ...baseState,
      searchParams: {
        selectedCity: "milan",
        selectedProfession: "x",
        selectedProfessionCategory: "construction",
      },
    } as State;
    const next = reducer(dirty, { type: "RESET_SEARCH" });
    expect(next.searchParams.selectedCity).toBe("");
    expect(next.searchParams.selectedProfessionCategory).toBe("");
  });

  it("LOGIN spreads the user payload and flags isLoggedIn", () => {
    const next = reducer(baseState, {
      type: "LOGIN",
      payload: { user: { firstName: "Олена", username: "olena", photo: null, lastName: "" } },
    });
    expect(next.user).toMatchObject({ firstName: "Олена", isLoggedIn: true });
  });

  it("LOGOUT keeps user fields but clears isLoggedIn", () => {
    const loggedIn = reducer(baseState, {
      type: "LOGIN",
      payload: { user: { firstName: "Олена", username: "olena", photo: null, lastName: "" } },
    });
    const next = reducer(loggedIn, { type: "LOGOUT" });
    expect(next.user.isLoggedIn).toBe(false);
    expect(next.user.firstName).toBe("Олена");
  });

  it("ERROR stores the error message", () => {
    const next = reducer(baseState, { type: "ERROR", payload: { error: "boom" } });
    expect(next.error).toBe("boom");
  });

  it("SET_LANGUAGE switches the UI language", () => {
    const next = reducer(baseState, { type: "SET_LANGUAGE", payload: { lang: "it" } });
    expect(next.lang).toBe("it");
  });

  it("returns the same state reference for unknown actions", () => {
    const next = reducer(baseState, { type: "FILTER" });
    expect(next).toBe(baseState);
  });
});
