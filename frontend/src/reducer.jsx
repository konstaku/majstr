export const ACTIONS = {
  POPULATE: 'POPULATE',
  ADD: 'ADD',
  EDIT: 'EDIT',
  DELETE: 'DELETE',
  FILTER: 'FILTER',
};

export function reducer(state, { type, payload }) {
  switch (type) {
    case ACTIONS.POPULATE: {
      return {
        ...payload.masters,
      };
    }
  }
}
