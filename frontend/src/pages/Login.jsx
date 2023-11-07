import { useEffect } from 'react';
import { Link, useLocation, redirect } from 'react-router-dom';

export default function Login() {
  const location = useLocation();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const token = searchParams.get('token');

    if (token) {
      // console.log(`User ${token} successfully logged in!, payload: ${token}`);
      localStorage.setItem('token', token);
    }
  }, [location.search]);

  return (
    <div>
      {
        <Link to="/">
          <h2>Logged in, go to main</h2>
        </Link>
      }
    </div>
  );
}
