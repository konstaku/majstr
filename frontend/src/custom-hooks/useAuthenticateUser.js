import { useContext, useEffect, useState } from 'react';
import { ACTIONS } from '../reducer';
import { MasterContext } from '../context';

export default function useAuthenticateUser() {
  // const { state, dispatch } = useContext(MasterContext);
  const [user, setUser] = useState({});

  useEffect(() => {
    async function authenticateUser() {
      const token = JSON.parse(localStorage.getItem('token'));

      if (!token) return {};

      await fetch('https://api.konstaku.com:5000/auth', {
        headers: { Authorization: token },
      })
        .then((response) => {
          if (response.ok) {
            return response.json();
          } else {
            return Promise.reject(response);
          }
        })
        .then((result) => {
          // dispatch({ type: ACTIONS.LOGIN, payload: { user: result } });
          setUser(result);
          console.log(`User ${result.firstName} logged in!`);
        })
        .catch(console.error);
    }

    authenticateUser();
  }, []);

  return user;
}
