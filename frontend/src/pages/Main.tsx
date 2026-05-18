import "./../styles.css";

import { useContext, useEffect, useMemo, useState } from "react";
import Select, {
  CSSObjectWithLabel,
  GroupBase,
  OptionProps,
} from "react-select";
import { MasterContext } from "../context";
import { ACTIONS } from "../data/actions";
import { useNavigation } from "react-router-dom";
import { useTranslation } from "../custom-hooks/useTranslation";
import { localizedName } from "../i18n/lang";

import SearchResults from "../components/SearchResults";
import Modal from "../components/Modal";
import { useSlotCount } from "../custom-hooks/useSlotCount";
import {
  trackClickOutsideCard,
  trackEscWhenModalShown,
} from "../helpers/modal";

import type { Profession, ProfCategory } from "../schema/state/state.schema";
import type { Master } from "../schema/master/master.schema";
import type { Dispatch } from "react";
import type { Action } from "../reducer";

// ── Select styles ────────────────────────────────────────────────────────────

export const lightSelectStyles = {
  control: (base: CSSObjectWithLabel) => ({
    ...base,
    background: "transparent",
    border: "none",
    boxShadow: "none",
    minHeight: "auto",
    cursor: "pointer",
  }),
  singleValue: (base: CSSObjectWithLabel) => ({
    ...base,
    fontFamily: '"Archivo Black", "DM Sans", sans-serif',
    fontSize: "22px",
    fontWeight: 900,
    letterSpacing: "-0.03em",
    lineHeight: 1,
    color: "inherit",
    textTransform: "uppercase" as const,
  }),
  valueContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "0",
  }),
  dropdownIndicator: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "0 0 0 4px",
    color: "inherit",
    opacity: 0.5,
  }),
  indicatorSeparator: () => ({ display: "none" as const }),
  menu: (base: CSSObjectWithLabel) => ({
    ...base,
    borderRadius: "0",
    border: "2px solid #0e0a06",
    boxShadow: "4px 4px 0 #0e0a06",
    backgroundColor: "#fffaf0",
    overflow: "hidden",
    marginTop: "2px",
    minWidth: "100%",
    maxWidth: "280px",
    width: "max-content",
  }),
  // Portaled menu: clamp right edge so it never exits the viewport
  menuPortal: (base: CSSObjectWithLabel) => {
    const left = typeof base.left === "number" ? (base.left as number) : 0;
    const maxW = Math.min(280, window.innerWidth - left - 12);
    return { ...base, zIndex: 9999, maxWidth: `${maxW}px` };
  },
  option: (
    base: CSSObjectWithLabel,
    state: OptionProps<
      { value: string; label: string },
      boolean,
      GroupBase<{ value: string; label: string }>
    >
  ) => ({
    ...base,
    backgroundColor: state.isFocused ? "#c84b31" : "#fffaf0",
    color: state.isFocused ? "#fffaf0" : "#0e0a06",
    fontFamily: '"Archivo Black", "DM Sans", sans-serif',
    fontSize: "13px",
    fontWeight: 900,
    letterSpacing: "-0.01em",
    textTransform: "uppercase" as const,
    cursor: "pointer",
    padding: "10px 14px",
    whiteSpace: "normal" as const,
    overflowWrap: "break-word" as const,
  }),
};

export const baseSelectStyles = lightSelectStyles;

