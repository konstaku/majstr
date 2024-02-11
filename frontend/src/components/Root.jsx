import { useContext, useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { MasterContext } from '../context';
import { ACTIONS } from '../reducer';
import Select from 'react-select';

export default function Root() {
  const { state, dispatch } = useContext(MasterContext);
  const { user, countryID, countries } = state;
  const { isLoggedIn } = user;
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);

  // Add to .env
  const defaultCountry = 'IT';

  // Populate masters, professions, categories and country on app load
  useEffect(() => {
    const controller = new AbortController();

    (async function () {
      try {
        const promises = [
          fetch('https://api.majstr.com/?q=masters', {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch('https://api.majstr.com/?q=professions', {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch('https://api.majstr.com/?q=prof-categories', {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch(`https://api.majstr.com/?q=locations&country=${countryID}`, {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch('https://api.majstr.com/?q=countries', {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch('https://ipinfo.io/json', {
            signal: controller.signal,
          })
            .then((response) => response.json())
            .then((result) =>
              countries.some((country) => country.id === result.country)
                ? result.country
                : defaultCountry
            ),
        ];

        await Promise.all(promises).then((data) =>
          dispatch({
            type: ACTIONS.POPULATE,
            payload: {
              masters: data[0],
              professions: data[1],
              profCategories: data[2],
              locations: data[3],
              countries: data[4],
              countryID: data[5],
            },
          })
        );
      } catch (err) {
        if (err.name === 'AbortError') {
          return;
        }
        dispatch({
          type: ACTIONS.ERROR,
          payload: { error: `Can't load data` },
        });
      }
    })();

    return () => controller.abort();
  }, [countryID]);

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
      {isLoggedIn ? (
        <li>
          <Link to="/add" style={linkStyle}>
            Додати майстра
          </Link>
        </li>
      ) : (
        <li>
          <a href="https://t.me/chupakabra_dev_bot">Додати майстра</a>
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
          countries={countries}
          countryID={countryID}
          dispatch={dispatch}
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

function CountrySelect({
  showBurgerMenu,
  setShowBurgerMenu,
  countries,
  countryID,
  dispatch,
}) {
  // const countrySelectOptions = [
  //   {
  //     label: countries.find((country) => country.id === countryID)?.name.ua,
  //     value: countryID,
  //   },
  //   ...countries.map((country) => ({
  //     label: `${country.flag}  ${country.name.ua}`,
  //     value: country.id,
  //   })),
  // ];

  return (
    <>
      <div
        className="select-country"
        // onClick={() =>
        //   dispatch({ type: ACTIONS.SET_COUNTRY, payload: { countryID: 'PT' } })
        // }
      >
        <span>🇮🇹</span>
        <span>Італія</span>
      </div>
      {/* <Select
        // className="select-country"
        // defaultValue={countrySelectOptions[0]}
        // unstyled
        // options={countrySelectOptions}
        // components={{ DropdownIndicator: () => null }}
        // styles={headlineSelectStyles}
        // onChange={(e) => {
        //   dispatch({
        //     type: ACTIONS.SET_CITY,
        //     payload: { selectedCity: e.value },
        //   });
        // }}
      /> */}
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
