import { createContext, useReducer } from 'react';
import { reducer } from './reducer';

export const MasterContext = createContext();

const INITIAL_STATE = {
  masters: [],
  professions: [],
  searchParams: {
    selectedCity: '',
    selectedProfession: '',
  },
  user: {},
};

export function MasterContextProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  return (
    <MasterContext.Provider value={{ state, dispatch }}>
      {children}
    </MasterContext.Provider>
  );
}
