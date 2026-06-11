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
import { useClaimDeepLink } from "../surface/useClaimDeepLink";
import { LANG_LABELS, LANG_FLAGS } from "../i18n/translations";
import {
  localizedName,
  APP_LANGS,
  LANG_ENDONYM,
  type AppLang,
} from "../i18n/lang";
import { apiFetch } from "../api/client";
import AddMasterModal from "./AddMasterModal";

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
  const { countryID, countries, user } = state;
  const [showBurgerMenu, setShowBurgerMenu] = useState(false);
  const [showAddMasterModal, setShowAddMasterModal] = useState(false);
  const { t, lang } = useTranslation();
  const location = useLocation();
  const burgerToggleRef = useRef<HTMLButtonElement>(null);
  const burgerMenuRef = useRef<HTMLDivElement>(null);

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
            apiFetch(`/?q=masters&country=${countryID}`, { signal: controller.signal }).then((r) => r.json()),
            apiFetch(`/?q=professions`, { signal: controller.signal }).then((r) => r.json()),
            apiFetch(`/?q=prof-categories`, { signal: controller.signal }).then((r) => r.json()),
            apiFetch(`/?q=locations&country=${countryID}`, { signal: controller.signal }).then((r) => r.json()),
            apiFetch(`/?q=countries`, { signal: controller.signal }).then((r) => r.json()),
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

  // Claim deep links can enter through any TMA entry route.
  useClaimDeepLink();

  // Burger overlay: lock background scroll, close on Escape, and manage
  // focus (move into the overlay on open, return to the toggle on close).
  useEffect(() => {
    if (!showBurgerMenu) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Capture the toggle node now; the burger toggle stays mounted, so
    // this is the element we want to restore focus to on close.
    const toggleEl = burgerToggleRef.current;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowBurgerMenu(false);
    };
    document.addEventListener("keydown", onKey);

    // Move focus to the first focusable element inside the overlay.
    const firstFocusable = burgerMenuRef.current?.querySelector<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])',
    );
    firstFocusable?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      // Return focus to the burger toggle after the menu closes.
      toggleEl?.focus();
    };
  }, [showBurgerMenu]);

  const openAddMasterModal = () => setShowAddMasterModal(true);

  const AddMasterLink = (
    <button type="button" className="nav-item" onClick={openAddMasterModal}>
      {t("nav.addMaster")}
    </button>
  );

  const renderAddMasterCta = () => (
    <button
      type="button"
      className="cta-header"
      onClick={openAddMasterModal}
      aria-label={t("nav.joinAsMaster")}
    >
      {t("nav.joinAsMaster")}
    </button>
  );

  return (
    <>
      {IS_DEV && <DevBanner />}
      <header className="header">
        {/* Top meta strip — repurposed as the sticky compact bar on mobile */}
        <div className="header-meta">
          <span className="header-meta-label">EST. 2023 · WEEK {weekNum}/{yearSuffix}</span>

          {/* Compact wordmark — mobile-only (CSS-gated), left of the bar */}
          <Link
            to="/"
            className="header-logo-compact"
            onClick={() => dispatch({ type: ACTIONS.RESET_SEARCH })}
          >
            MAJSTR<span className="wordmark-dot">.</span>
          </Link>

          <nav className="header-nav">
            <Link to="/" className={location.pathname === "/" ? "active" : ""}>{t("nav.search")}</Link>
            {AddMasterLink}
            {user.isLoggedIn && (
              <Link to="/my-cards" className={location.pathname === "/my-cards" ? "active" : ""}>
                {t("nav.myCards")}
              </Link>
            )}
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
            <LanguageSwitcher />
            {renderAddMasterCta()}
          </div>

          {/* Mobile-only bar actions (burger + CTA). Desktop hides this and
              shows the CTA inside .header-controls instead. */}
          <div className="header-bar-actions">
            <button
              ref={burgerToggleRef}
              type="button"
              className="burger-open"
              onClick={() => setShowBurgerMenu((v) => !v)}
              aria-expanded={showBurgerMenu}
              aria-controls="mobile-menu"
              aria-label={showBurgerMenu ? "Close menu" : "Open menu"}
            >{showBurgerMenu ? "✕" : "≡"}</button>
            {renderAddMasterCta()}
          </div>
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
        id="mobile-menu"
        ref={burgerMenuRef}
        className={`menu-burger ${showBurgerMenu ? "open" : ""}`}
        style={{ display: showBurgerMenu ? "block" : "none" }}
        onClick={() => setShowBurgerMenu(false)}
      >
        <ul>
          <li><Link to="/">{t("nav.search")}</Link></li>
          <li>
            <button type="button" className="burger-link" onClick={() => { setShowBurgerMenu(false); openAddMasterModal(); }}>
              {t("nav.addMaster")}
            </button>
          </li>
          {user.isLoggedIn && (
            <li><Link to="/my-cards">{t("nav.myCards")}</Link></li>
          )}
          <li><span className="inactive">{t("nav.faq")}</span></li>
          <li className="burger-controls" onClick={(e) => e.stopPropagation()}>
            <CountryToggle
              countries={countries}
              countryID={countryID}
              dispatch={dispatch}
              lang={lang}
            />
            <LanguageSwitcher onClose={() => setShowBurgerMenu(false)} />
          </li>
        </ul>
      </div>

      <Outlet />

      <footer className="footer">
        <FooterContent onAddMasterClick={openAddMasterModal} />
      </footer>

      {showAddMasterModal && (
        <AddMasterModal onClose={() => setShowAddMasterModal(false)} />
      )}
    </>
  );
}

