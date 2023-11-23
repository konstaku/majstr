import { useEffect, useState } from 'react';

export default function useAuthenticateUser() {
  const [user, setUser] = useState({});

  useEffect(() => {
    async function authenticateUser() {
      const token = JSON.parse(localStorage.getItem('token'));

      if (!token) return {};

      await fetch('https://api.majstr.com/auth', {
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