// ── Main component ────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
function Main() {
  const { state, dispatch } = useContext(MasterContext);
  const {
    masters,
    professions,
    locations,
    countries,
    countryID,
    profCategories,
    searchParams,
    error,
    loading,
  } = state;
  const { selectedCity, selectedProfessionCategory } = searchParams;
  const [showModal, setShowModal] = useState<string | null | boolean>(null);
  const [pendingCity, setPendingCity] = useState(selectedCity);
  const [pendingTrade, setPendingTrade] = useState(selectedProfessionCategory);

  // Sync pending state when external reset/navigation changes applied filters
  useEffect(() => {
    setPendingCity(selectedCity);
    setPendingTrade(selectedProfessionCategory);
  }, [selectedCity, selectedProfessionCategory]);
  const { state: loadingState } = useNavigation();
  const isNavigating = loadingState === "loading";
  const { t, lang } = useTranslation();

  const currentCountry = countries.find((c) => c.id === countryID);
  const countryDisplayName = currentCountry
    ? localizedName(currentCountry.name, lang, currentCountry.id)
    : "";

  const heroCount = loading ? null : masters.filter((m) => {
    if (m.countryID !== countryID) return false;
    if (selectedCity && m.locationID !== selectedCity) return false;
    if (selectedProfessionCategory) {
      const catID = professions.find((p) => p.id === m.professionID)?.categoryID;
      if (catID !== selectedProfessionCategory) return false;
    }
    return true;
  }).length;

  const selectedCityData = selectedCity ? locations.find((l) => l.id === selectedCity) : null;
  const statLocationName = selectedCityData
    ? localizedName(selectedCityData.name, lang)
    : countryDisplayName;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modalCard = params.get("card" || null);
    if (!modalCard) return;
    const masterIsValid = masters.find((m) => m._id === modalCard);
    if (modalCard && masterIsValid) setShowModal(modalCard);
  }, [masters]);

  useEffect(() => {
    const clickListener = (e: MouseEvent) =>
      trackClickOutsideCard(e, "details-modal", setShowModal);
    const keyUpListener = (e: KeyboardEvent) =>
      trackEscWhenModalShown(e, setShowModal);

    if (showModal) {
      const currentMaster = masters.find((m) => m._id === showModal);
      if (!currentMaster) return;

      document.addEventListener("click", clickListener);
      document.addEventListener("keyup", keyUpListener);

      const profEntry = professions.find((p) => p.id === currentMaster.professionID);
      const professionName = localizedName(profEntry?.name, lang);
      const cityData = locations.find((l) => l.id === currentMaster.locationID);
      const cityName =
        lang === "uk"
          ? cityData?.name.ua_alt ?? localizedName(cityData?.name, "uk")
          : localizedName(cityData?.name, lang);

      document.title = `${currentMaster.name} | ${professionName} ${t("main.inCity")} ${cityName}`;
    }

    return () => {
      if (showModal) {
        document.removeEventListener("click", clickListener);
        document.removeEventListener("keyup", keyUpListener);
      }
      document.title = t("main.appTitle");
    };
  }, [showModal, masters, locations, professions, lang, t]);

  const animatedCount = useSlotCount(heroCount);

  // ── Trade select options — must be before any early return ──
  const availableCategoryIDs = useMemo(() => {
    const pool = pendingCity
      ? masters.filter((m) => m.countryID === countryID && m.locationID === pendingCity)
      : masters.filter((m) => m.countryID === countryID);
    const profIDs = new Set(pool.map((m) => m.professionID));
    return new Set(professions.filter((p) => profIDs.has(p.id)).map((p) => p.categoryID));
  }, [masters, professions, countryID, pendingCity]);

  if (error) return (
    <div className="hero-section" style={{ minHeight: 200 }}>
      <div className="hero-terra-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="hero-live-label">Connection error</div>
        <div className="hero-stat-number" style={{ fontSize: "clamp(32px,5vw,72px)" }}>
          Can&apos;t reach server
        </div>
        <div className="hero-stat-desc">
          Make sure the backend is running on{" "}
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
            {import.meta.env.VITE_API_URL}
          </span>
        </div>
      </div>
    </div>
  );

  // ── City select options ──
  const locationPlaceholder = currentCountry
    ? { value: "", label: t("main.allCountry", { country: countryDisplayName }) }
    : { value: "", label: "..." };

  const availableLocations = [locationPlaceholder].concat(
    [...new Set(
      masters
        .filter((m) => m.countryID === countryID)
        .map((m) => m.locationID)
    )].map((locId) => {
      const loc = locations.find((l) => l.id === locId);
      return {
        value: locId,
        label:
          lang === "uk"
            ? loc?.name.ua_alt ?? localizedName(loc?.name, "uk", locId)
            : localizedName(loc?.name, lang, locId),
      };
    })
  );

  const allTradesOption = { value: "", label: t("browse.allCategories") };
  const tradeOptions = [allTradesOption].concat(
    profCategories
      .filter((cat: ProfCategory) => availableCategoryIDs.has(cat.id))
      .map((cat: ProfCategory) => ({
        value: cat.id,
        label: localizedName(cat.name, lang, cat.id),
      }))
  );

  function isModalMaster(id: string | boolean) {
    if (typeof id !== "string") return false;
    return masters.find((m) => m._id === id) || null;
  }

  return (
    <>
      {/* ── Hero section ── */}
      <section className="hero-section">
        {/* Left: terra stat panel */}
        <div className="hero-terra-panel">
          <div className="hero-live-label">{t("hero.liveLabel")}</div>
          <div className="hero-stat-number">
            {animatedCount === null ? <span className="hero-stat-loading">…</span> : animatedCount}
          </div>
          <div className="hero-stat-desc">
            {loading
              ? <span className="hero-stat-loading">&nbsp;</span>
              : lang === "uk"
                ? `Україномовних майстрів доступно цього тижня у ${statLocationName}.`
                : `Ukrainian-speaking craftsmen available this week in ${statLocationName}.`}
          </div>
        </div>

        {/* Center: headline + city/trade filter */}
        <div className="hero-main-panel">
          <div className="hero-headline">
            <span>{t("hero.title")}</span>
            <br />
            <span className="hero-headline-terra">{t("hero.titleAccent")}</span>
          </div>
          <div className="hero-filter-row">
            {/* City toggle */}
            <div className="filter-toggle-wrap">
              <span className="filter-kicker">{t("main.cityKicker")}</span>
              <Select
                className="headline-select"
                classNamePrefix="majstr-select"
                unstyled
                isSearchable={false}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                value={
                  pendingCity
                    ? availableLocations.find((l) => l.value === pendingCity) ?? availableLocations[0]
                    : availableLocations[0]
                }
                options={availableLocations}
                styles={lightSelectStyles}
                onChange={(e) => {
                  if (e && "value" in e) {
                    const newCity = e.value;
                    setPendingCity(newCity);
                    if (pendingTrade) {
                      const pool = newCity
                        ? masters.filter((m) => m.countryID === countryID && m.locationID === newCity)
                        : masters.filter((m) => m.countryID === countryID);
                      const profIDs = new Set(pool.map((m) => m.professionID));
                      const catIDs = new Set(professions.filter((p) => profIDs.has(p.id)).map((p) => p.categoryID));
                      if (!catIDs.has(pendingTrade)) setPendingTrade("");
                    }
                  }
                }}
              />
            </div>
            {/* Trade toggle — same style as city */}
            <div className="filter-toggle-wrap filter-toggle-noright">
              <span className="filter-kicker">{t("main.tradeKicker")}</span>
              <Select
                className="headline-select"
                classNamePrefix="majstr-select"
                unstyled
                isSearchable={false}
                menuPortalTarget={document.body}
                menuPosition="fixed"
                value={
                  pendingTrade
                    ? tradeOptions.find((o) => o.value === pendingTrade) ?? tradeOptions[0]
                    : tradeOptions[0]
                }
                options={tradeOptions}
                styles={lightSelectStyles}
                onChange={(e) => {
                  if (e && "value" in e) setPendingTrade(e.value);
                }}
              />
            </div>
            {/* Search button */}
            <button
              type="button"
              className="filter-search-btn"
              onClick={() => {
                dispatch({ type: ACTIONS.SET_CITY, payload: { selectedCity: pendingCity } });
                dispatch({ type: ACTIONS.SET_PROFESSION, payload: { selectedProfessionCategory: pendingTrade } });
              }}
            >
              {t("hero.searchBtn")}
            </button>
          </div>
        </div>

        {/* Right: "What clients say" — ink panel, ≥1440 only (CSS-controlled) */}
        <div className="hero-testimonial">
          <div className="hero-testimonial-label">{t("hero.testimonialLabel")}</div>
          <div className="hero-testimonial-q">&ldquo;</div>
          <div className="hero-testimonial-text">{t("hero.testimonialQuote")}</div>
          <div className="hero-testimonial-attr">{t("hero.testimonialAttr")}</div>
        </div>
      </section>

      {/* ── How it works ── */}
      <HowItWorks t={t} />

      {/* ── Results ── */}
      <div className="results-section">
        {loading || isNavigating ? (
          <SkeletonGrid />
        ) : (
          <>
            <SearchResults
              masters={masters}
              city={selectedCity}
              professionCategory={selectedProfessionCategory}
              setShowModal={setShowModal}
            />
            {showModal && isModalMaster(showModal) && (
              <Modal
                master={isModalMaster(showModal) as Master}
                setShowModal={setShowModal}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <>
      <div className="results-top results-top-skeleton">
        <div className="skeleton-block" style={{ width: 220, height: 22, borderRadius: 0 }} />
      </div>
      <div className="masters-grid">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="skeleton-card-top">
              <div className="skeleton-block skeleton-photo" />
              <div className="skeleton-card-identity">
                <div className="skeleton-block" style={{ height: 16, width: "70%" }} />
                <div className="skeleton-block" style={{ height: 12, width: "50%", marginTop: 8 }} />
                <div className="skeleton-block" style={{ height: 18, width: "40%", marginTop: 10 }} />
              </div>
            </div>
            <div className="skeleton-card-bottom">
              <div className="skeleton-block skeleton-rating" />
              <div className="skeleton-block" style={{ flex: 1, margin: "8px 12px" }} />
              <div className="skeleton-block skeleton-btn" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

const HOW_STEPS = [
  { n: "01", titleKey: "how.step1Title", descKey: "how.step1Desc" },
  { n: "02", titleKey: "how.step2Title", descKey: "how.step2Desc" },
  { n: "03", titleKey: "how.step3Title", descKey: "how.step3Desc" },
] as const;

function HowItWorks({ t }: { t: (key: string) => string }) {
  return (
    <div className="how-it-works">
      {/* Desktop/tablet: full 3-column layout */}
      <div className="how-works-inner how-works-full">
        <div className="how-works-label">{t("how.label")}</div>
        <div className="how-works-steps">
          {HOW_STEPS.map((s, i) => (
            <div key={s.n} className={`how-step${i === 1 ? " how-step-mid" : ""}`}>
              <div className="how-step-num-col">
                <span className="how-step-num">{s.n}</span>
              </div>
              <div className="how-step-body">
                <div className="how-step-header">
                  <span className="how-step-num how-step-num-inline">{s.n}</span>
                  <span className="how-step-title">{t(s.titleKey)}</span>
                </div>
                <div className="how-step-desc">{t(s.descKey)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Mobile: compact single-line strip */}
      <div className="how-compact-mobile">
        {HOW_STEPS.map((s, i) => (
          <span key={s.n} className="how-compact-item">
            <span className="how-compact-n">{s.n}</span>
            {t(s.titleKey)}
            {i < HOW_STEPS.length - 1 && <span className="how-compact-sep"> · </span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Unused but retained ───────────────────────────────────────────────────────

function getProfessionCategoryById(professions: Profession[], professionID: string) {
  const result = professions.find((p) => p.id === professionID)?.categoryID;
  if (typeof result !== "string") {
    throw new Error(`Cannot find profession category for id ${professionID}`);
  }
  return result;
}
void getProfessionCategoryById;

// ── TradeChips kept as dead code — category browsing now lives in hero filter
type TradeChipsProps = {
  profCategories: ProfCategory[];
  selectedProfessionCategory: string;
  dispatch: Dispatch<Action>;
  lang: string;
  t: (key: string) => string;
};
void (null as unknown as TradeChipsProps);

export const mainRoute = {
  element: <Main />,
};
