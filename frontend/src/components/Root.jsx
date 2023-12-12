import { useContext, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { MasterContext } from '../context';
import { ACTIONS } from '../reducer';

export default function Root() {
  const { state, dispatch } = useContext(MasterContext);
  const { user } = state;
  const { isLoggedIn } = user;
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);

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

  const menuItems = (
    <>
      <li>
        <Link to="/" style={linkStyle}>
          Пошук
        </Link>
      </li>
      {isLoggedIn && (
        <li>
          <Link to="/add" style={linkStyle}>
            Додати майстра
          </Link>
        </li>
      )}
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
    </>
  );

  return (
    <>
      <header className="header">
        <Logo dispatch={dispatch} />
        <Menu menuItems={menuItems} />
        <CountrySelect
          showBurgerMenu={showBurgerMenu}
          setShowBurgerMenu={setShowBurgerMenu}
        />
      </header>
      <BurgerMenu
        menuItems={menuItems}
        showBurgerMenu={showBurgerMenu}
        setShowBurgerMenu={setShowBurgerMenu}
      />
      <Outlet />
      <div className="footer">
        <FooterContent />
      </div>
    </>
  );
}

function Logo({ dispatch }) {
  return (
    <div className="logo">
      <Link to="/">
        <img
          src="/img/logo/logo-dark.svg"
          alt="logo"
          width="150px"
          onClick={() => dispatch({ type: ACTIONS.RESET_SEARCH })}
        />
      </Link>
    </div>
  );
}

function Menu({ menuItems }) {
  return (
    <>
      <div className="menu">
        <ul>{menuItems}</ul>
      </div>
    </>
  );
}

function BurgerMenu({ menuItems, showBurgerMenu, setShowBurgerMenu }) {
  return (
    <div
      className="menu-burger"
      style={{ display: showBurgerMenu ? 'block' : 'none' }}
    >
      <ul onClick={() => setShowBurgerMenu(false)}>{menuItems}</ul>
    </div>
  );
}

function CountrySelect({ showBurgerMenu, setShowBurgerMenu }) {
  return (
    <>
      <div className="select-country">
        <span>🇮🇹</span>
        <span>Італія</span>
      </div>
      <div
        className="burger-open"
        onClick={() => setShowBurgerMenu(!showBurgerMenu)}
      >
        <img src="/img/icons/burger.svg" alt="logo" width="24px" />
      </div>
    </>
  );
}

function FooterContent() {
  return (
    <>
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
    </>
  );
}
