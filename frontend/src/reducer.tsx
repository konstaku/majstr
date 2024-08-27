import { State } from "./schema/state/state.type";

export type Action = {
    type: keyof typeof ACTIONS;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    payload?: any;
};

export const ACTIONS = {
    POPULATE: "POPULATE",
    SET_COUNTRY: "SET_COUNTRY",
    SET_CITY: "SET_CITY",
    SET_PROFESSION: "SET_PROFESSION",
    RESET_SEARCH: "RESET_SEARCH",
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
    ADD: "ADD",
    EDIT: "EDIT",
    DELETE: "DELETE",
    FILTER: "FILTER",
    ERROR: "ERROR",
} as const;

export function reducer(state: State, { type, payload }: Action): State {
    switch (type) {
        case ACTIONS.POPULATE: {
            return {
                ...state,
                masters: payload.masters,
                professions: payload.professions,
                profCategories: payload.profCategories,
                locations: payload.locations,
                countries: payload.countries,
            };
        }

        case ACTIONS.SET_COUNTRY: {
            return {
                ...state,
                countryID: payload.countryID,
                countrySet: true,
            };
        }

        case ACTIONS.SET_CITY: {
            return {
                ...state,
                searchParams: {
                    ...state.searchParams,
                    selectedCity: payload.selectedCity,
                },
            };
        }

        case ACTIONS.SET_PROFESSION: {
            return {
                ...state,
                searchParams: {
                    ...state.searchParams,
                    selectedProfessionCategory:
                        payload.selectedProfessionCategory,
                },
            };
        }

        case ACTIONS.RESET_SEARCH: {
            return {
                ...state,
                searchParams: {
                    ...state.searchParams,
                    selectedCity: "",
                    selectedProfessionCategory: "",
                },
            };
        }

        case ACTIONS.LOGIN: {
            return {
                ...state,
                user: {
                    ...payload.user,
                    isLoggedIn: true,
                },
            };
        }

        case ACTIONS.LOGOUT: {
            return {
                ...state,
                user: {
                    ...state.user,
                    isLoggedIn: false,
                },
            };
        }

        case ACTIONS.ERROR: {
            return {
                ...state,
                error: payload.error,
            };
        }

        default: {
            return state;
        }
    }
}
