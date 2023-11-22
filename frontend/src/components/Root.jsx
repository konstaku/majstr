import { useContext, useEffect } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { MasterContext } from '../context';
import { ACTIONS } from '../reducer';

export default function Root() {
  const { state, dispatch } = useContext(MasterContext);
  const { user } = state;
  const { isLoggedIn } = user;
  console.log('state:', state);

  // Check if a user is authenticated on load
  useEffect(() => {
    // It is important to JSON parse token in order to get rid of double quotes
    const token = JSON.parse(localStorage.getItem('token'));

    if (!token) {
      return dispatch({ type: ACTIONS.LOGOUT });
    }

    // On page load, read the user info from token and add to state
    const user = JSON.parse(atob(token.split('.')[1]));
    dispatch({ type: ACTIONS.LOGIN, payload: { user } });
  }, []);

  const linkStyle = {
    color: '#fff',
    textDecoration: 'none',
  };

  return (
    <>
      <header className="header">
        <Link to="/">
          <div className="logo">
            <img
              src="/img/logo/logo-dark.svg"
              alt="logo"
              width="150px"
              onClick={() => dispatch({ type: ACTIONS.RESET_SEARCH })}
            />
          </div>
        </Link>
        <div className="menu">
          <ul>
            <li>
              <Link to="/" style={linkStyle}>
                Пошук
              </Link>
            </li>
            <li>
              <Link to="/add" style={linkStyle}>
                Додати майстра
              </Link>
            </li>
            {isLoggedIn ? (
              <li>
                <Link to="/profile" style={linkStyle}>
                  Профіль
                </Link>
              </li>
            ) : (
              <li>
                <a href="https://t.me/chupakabra_dev_bot">Логін</a>
              </li>
            )}
            <li className="inactive">FAQ</li>
          </ul>
        </div>
        <div className="select-country">
          <span>🇮🇹</span>
          <span>Італія</span>
        </div>
      </header>

      <Outlet />

      <div className="footer">
        <div className="terms">
          <ul>
            <li>Умови використання</li>
            <li>Питання та відповіді</li>
            <li>Політика модерації</li>
            <li>Зворотній звʼязок</li>
          </ul>
        </div>
        <div className="love">
          <span>❤️</span>
          <span>🇺🇦</span>
        </div>
      </div>
    </>
  );
}
