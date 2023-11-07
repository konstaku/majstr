import { useContext } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { MasterContext } from '../context';
import { ACTIONS } from '../reducer';

export default function Root() {
  const { state, dispatch } = useContext(MasterContext);
  const { user } = state;
  const { isLoggedIn } = user;
  console.log('state:', state);

  return (
    <>
      <header className="header">
        <div className="logo">
          <img
            src="/img/logo/logo-dark.svg"
            alt="logo"
            width="150px"
            onClick={() => dispatch({ type: ACTIONS.RESET_SEARCH })}
          />
        </div>
        <div className="menu">
          <ul>
            <li>
              <Link to="/">Пошук</Link>
            </li>
            <li>
              <Link to="/add">Додати майстра</Link>
            </li>
            {isLoggedIn ? (
              <li>
                <Link to="/profile">Профіль</Link>
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
