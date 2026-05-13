import "./../styles.css";

import { useContext, useEffect, useState } from "react";
import Select, {
  CSSObjectWithLabel,
  GroupBase,
  OptionProps,
} from "react-select";
import { MasterContext } from "../context";
import { ACTIONS } from "../data/actions";
import { useNavigation } from "react-router-dom";
import { useTranslation } from "../custom-hooks/useTranslation";

import SearchResults from "../components/SearchResults";
import Modal from "../components/Modal";
import {
  trackClickOutsideCard,
  trackEscWhenModalShown,
} from "../helpers/modal";

import type { Profession, ProfCategory } from "../schema/state/state.schema";
import type { Master } from "../schema/master/master.schema";
import type { Dispatch } from "react";
import type { Action } from "../reducer";

// Brutalist react-select styles — borderless control, Archivo Black value
// Used inside .filter-toggle-wrap which provides its own border.
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
  }),
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
  }),
};

// Backward compat alias
// eslint-disable-next-line react-refresh/only-export-components
export const baseSelectStyles = lightSelectStyles;

const CATEGORY_ICONS: [string, string][] = [
  ["renov", "🔧"], ["constru", "🔧"], ["ремон", "🔧"],
  ["plumb", "🚿"], ["water", "🚿"], ["сантех", "🚿"],
  ["electr", "⚡"],
  ["beauty", "💅"], ["nail", "💅"], ["манік", "💅"],
  ["hair", "✂️"], ["stylist", "✂️"], ["barber", "✂️"], ["перукар", "✂️"],
  ["it ", "💻"], ["tech", "💻"], ["computer", "💻"], ["software", "💻"],
  ["clean", "🏠"], ["прибир", "🏠"],
  ["paint", "🎨"], ["малярн", "🎨"],
  ["garden", "🌿"], ["садів", "🌿"],
  ["massage", "💆"], ["масаж", "💆"],
  ["medical", "🏥"], ["health", "🏥"],
  ["transport", "🚗"], ["moving", "📦"],
  ["cook", "🍳"], ["chef", "🍳"],
];

function getCategoryIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [key, icon] of CATEGORY_ICONS) {
    if (lower.includes(key)) return icon;
  }
  return "⚡";
}

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
  } = state;
  const { selectedCity, selectedProfessionCategory } = searchParams;
  const [showModal, setShowModal] = useState<string | null | boolean>(null);
  const { state: loadingState } = useNavigation();
  const isLoading = loadingState === "loading";
  const { t, lang } = useTranslation();

  const currentCountry = countries.find((c) => c.id === countryID);
  const countryDisplayName = currentCountry
    ? lang === "uk" ? currentCountry.name.ua : currentCountry.name.en
    : "";

  if (error) return (
    <div className="hero-section" style={{ minHeight: 200 }}>
      <div className="hero-terra-panel" style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div className="hero-live-label">Connection error</div>
        <div className="hero-stat-number" style={{ fontSize: "clamp(32px,5vw,72px)" }}>
          Can't reach server
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

  // Hero stat: total masters in current country + city filter
  const heroCount = masters.filter(
    (m) => m.countryID === countryID &&
      (selectedCity ? m.locationID === selectedCity : true)
  ).length;

  // Location name for stat description
  const selectedCityData = selectedCity ? locations.find((l) => l.id === selectedCity) : null;
  const statLocationName = selectedCityData
    ? (lang === "uk" ? selectedCityData.name.ua : selectedCityData.name.en)
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
      const professionName = lang === "uk" ? profEntry?.name.ua : profEntry?.name.en;
      const cityData = locations.find((l) => l.id === currentMaster.locationID);
      const cityName = lang === "uk" ? cityData?.name.ua_alt : cityData?.name.en;

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
        label: lang === "uk" ? loc?.name.ua_alt ?? "" : loc?.name.en ?? "",
      };
    })
  );

  const availableProfessionIDs = [
    ...new Set(
      masters
        .filter((m) => (selectedCity ? m.locationID === selectedCity : true))
        .map((m) => m.professionID)
    ),
  ];

  function buildProfessionOptions(ids: string[]) {
    const result = [{ value: "", label: t("main.allMasters") }];
    const uniqueCategories = [...new Set(ids.map((id) => getProfessionCategoryById(professions, id)))];
    result.push(
      ...uniqueCategories.map((catId) => {
        const cat = profCategories.find((c) => c.id === catId);
        return {
          value: catId,
          label: lang === "uk" ? cat?.name.ua ?? "" : cat?.name.en ?? "",
        };
      })
    );
    return result;
  }

  const professionSelectOptions = buildProfessionOptions(availableProfessionIDs);

  const defaultProfessionValue =
    professionSelectOptions.find((p) => p.value === selectedProfessionCategory) ??
    { value: "", label: t("main.allMasters") };

  function isModalMaster(id: string | boolean) {
    if (typeof id !== "string") return false;
    return masters.find((m) => m._id === id) || null;
  }

  return (
    <>
      {/* ── Hero section: terra stat | headline + filters | testimonial ── */}
      <section className="hero-section">
        {/* Left: terra stat panel */}
        <div className="hero-terra-panel">
          <div className="hero-live-label">{t("hero.liveLabel")}</div>
          <div className="hero-stat-number">{heroCount}</div>
          <div className="hero-stat-desc">
            {lang === "uk"
              ? `Українських майстрів доступно цього тижня у ${statLocationName}.`
              : `Ukrainian craftsmen available this week in ${statLocationName}.`}
          </div>
        </div>

        {/* Center: headline + filter controls */}
        <div className="hero-main-panel">
          <div className="hero-headline">
            <span>{t("hero.title")}</span>
            <br />
            <span className="hero-headline-terra">{t("hero.titleAccent")}</span>
          </div>
          <div className="hero-filter-row">
            <div className="filter-toggle-wrap">
              <span className="filter-kicker">{t("main.cityKicker")}</span>
              <Select
                className="headline-select"
                classNamePrefix="majstr-select"
                unstyled
                isSearchable={false}
                value={
                  selectedCity
                    ? availableLocations.find((l) => l.value === selectedCity) ?? availableLocations[0]
                    : availableLocations[0]
                }
                options={availableLocations}
                styles={lightSelectStyles}
                onChange={(e) => {
                  if (e && "value" in e) {
                    dispatch({ type: ACTIONS.SET_CITY, payload: { selectedCity: e.value } });
                  }
                }}
              />
            </div>
            <div className="filter-toggle-wrap dark">
              <span className="filter-kicker">{t("main.tradeKicker")}</span>
              <Select
                className="headline-select"
                classNamePrefix="majstr-select"
                value={{ value: selectedProfessionCategory, label: defaultProfessionValue.label }}
                unstyled
                isSearchable={false}
                options={professionSelectOptions}
                styles={lightSelectStyles}
                placeholder={t("main.allMasters")}
                onChange={(e) => {
                  if (e && "value" in e) {
                    dispatch({ type: ACTIONS.SET_PROFESSION, payload: { selectedProfessionCategory: e.value } });
                  }
                }}
              />
            </div>
            <button className="hero-search-btn">{t("hero.searchBtn")}</button>
          </div>
        </div>

        {/* Right: testimonial */}
        <div className="hero-testimonial">
          <div className="hero-testimonial-label">What clients say</div>
          <div className="hero-testimonial-q">"</div>
          <div className="hero-testimonial-text">
            Marko fixed our boiler same day. Spoke fluent Italian. Saved our weekend.
          </div>
          <div className="hero-testimonial-attr">MARCO B. · ROMA · ★ 5/5</div>
        </div>
      </section>

      {/* ── Trade chips ── */}
      <TradeChips
        profCategories={profCategories}
        selectedProfessionCategory={selectedProfessionCategory}
        dispatch={dispatch}
        lang={lang}
        t={t}
      />

      {/* ── Results ── */}
      <div className="results-section">
        {isLoading ? (
          <div className="results-top">
            <div className="search-results-header">
              <h2>{t("main.searching")}</h2>
            </div>
          </div>
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

type TradeChipsProps = {
  profCategories: ProfCategory[];
  selectedProfessionCategory: string;
  dispatch: Dispatch<Action>;
  lang: string;
  t: (key: string) => string;
};

function TradeChips({ profCategories, selectedProfessionCategory, dispatch, lang, t }: TradeChipsProps) {
  if (!profCategories.length) return null;

  return (
    <div className="trade-chips-row">
      <span className="trade-chips-label">{t("browse.browseLabel")}</span>
      <button
        className={`trade-chip ${!selectedProfessionCategory ? "active" : ""}`}
        onClick={() => dispatch({ type: ACTIONS.SET_PROFESSION, payload: { selectedProfessionCategory: "" } })}
      >
        {t("browse.allCategories")}
      </button>
      {profCategories.map((cat) => (
        <button
          key={cat.id}
          className={`trade-chip ${selectedProfessionCategory === cat.id ? "active" : ""}`}
          onClick={() =>
            dispatch({
              type: ACTIONS.SET_PROFESSION,
              payload: { selectedProfessionCategory: cat.id },
            })
          }
        >
          <span className="chip-icon">{getCategoryIcon(cat.name.en || cat.name.ua)}</span>
          {lang === "uk" ? cat.name.ua : cat.name.en}
        </button>
      ))}
    </div>
  );
}

function getProfessionCategoryById(professions: Profession[], professionID: string) {
  const result = professions.find((p) => p.id === professionID)?.categoryID;
  if (typeof result !== "string") {
    throw new Error(`Cannot find profession category for id ${professionID}`);
  }
  return result;
}

export const mainRoute = {
  element: <Main />,
};
