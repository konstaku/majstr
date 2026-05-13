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

export const lightSelectStyles = {
  control: (base: CSSObjectWithLabel) => ({
    ...base,
    background: "white",
    border: "1.5px solid #ede8e0",
    borderRadius: "10px",
    boxShadow: "none",
    cursor: "pointer",
    minWidth: "160px",
    "&:hover": { borderColor: "#c84b31" },
  }),
  singleValue: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "#1a1208",
    fontWeight: 600,
    fontSize: "14.5px",
  }),
  menu: (base: CSSObjectWithLabel) => ({
    ...base,
    borderRadius: "12px",
    border: "1.5px solid #ede8e0",
    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    backgroundColor: "white",
    overflow: "hidden",
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
    backgroundColor: state.isFocused ? "rgba(200,75,49,0.08)" : "white",
    color: state.isFocused ? "#c84b31" : "#1a1208",
    fontSize: "14px",
    padding: "10px 14px",
    cursor: "pointer",
  }),
  valueContainer: (base: CSSObjectWithLabel) => ({
    ...base,
    padding: "6px 12px",
    background: "white",
  }),
  dropdownIndicator: (base: CSSObjectWithLabel) => ({
    ...base,
    color: "#a8998e",
    padding: "0 8px",
  }),
  indicatorSeparator: () => ({ display: "none" as const }),
};

// Kept for backward compatibility with any other import
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
  const isError = false;
  const { t, lang } = useTranslation();

  const currentCountry = countries.find((c) => c.id === countryID);

  if (error) throw new Error(error);

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

  const countryDisplayName = currentCountry
    ? lang === "uk" ? currentCountry.name.ua : currentCountry.name.en
    : "";

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
      return { value: locId, label: lang === "uk" ? loc?.name.ua_alt ?? "" : loc?.name.en ?? "" };
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
        return { value: catId, label: lang === "uk" ? cat?.name.ua ?? "" : cat?.name.en ?? "" };
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
      {/* ── Hero search ── */}
      <section className="hero-search">
        <div className="hero-inner">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            {t("hero.eyebrow")}
          </div>
          <h1>
            {t("hero.title")}&nbsp;
            <span className="hero-accent">{t("hero.titleAccent")}</span>
          </h1>
          <p>{t("hero.subtitle")}</p>
          <div className="search-bar">
            <span className="search-bar-text">{t("main.liveIn")}</span>
            <Select
              className="headline-select"
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
            <div className="search-divider" />
            <span className="search-bar-text">{t("main.lookingFor")}</span>
            <Select
              className="headline-select"
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
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="how-section">
        <div className="how-inner">
          <div className="how-label">{t("how.label")}</div>
          <div className="how-steps">
            <div className="how-step">
              <div className="how-num">1</div>
              <div className="how-text">
                <strong>{t("how.step1Title")}</strong>
                <span>{t("how.step1Desc")}</span>
              </div>
            </div>
            <div className="how-step">
              <div className="how-num">2</div>
              <div className="how-text">
                <strong>{t("how.step2Title")}</strong>
                <span>{t("how.step2Desc")}</span>
              </div>
            </div>
            <div className="how-step">
              <div className="how-num">3</div>
              <div className="how-text">
                <strong>{t("how.step3Title")}</strong>
                <span>{t("how.step3Desc")}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Category pills ── */}
      <CategoryPills
        profCategories={profCategories}
        selectedProfessionCategory={selectedProfessionCategory}
        dispatch={dispatch}
        lang={lang}
        t={t}
      />

      {/* ── Testimonial ── */}
      <div className="testimonial-bar">
        <div className="testimonial-inner">
          <div className="testimonial-big-quote">"</div>
          <p className="testimonial-quote">
            I found Ivan through Majstr and he fixed our entire apartment's electrical system in two days. Professional, affordable, and spoke perfect Italian.
          </p>
          <div className="testimonial-author">
            <div className="testimonial-avatar">🧑‍💼</div>
            <div>
              <div className="testimonial-name">Marco Bianchi</div>
              <div className="testimonial-city">Homeowner, Rome</div>
              <div className="testimonial-stars">★★★★★</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="results-section">
        {isLoading ? (
          <div className="search-results-header">
            <h2>{t("main.searching")}</h2>
          </div>
        ) : isError ? (
          <div className="search-results-header">
            <h2>{t("main.cannotSearch")}</h2>
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

type CategoryPillsProps = {
  profCategories: ProfCategory[];
  selectedProfessionCategory: string;
  dispatch: Dispatch<Action>;
  lang: string;
  t: (key: string) => string;
};

function CategoryPills({ profCategories, selectedProfessionCategory, dispatch, lang, t }: CategoryPillsProps) {
  if (!profCategories.length) return null;

  return (
    <section className="cat-section">
      <div className="cat-inner">
        <div className="cat-label">{t("browse.label")}</div>
        <div className="cat-pills">
          <button
            className={`cat-pill ${!selectedProfessionCategory ? "active" : ""}`}
            onClick={() => dispatch({ type: ACTIONS.SET_PROFESSION, payload: { selectedProfessionCategory: "" } })}
          >
            <span className="cat-icon">✨</span>
            {t("browse.allCategories")}
          </button>
          {profCategories.map((cat) => (
            <button
              key={cat.id}
              className={`cat-pill ${selectedProfessionCategory === cat.id ? "active" : ""}`}
              onClick={() =>
                dispatch({
                  type: ACTIONS.SET_PROFESSION,
                  payload: { selectedProfessionCategory: cat.id },
                })
              }
            >
              <span className="cat-icon">{getCategoryIcon(cat.name.en || cat.name.ua)}</span>
              {lang === "uk" ? cat.name.ua : cat.name.en}
            </button>
          ))}
        </div>
      </div>
    </section>
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
