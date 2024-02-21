import { useEffect, useState } from 'react';

export default function useAuthenticateUser() {
  const [user, setUser] = useState({});
  const [token] = useState(() => JSON.parse(localStorage.getItem('token')));

  useEffect(() => {
    const controller = new AbortController();

    (async function () {
      if (!token) return {};

      await fetch('https://api.majstr.com/auth', {
        headers: { Authorization: token },
        signal: controller.signal,
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
        .catch((err) => {
          if (err.name === 'AbortError') {
            return;
          }
          console.error(err);
        });
    })();

    return () => controller.abort();
  }, []);

  return user;
}