type CountryToggleProps = {
  countries: Country[];
  countryID: string;
  dispatch: Dispatch<Action>;
  lang: string;
};

// TEMPORARILY DISABLED: Italy is the only/default country, so the country
// selector is hidden. Flip to true to restore the toggle.
const COUNTRY_SELECTOR_ENABLED = false;

function CountryToggle({ countries, countryID, dispatch, lang }: CountryToggleProps) {
  if (!COUNTRY_SELECTOR_ENABLED || !countries.length) return null;
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
          {country.flag} {localizedName(country.name, lang, country.id)}
        </button>
      ))}
    </div>
  );
}

function LanguageSwitcher({ onClose }: { onClose?: () => void }) {
  const { lang, setLang } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const cur: AppLang = (APP_LANGS as readonly string[]).includes(lang)
    ? (lang as AppLang)
    : "en";

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const ariaName = (code: AppLang) =>
    code === "ru" ? "RU — Русский" : LANG_ENDONYM[code];

  return (
    <nav className="lang-switcher" aria-label="Language" ref={wrapRef}>
      <div className="lang-more">
        {/* Only the active language is shown; clicking opens the full menu */}
        <button
          className="lang-btn active lang-current"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="lang-menu"
          aria-label={`Language: ${LANG_ENDONYM[cur]}`}
          onClick={() => setOpen((o) => !o)}
        >
          {LANG_FLAGS[cur] ? (
            <span aria-hidden="true">{LANG_FLAGS[cur]} </span>
          ) : null}
          {LANG_LABELS[cur]} ▾
        </button>
        {open && (
          <div className="lang-popover" id="lang-menu" role="menu">
            {APP_LANGS.map((code) => (
              <button
                key={code}
                role="menuitem"
                className={`lang-popover-item ${lang === code ? "active" : ""}`}
                onClick={() => {
                  setLang(code);
                  setOpen(false);
                  onClose?.();
                }}
                aria-current={lang === code ? "true" : undefined}
                aria-label={ariaName(code)}
              >
                {LANG_FLAGS[code] ? (
                  <span aria-hidden="true">{LANG_FLAGS[code]} </span>
                ) : null}
                {LANG_LABELS[code]}
                <span className="lang-endo">{LANG_ENDONYM[code]}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}

const FOOTER_NATIONALITIES = ["UKRAINIAN", "GEORGIAN", "BELORUSSIAN", "RUSSIAN"];

function FooterContent({ onAddMasterClick }: { onAddMasterClick: () => void }) {
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
          <button type="button" className="footer-link" onClick={onAddMasterClick}>
            {t("nav.addMaster")}
          </button>
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
