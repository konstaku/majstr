import { useContext } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { MasterContext } from '../context';

export default function Root({ resetSearch }) {
  const { state } = useContext(MasterContext);
  console.log('state:', state);

  return (
    <>
      <header className="header">
        <div className="logo">
          <img
            src="/img/logo/logo-dark.svg"
            alt="logo"
            width="150px"
            // onClick={resetSearch}
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
            <li className="inactive">Особистий кабінет</li>
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
