import { useContext, useEffect, useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { MasterContext } from "../context";
import { ACTIONS } from "../reducer";
import Select from "react-select";
import { baseSelectStyles } from "../pages/Main";

export default function Root() {
  const { state, dispatch } = useContext(MasterContext);
  const { user, countryID, countries } = state;
  const { isLoggedIn } = user;
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);

  // Add to .env
  const availableCountries = ["IT", "PT"];
  const defaultCountry = "IT";

  // Define and set countryID
  useEffect(() => {
    const controller = new AbortController();

    (async function () {
      fetch("https://ipinfo.io/json", { signal: controller.signal })
        .then((response) => {
          if (response.ok) {
            return response.json();
          }
          return Promise.reject(response.statusText);
        })
        .then((result) => {
          const userCountry = availableCountries.includes(result.country)
            ? result.country
            : defaultCountry;
          dispatch({
            type: ACTIONS.SET_COUNTRY,
            payload: { countryID: userCountry },
          });
        })
        .catch((error) => {
          if (error.name === "AbortError") {
            return;
          }
          throw new Error(error);
        });
    })();
  }, []);

  // Populate masters, professions, categories and available countries when a base country is set
  useEffect(() => {
    if (!state.countrySet) {
      return;
    }

    const controller = new AbortController();

    (async function () {
      try {
        const promises = [
          fetch(`https://api.majstr.com/?q=masters&country=${countryID}`, {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch("https://api.majstr.com/?q=professions", {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch("https://api.majstr.com/?q=prof-categories", {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch(`https://api.majstr.com/?q=locations&country=${countryID}`, {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch("https://api.majstr.com/?q=countries", {
            signal: controller.signal,
          }).then((response) => response.json()),
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
            },
          })
        );
      } catch (err) {
        if (err.name === "AbortError") {
          return;
        }
        dispatch({
          type: ACTIONS.ERROR,
          payload: { error: `Can't load data` },
        });
      }
    })();

    return () => controller.abort();
  }, [state.countrySet, state.countryID]);

  // Check if a user is authenticated on load
  useEffect(() => {
    // It is important to JSON parse token in order to get rid of double quotes
    const token = JSON.parse(localStorage.getItem("token"));
    if (!token) {
      return dispatch({ type: ACTIONS.LOGOUT });
    }

    // On page load, read the user info from token and add to state
    const user = JSON.parse(atob(token.split(".")[1]));
    dispatch({ type: ACTIONS.LOGIN, payload: { user } });
  }, []);

  const linkStyle = {
    color: "#fff",
    textDecoration: "none",
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
      style={{ display: showBurgerMenu ? "block" : "none" }}
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
  const countrySelectOptions = [
    ...countries.map((country) => ({
      label: `${country.flag}  ${country.name.ua}`,
      value: country.id,
    })),
  ];

  return (
    <>
      <div className="select-country">
        {countrySelectOptions.length ? (
          <Select
            className="country-select"
            unstyled
            isSearchable={false}
            options={countrySelectOptions}
            defaultValue={countrySelectOptions[0]}
            components={{ DropdownIndicator: () => null }}
            styles={{
              ...baseSelectStyles,
              menu: (styles) => ({
                ...styles,
                minWidth: "max-content",
                backgroundColor: "#171923",
                borderRadius: "10px",
              }),
            }}
            onChange={(e) => {
              // Clear city and profession before country change
              dispatch({ type: ACTIONS.RESET_SEARCH });
              dispatch({
                type: ACTIONS.SET_COUNTRY,
                payload: { countryID: e.value },
              });
            }}
          />
        ) : (
          "Loading..."
        )}
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
