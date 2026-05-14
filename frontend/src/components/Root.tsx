import {
  Dispatch,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

const IS_DEV = window.location.hostname.startsWith("dev.");
import { Link, Outlet, useLocation } from "react-router-dom";
import { MasterContext } from "../context";
import { Action } from "../reducer";
import { ACTIONS } from "../data/actions";
import { useTranslation } from "../custom-hooks/useTranslation";
import { COUNTRY_TO_LANG, LANG_LABELS } from "../i18n/translations";

import type { Country } from "../schema/state/state.schema";

function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export default function Root() {
  const { state, dispatch } = useContext(MasterContext);
  const { user, countryID, countries } = state;
  const { isLoggedIn } = user;
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const { t, lang } = useTranslation();
  const location = useLocation();

  const now = new Date();
  const weekNum = getISOWeek(now);
  const yearSuffix = String(now.getFullYear()).slice(2);

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

  const AddMasterLink = isLoggedIn
    ? <Link to="/add">{t("nav.addMaster")}</Link>
    : <a href="https://t.me/majstr_bot">{t("nav.addMaster")}</a>;

  const AddMasterCta = isLoggedIn
    ? <Link to="/add" className="cta-header">JOIN AS MASTER →</Link>
    : <a href="https://t.me/majstr_bot" className="cta-header">JOIN AS MASTER →</a>;

  return (
    <>
      {IS_DEV && <DevBanner />}
      <header className="header">
        {/* Top meta strip */}
        <div className="header-meta">
          <span className="header-meta-label">EST. 2023 · WEEK {weekNum}/{yearSuffix}</span>

          <nav className="header-nav">
            <Link to="/" className={location.pathname === "/" ? "active" : ""}>{t("nav.search")}</Link>
            {AddMasterLink}
            <span className="nav-item inactive">{t("nav.howItWorks")}</span>
            <span className="nav-item inactive">{t("nav.forBusiness")}</span>
          </nav>

          <div className="header-controls">
            <CountryToggle
              countries={countries}
              countryID={countryID}
              dispatch={dispatch}
              lang={lang}
            />
            <LanguageSwitcher countryID={countryID} />
            {AddMasterCta}
          </div>

          <button
            className="burger-open"
            onClick={() => setShowBurgerMenu(!showBurgerMenu)}
            aria-label="Menu"
          >≡</button>
        </div>

        {/* Wordmark */}
        <div className="header-wordmark">
          <Link to="/" onClick={() => dispatch({ type: ACTIONS.RESET_SEARCH })}>
            MAJSTR<span className="wordmark-dot">.</span>
          </Link>
        </div>
      </header>

      {/* Mobile burger menu */}
      <div
        className={`menu-burger ${showBurgerMenu ? "open" : ""}`}
        style={{ display: showBurgerMenu ? "block" : "none" }}
        onClick={() => setShowBurgerMenu(false)}
      >
        <ul>
          <li><Link to="/">{t("nav.search")}</Link></li>
          <li>{isLoggedIn
            ? <Link to="/add">{t("nav.addMaster")}</Link>
            : <a href="https://t.me/majstr_bot">{t("nav.addMaster")}</a>}
          </li>
          <li><span className="inactive">{t("nav.faq")}</span></li>
          <li className="burger-controls" onClick={(e) => e.stopPropagation()}>
            <CountryToggle
              countries={countries}
              countryID={countryID}
              dispatch={dispatch}
              lang={lang}
            />
            <LanguageSwitcher countryID={countryID} />
          </li>
        </ul>
      </div>

      <Outlet />

      <footer className="footer">
        <FooterContent />
      </footer>
    </>
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
          {LANG_LABELS[code]}
        </button>
      ))}
      {showLocal && (
        <button
          className={`lang-btn ${lang === localLang ? "active" : ""}`}
          onClick={() => setLang(localLang)}
          title={localLang.toUpperCase()}
        >
          {LANG_LABELS[localLang]}
        </button>
      )}
    </div>
  );
}

const FOOTER_NATIONALITIES = ["UKRAINIAN", "GEORGIAN", "BELORUSSIAN", "RUSSIAN"];

function FooterContent() {
  const { t } = useTranslation();
  const [natIdx, setNatIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const busy = useRef(false);

  const nextWord = useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    setFading(true);
    setTimeout(() => {
      setNatIdx((i) => (i + 1) % FOOTER_NATIONALITIES.length);
      setFading(false);
      busy.current = false;
    }, 180);
  }, []);

  // Mobile: change word on overscroll-down (page already at bottom)
  useEffect(() => {
    let startY = 0;
    let changed = false;

    const onTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      changed = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (changed) return;
      const draggedDown = startY - e.touches[0].clientY > 20;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      if (atBottom && draggedDown) {
        changed = true;
        nextWord();
      }
    };

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
    };
  }, [nextWord]);

  return (
    <div className="footer-inner">
      <div className="footer-big">
        2 400+<br />
        <span
          className="footer-terra"
          style={{ transition: "opacity 0.18s", opacity: fading ? 0 : 1, cursor: "default" }}
          onMouseEnter={nextWord}
        >
          {FOOTER_NATIONALITIES[natIdx]}
        </span><br />
        CRAFTSMEN.
        <span className="footer-meta">© MAJSTR · MADE FOR THE COMMUNITY</span>
      </div>
      <div className="footer-top">
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
        <span>{t("footer.copyright")}</span>
        <span>{t("footer.madeWith")}</span>
      </div>
    </div>
  );
}

function DevBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <div style={{
      background: "#f5c542",
      color: "#0e0a06",
      fontSize: 11,
      fontFamily: "var(--font-mono)",
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      padding: "6px 40px 6px 16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      borderBottom: "2px solid #0e0a06",
      position: "relative",
    }}>
      Dev version — not for public use
      <button
        onClick={() => setVisible(false)}
        aria-label="Dismiss"
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 14,
          fontWeight: 900,
          color: "#0e0a06",
          lineHeight: 1,
          padding: "2px 6px",
          fontFamily: "var(--font-mono)",
        }}
      >✕</button>
    </div>
  );
}
