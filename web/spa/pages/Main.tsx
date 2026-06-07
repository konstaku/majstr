"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MasterContext } from "../context";
import { ACTIONS } from "../data/actions";
import { useTranslation } from "../custom-hooks/useTranslation";
import { localizedName } from "../i18n/lang";
import { SelectField } from "../components/SelectField";

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

// ── Main component ────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
function Main({ initialCard }: { initialCard?: string } = {}) {
  const { state, dispatch } = useContext(MasterContext);
  const router = useRouter();
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
  const [showModal, setShowModal] = useState<string | null | boolean>(initialCard ?? null);
  const [pendingCity, setPendingCity] = useState(selectedCity);
  const [pendingTrade, setPendingTrade] = useState(selectedProfessionCategory);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Lazy-loaded full master records (about + contacts), keyed by id. The grid
  // ships a slim projection (see lib/seed.ts); the heavy fields are fetched only
  // when a card's modal opens. The detail page seeds its master full, so that
  // case short-circuits (ctx master already has `contacts`) and never fetches.
  const [details, setDetails] = useState<Record<string, Master>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Portal the select menus to <body> only AFTER mount, so the server and the
  // first client render match (both undefined) — avoids a hydration mismatch
  // that would leave the selects/modal non-interactive.

  // When a modal opens for a master we only have slim data for, fetch the full
  // record (about + contacts). The modal opens instantly with the slim fields
  // already present; contacts/bio fill in when this resolves.
  useEffect(() => {
    if (typeof showModal !== "string") return;
    const ctx = masters.find((m) => m._id === showModal);
    if (!ctx || ctx.contacts || details[showModal]) return;
    let cancelled = false;
    setDetailsLoading(true);
    fetch(`/api/master/${showModal}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((full: Master | null) => {
        if (full && !cancelled) setDetails((d) => ({ ...d, [full._id]: full }));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [showModal, masters, details]);

  // Sync pending state when external reset/navigation changes applied filters
  useEffect(() => {
    setPendingCity(selectedCity);
    setPendingTrade(selectedProfessionCategory);
  }, [selectedCity, selectedProfessionCategory]);
  const isNavigating = false;
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
    const modalCard = params.get("card");
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
      const cityName = localizedName(cityData?.name, lang);

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
            {process.env.NEXT_PUBLIC_API_URL}
          </span>
        </div>
      </div>
    </div>
  );

  // ── City select options (all locations, count or SOON) ──
  const countryMastersForCity = masters.filter((m) => m.countryID === countryID);
  const masterCountByCity = countryMastersForCity.reduce<Record<string, number>>((acc, m) => {
    acc[m.locationID] = (acc[m.locationID] ?? 0) + 1;
    return acc;
  }, {});

  const allItalyCount = countryMastersForCity.length;
  const allCityLabel = currentCountry
    ? t("main.allCountry", { country: countryDisplayName })
    : "...";

  const cityOptions = [
    { value: "", label: allCityLabel, count: allItalyCount as number | "SOON" },
    ...locations
      .filter((l) => l.countryID === countryID)
      .map((loc) => ({
        value: loc.id,
        label: localizedName(loc.name, lang, loc.id),
        count: (masterCountByCity[loc.id] ?? 0) > 0
          ? (masterCountByCity[loc.id] as number | "SOON")
          : ("SOON" as const),
      }))
      .sort((a, b) => {
        if (a.count === "SOON" && b.count !== "SOON") return 1;
        if (b.count === "SOON" && a.count !== "SOON") return -1;
        if (typeof a.count === "number" && typeof b.count === "number") return b.count - a.count;
        return 0;
      }),
  ];

  // ── Trade select options (all categories, count or SOON) ──
  const cityMastersForTrade = pendingCity
    ? countryMastersForCity.filter((m) => m.locationID === pendingCity)
    : countryMastersForCity;

  const profToCat = new Map(professions.map((p: Profession) => [p.id, p.categoryID]));
  const masterCountByCat = cityMastersForTrade.reduce<Record<string, number>>((acc, m) => {
    const cat = profToCat.get(m.professionID);
    if (cat) acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});

  const tradeOptions = [
    { value: "", label: t("browse.allCategories"), count: cityMastersForTrade.length as number | "SOON" },
    ...profCategories
      .map((cat) => ({
        value: cat.id,
        label: localizedName(cat.name, lang, cat.id),
        count: (masterCountByCat[cat.id] ?? 0) > 0
          ? (masterCountByCat[cat.id] as number | "SOON")
          : ("SOON" as const),
      }))
      .sort((a, b) => {
        if (a.count === "SOON" && b.count !== "SOON") return 1;
        if (b.count === "SOON" && a.count !== "SOON") return -1;
        if (typeof a.count === "number" && typeof b.count === "number") return b.count - a.count;
        return 0;
      }),
  ];

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
              <SelectField
                kicker={t("main.cityKicker")}
                options={cityOptions}
                value={pendingCity}
                onChange={(newCity) => {
                  setPendingCity(newCity);
                  if (pendingTrade) {
                    const pool = newCity
                      ? masters.filter((m) => m.countryID === countryID && m.locationID === newCity)
                      : masters.filter((m) => m.countryID === countryID);
                    const profIDs = new Set(pool.map((m) => m.professionID));
                    const catIDs = new Set(professions.filter((p: Profession) => profIDs.has(p.id)).map((p: Profession) => p.categoryID));
                    if (!catIDs.has(pendingTrade)) setPendingTrade("");
                  }
                }}
              />
            </div>
            {/* Trade toggle */}
            <div className="filter-toggle-wrap filter-toggle-noright">
              <SelectField
                kicker={t("main.tradeKicker")}
                options={tradeOptions}
                value={pendingTrade}
                onChange={setPendingTrade}
              />
            </div>
            {/* Search button */}
            <button
              type="button"
              className="filter-search-btn"
              onClick={() => {
                dispatch({ type: ACTIONS.SET_CITY, payload: { selectedCity: pendingCity } });
                dispatch({ type: ACTIONS.SET_PROFESSION, payload: { selectedProfessionCategory: pendingTrade } });
                // Filters drive the URL: /{lang}/{city}/{category} (each part optional).
                const segs = [lang];
                if (pendingCity) segs.push(pendingCity);
                if (pendingTrade) segs.push(pendingTrade);
                router.push("/" + segs.join("/"));
                setTimeout(() => {
                  if (!resultsRef.current) return;
                  const headerEl = document.querySelector(".header") as HTMLElement | null;
                  const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
                  const top = resultsRef.current.getBoundingClientRect().top + window.scrollY - headerHeight;
                  window.scrollTo({ top, behavior: "smooth" });
                }, 50);
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
      <div className="results-section" ref={resultsRef}>
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
            {typeof showModal === "string" && isModalMaster(showModal) && (() => {
              const ctx = masters.find((m) => m._id === showModal)!;
              const full = details[showModal] ?? ctx;
              return (
                <Modal
                  master={full}
                  setShowModal={setShowModal}
                  loadingDetails={detailsLoading && !full.contacts}
                />
              );
            })()}
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

export default Main;
