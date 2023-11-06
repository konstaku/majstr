import { MasterContext } from '../context';
import { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export default function Login() {
  const { state, dispatch } = useContext(MasterContext);
  const location = useLocation();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get('token');

    if (token) {
      console.log(`User ${token} successfully logged in!, payload: ${token}`);
      dispatch(state, { action: 'LOGIN', payload: { token } });
      localStorage.setItem('token', token);
      setLoggedIn(true);
    }
  }, [location.search]);

  return <div>{loggedIn ? <h2>Logged in!</h2> : <h2>Error</h2>}</div>;
}
