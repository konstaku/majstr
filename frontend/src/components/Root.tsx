import {
  Dispatch,
  ReactElement,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link, Outlet } from "react-router-dom";
import { MasterContext } from "../context";
import { Action } from "../reducer";
import { ACTIONS } from "../data/actions";
import Select from "react-select";
import { baseSelectStyles } from "../pages/Main";
import { useTranslation } from "../custom-hooks/useTranslation";
import { COUNTRY_TO_LANG, LANG_FLAGS } from "../i18n/translations";

import type { Country } from "../schema/state/state.schema";

export default function Root() {
  const { state, dispatch } = useContext(MasterContext);
  const { user, countryID, countries } = state;
  const { isLoggedIn } = user;
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const { t } = useTranslation();

  // Add to .env
  const availableCountries = useMemo(() => ["IT", "PT"], []);
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
  }, [dispatch, availableCountries]);

  // Populate masters, professions, categories and available countries when a base country is set
  useEffect(() => {
    if (!state.countrySet) {
      return;
    }

    const controller = new AbortController();

    (async function () {
      try {
        const promises = [
          fetch(`${import.meta.env.VITE_API_URL}/?q=masters&country=${countryID}`, {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch(`${import.meta.env.VITE_API_URL}/?q=professions`, {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch(`${import.meta.env.VITE_API_URL}/?q=prof-categories`, {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch(`${import.meta.env.VITE_API_URL}/?q=locations&country=${countryID}`, {
            signal: controller.signal,
          }).then((response) => response.json()),
          fetch(`${import.meta.env.VITE_API_URL}/?q=countries`, {
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
        if (err instanceof DOMException && err.name === "AbortError") {
          console.log("err instanceof DOMException");
          return;
        }
        dispatch({
          type: ACTIONS.ERROR,
          payload: { error: `Can't load data` },
        });
      }
    })();

    return () => controller.abort();
  }, [state.countrySet, countryID, dispatch]);

  // Check if a user is authenticated on load
  useEffect(() => {
    // It is important to JSON parse token in order to get rid of double quotes
    const token = JSON.parse(localStorage.getItem("token") as string);
    if (!token) {
      return dispatch({ type: ACTIONS.LOGOUT });
    }

    // On page load, read the user info from token and add to state
    const user = JSON.parse(atob(token.split(".")[1]));
    dispatch({ type: ACTIONS.LOGIN, payload: { user } });
  }, [dispatch]);

  const linkStyle = {
    color: "#fff",
    textDecoration: "none",
  };

  const menuItems = (
    <>
      <li>
        <Link to="/" style={linkStyle}>
          {t("nav.search")}
        </Link>
      </li>
      {isLoggedIn ? (
        <li>
          <Link to="/add" style={linkStyle}>
            {t("nav.addMaster")}
          </Link>
        </li>
      ) : (
        <li>
          <a href="https://t.me/majstr_bot">{t("nav.addMaster")}</a>
        </li>
      )}
      <li className="inactive">{t("nav.faq")}</li>
    </>
  );

  return (
    <>
      <header className="header">
        <Logo dispatch={dispatch} />
        <Menu menuItems={menuItems} />
        <LanguageSwitcher countryID={countryID} />
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

type LogoProps = {
  dispatch: Dispatch<Action>;
};

function Logo({ dispatch }: LogoProps) {
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

type MenuProps = {
  menuItems: ReactElement;
};

function Menu({ menuItems }: MenuProps) {
  return (
    <>
      <div className="menu">
        <ul>{menuItems}</ul>
      </div>
    </>
  );
}

type BurgerMenuProps = {
  menuItems: ReactElement;
  showBurgerMenu: boolean;
  setShowBurgerMenu: (show: boolean) => void;
};

function BurgerMenu({
  menuItems,
  showBurgerMenu,
  setShowBurgerMenu,
}: BurgerMenuProps) {
  return (
    <div
      className="menu-burger"
      style={{ display: showBurgerMenu ? "block" : "none" }}
    >
      <ul onClick={() => setShowBurgerMenu(false)}>{menuItems}</ul>
    </div>
  );
}

type CountrySelectProps = {
  showBurgerMenu: boolean;
  setShowBurgerMenu: (show: boolean) => void;
  countries: Country[];
  countryID: string;
  dispatch: Dispatch<Action>;
};

function CountrySelect({
  showBurgerMenu,
  setShowBurgerMenu,
  countries,
  dispatch,
}: CountrySelectProps) {
  const countrySelectOptions = [
    ...countries.map((country) => ({
      // eslint-disable-next-line no-irregular-whitespace
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
              if (e && "value" in e) {
                // Clear city and profession before country change
                dispatch({ type: ACTIONS.RESET_SEARCH });
                dispatch({
                  type: ACTIONS.SET_COUNTRY,
                  payload: { countryID: e.value },
                });
              }
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
  const { t } = useTranslation();
  return (
    <>
      <div className="terms">
        <ul>
          <li>{t("footer.terms")}</li>
          <li>{t("footer.faq")}</li>
          <li>{t("footer.moderation")}</li>
          <li>{t("footer.feedback")}</li>
        </ul>
      </div>
      <div className="love">
        <span>❤️</span>
        <span>🇺🇦</span>
      </div>
    </>
  );
}

type LanguageSwitcherProps = {
  countryID: string;
};

function LanguageSwitcher({ countryID }: LanguageSwitcherProps) {
  const { lang, setLang } = useTranslation();
  const localLang = COUNTRY_TO_LANG[countryID];
  const showLocal = localLang && localLang !== "uk" && localLang !== "en";

  return (
    <div className="lang-switcher">
      <button
        className={`lang-btn ${lang === "uk" ? "active" : ""}`}
        onClick={() => setLang("uk")}
        title="Українська"
      >
        {LANG_FLAGS["uk"]}
      </button>
      <button
        className={`lang-btn ${lang === "en" ? "active" : ""}`}
        onClick={() => setLang("en")}
        title="English"
      >
        {LANG_FLAGS["en"]}
      </button>
      {showLocal && (
        <button
          className={`lang-btn ${lang === localLang ? "active" : ""}`}
          onClick={() => setLang(localLang)}
          title={localLang.toUpperCase()}
        >
          {LANG_FLAGS[localLang]}
        </button>
      )}
    </div>
  );
}
