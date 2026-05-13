import {
  Dispatch,
  ReactElement,
  useContext,
  useEffect,
  useState,
} from "react";
import { Link, Outlet } from "react-router-dom";
import { MasterContext } from "../context";
import { Action } from "../reducer";
import { ACTIONS } from "../data/actions";
import { useTranslation } from "../custom-hooks/useTranslation";
import { COUNTRY_TO_LANG, LANG_FLAGS, LANG_LABELS } from "../i18n/translations";

import type { Country } from "../schema/state/state.schema";

export default function Root() {
  const { state, dispatch } = useContext(MasterContext);
  const { user, countryID, countries } = state;
  const { isLoggedIn } = user;
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const { t, lang } = useTranslation();

  const availableCountries = ["IT", "PT"];
  const defaultCountry = "IT";

  useEffect(() => {
    const controller = new AbortController();
    fetch("https://ipinfo.io/json", { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((result) => {
        const userCountry = availableCountries.includes(result.country)
          ? result.country
          : defaultCountry;
        dispatch({ type: ACTIONS.SET_COUNTRY, payload: { countryID: userCountry } });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [dispatch]);

  useEffect(() => {
    if (!state.countrySet) return;
    const controller = new AbortController();

    (async () => {
      try {
        const [masters, professions, profCategories, locations, countriesData] =
          await Promise.all([
            fetch(`${import.meta.env.VITE_API_URL}/?q=masters&country=${countryID}`, { signal: controller.signal }).then((r) => r.json()),
            fetch(`${import.meta.env.VITE_API_URL}/?q=professions`, { signal: controller.signal }).then((r) => r.json()),
            fetch(`${import.meta.env.VITE_API_URL}/?q=prof-categories`, { signal: controller.signal }).then((r) => r.json()),
            fetch(`${import.meta.env.VITE_API_URL}/?q=locations&country=${countryID}`, { signal: controller.signal }).then((r) => r.json()),
            fetch(`${import.meta.env.VITE_API_URL}/?q=countries`, { signal: controller.signal }).then((r) => r.json()),
          ]);
        dispatch({ type: ACTIONS.POPULATE, payload: { masters, professions, profCategories, locations, countries: countriesData } });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        dispatch({ type: ACTIONS.ERROR, payload: { error: "Can't load data" } });
      }
    })();

    return () => controller.abort();
  }, [state.countrySet, countryID, dispatch]);

  useEffect(() => {
    const token = JSON.parse(localStorage.getItem("token") as string);
    if (!token) return dispatch({ type: ACTIONS.LOGOUT });
    const user = JSON.parse(atob(token.split(".")[1]));
    dispatch({ type: ACTIONS.LOGIN, payload: { user } });
  }, [dispatch]);

  const menuItems = (
    <>
      <li>
        <Link to="/">{t("nav.search")}</Link>
      </li>
      {isLoggedIn ? (
        <li>
          <Link to="/add">{t("nav.addMaster")}</Link>
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
        <LogoMark dispatch={dispatch} />
        <DesktopMenu menuItems={menuItems} />
        <div className="header-right">
          <CountryToggle
            countries={countries}
            countryID={countryID}
            dispatch={dispatch}
            lang={lang}
          />
          <LanguageSwitcher countryID={countryID} />
          {isLoggedIn ? (
            <Link to="/add" className="cta-header">
              + {t("nav.addMaster")}
            </Link>
          ) : (
            <a href="https://t.me/majstr_bot" className="cta-header">
              + {t("nav.addMaster")}
            </a>
          )}
          <div
            className="burger-open"
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
          >
            <img src="/img/icons/burger.svg" alt="menu" width="20px" />
          </div>
        </div>
      </header>

      <div
        className={`menu-burger ${showBurgerMenu ? "open" : ""}`}
        style={{ display: showBurgerMenu ? "block" : "none" }}
      >
        <ul onClick={() => setShowBurgerMenu(false)}>{menuItems}</ul>
      </div>

      <Outlet />

      <footer className="footer">
        <FooterContent />
      </footer>
    </>
  );
}

type LogoMarkProps = { dispatch: Dispatch<Action> };

function LogoMark({ dispatch }: LogoMarkProps) {
  return (
    <Link to="/" className="logo" onClick={() => dispatch({ type: ACTIONS.RESET_SEARCH })}>
      <div className="logo-icon">M</div>
      <span className="logo-text">
        maj<span className="logo-accent">str</span>
      </span>
    </Link>
  );
}

type DesktopMenuProps = { menuItems: ReactElement };

function DesktopMenu({ menuItems }: DesktopMenuProps) {
  return (
    <nav className="menu">
      <ul>{menuItems}</ul>
    </nav>
  );
}

type CountryToggleProps = {
  countries: Country[];
  countryID: string;
  dispatch: Dispatch<Action>;
  lang: string;
};

function CountryToggle({ countries, countryID, dispatch, lang }: CountryToggleProps) {
  if (!countries.length) return null;
  return (
    <div className="country-toggle">
      {countries.map((country) => (
        <button
          key={country.id}
          className={`ctry-btn ${countryID === country.id ? "active" : ""}`}
          onClick={() => {
            dispatch({ type: ACTIONS.RESET_SEARCH });
            dispatch({ type: ACTIONS.SET_COUNTRY, payload: { countryID: country.id } });
          }}
        >
          {country.flag} {lang === "uk" ? country.name.ua : country.name.en}
        </button>
      ))}
    </div>
  );
}

type LanguageSwitcherProps = { countryID: string };

function LanguageSwitcher({ countryID }: LanguageSwitcherProps) {
  const { lang, setLang } = useTranslation();
  const localLang = COUNTRY_TO_LANG[countryID];
  const showLocal = localLang && localLang !== "uk" && localLang !== "en";

  return (
    <div className="lang-switcher">
      {(["uk", "en"] as const).map((code) => (
        <button
          key={code}
          className={`lang-btn ${lang === code ? "active" : ""}`}
          onClick={() => setLang(code)}
          title={code.toUpperCase()}
        >
          <span className="lang-flag-emoji">{LANG_FLAGS[code]}</span>
          {LANG_LABELS[code]}
        </button>
      ))}
      {showLocal && (
        <button
          className={`lang-btn ${lang === localLang ? "active" : ""}`}
          onClick={() => setLang(localLang)}
          title={localLang.toUpperCase()}
        >
          <span className="lang-flag-emoji">{LANG_FLAGS[localLang]}</span>
          {LANG_LABELS[localLang]}
        </button>
      )}
    </div>
  );
}

function FooterContent() {
  const { t } = useTranslation();
  return (
    <div className="footer-inner">
      <div className="footer-top">
        <div>
          <div className="footer-logo">majstr</div>
          <p className="footer-tagline">{t("footer.tagline")}</p>
        </div>
        <div className="footer-col">
          <h4>Platform</h4>
          <Link to="/">{t("nav.search")}</Link>
          <a href="https://t.me/majstr_bot">{t("nav.addMaster")}</a>
          <span className="inactive">{t("nav.faq")}</span>
        </div>
        <div className="footer-col">
          <h4>Legal</h4>
          <span>{t("footer.terms")}</span>
          <span>{t("footer.moderation")}</span>
          <span>{t("footer.feedback")}</span>
        </div>
        <div className="footer-col">
          <h4>Community</h4>
          <a href="https://t.me/majstr_bot">Telegram Bot</a>
        </div>
      </div>
      <div className="footer-bottom">
        <p>{t("footer.copyright")}</p>
        <p>{t("footer.madeWith")}</p>
      </div>
    </div>
  );
}
