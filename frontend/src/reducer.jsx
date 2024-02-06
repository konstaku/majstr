export const ACTIONS = {
  // POPULATE: 'POPULATE',
  SET_CITY: 'SET_CITY',
  SET_PROFESSION: 'SET_PROFESSION',
  RESET_SEARCH: 'RESET_SEARCH',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  ADD: 'ADD',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
  FILTER: 'FILTER',
  LOGIN: 'LOGIN',
};

export function reducer(state, { type, payload }) {
  switch (type) {
    // case ACTIONS.POPULATE: {
    //   return {
    //     ...state,
    //     masters: payload.masters,
    //   };
    // }

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
          selectedProfession: payload.selectedProfession,
        },
      };
    }

    case ACTIONS.RESET_SEARCH: {
      return {
        ...state,
        searchParams: {
          ...state.searchParams,
          selectedCity: '',
          selectedProfession: '',
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
  }
}
