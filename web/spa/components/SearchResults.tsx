"use client";

import { useContext, useEffect, useRef, useState } from "react";
import { MasterContext } from "../context";
import MasterCard from "./MasterCard";
import { useTranslation } from "../custom-hooks/useTranslation";
import { ACTIONS } from "../data/actions";

import type { Master } from "../schema/master/master.schema";
import type { Profession } from "../schema/state/state.schema";

// Render the grid in windows: only the first batch is in the initial (SSR) HTML
// — the home page would otherwise emit all ~321 cards (~450 KB of markup). The
// rest reveal as the user scrolls via an IntersectionObserver. The full dataset
// is already in client state (slim seed), so this is pure render windowing — no
// extra fetches.
const INITIAL_VISIBLE = 24;
const LOAD_STEP = 24;

type SearchResultsProps = {
  masters: Master[];
  city: string;
  professionCategory: string;
  setShowModal: (show: string) => void;
};

function getCreatedMs(id: string): number {
  return parseInt(id.slice(0, 8), 16) * 1000;
}

function getWeekStart(): number {
  const now = new Date();
  const day = now.getDay() || 7;
  const start = new Date(now);
  start.setDate(now.getDate() - (day - 1));
  start.setHours(0, 0, 0, 0);
  return start.getTime();
}

/** Mark "new" masters using the same rule SearchResults used before:
 *  if 2+ masters were added this week, they're all NEW; otherwise the
 *  four newest of the dataset get the NEW badge. */
function buildNewSet(allCountryMasters: Master[]): Set<string> {
  const weekStart = getWeekStart();
  const sorted = [...allCountryMasters].sort((a, b) => getCreatedMs(b._id) - getCreatedMs(a._id));
  const thisWeek = sorted.filter(m => getCreatedMs(m._id) >= weekStart);
  const set = new Set<string>();
  if (thisWeek.length >= 2) {
    thisWeek.forEach(m => set.add(m._id));
  } else {
    sorted.slice(0, 4).forEach(m => set.add(m._id));
  }
  return set;
}

export default function SearchResults({
  masters,
  city,
  professionCategory,
  setShowModal,
}: SearchResultsProps) {
  const {
    state: { professions, locations, countryID },
    dispatch,
  } = useContext(MasterContext);
  const { t } = useTranslation();

  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // New result set (filter changed) → reset the window to the first batch.
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [city, professionCategory]);

  const availableProfessionIDs = professions
    .filter((p: Profession) => (!professionCategory ? true : p.categoryID === professionCategory))
    .map((p: Profession) => p.id);

  const filteredMasters = masters
    .filter(
      (m) =>
        m.countryID === countryID &&
        m.locationID.includes(city) &&
        availableProfessionIDs.includes(m.professionID)
    )
    .sort(
      (a, b) =>
        // Owner-verified cards first, then newest.
        Number(!!b.verified) - Number(!!a.verified) ||
        getCreatedMs(b._id) - getCreatedMs(a._id)
    );

  const visibleMasters = filteredMasters.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMasters.length;

  // Reveal the next batch as the sentinel nears the viewport. Re-armed after
  // each batch (visibleMasters.length dep) so it keeps filling a tall viewport.
  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((c) => c + LOAD_STEP);
      },
      { rootMargin: "800px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visibleMasters.length]);

  const countryMasters = masters.filter(m => m.countryID === countryID);
  const newSet = buildNewSet(countryMasters);

  const hasActiveFilter = city !== "" || professionCategory !== "";

  return (
    <>
      <div className="results-top">
        <div className="search-results-header">
          <h2>
            <span className="found-amount" key={filteredMasters.length}>{filteredMasters.length}</span>
            {" "}{t("results.sortedByRating")}
          </h2>
        </div>
        <span className="results-telegram-note">{t("hero.telegramNote")}</span>
      </div>

      {filteredMasters.length === 0 ? (
        <div className="masters-empty">
          <span className="masters-empty-line">
            {city
              ? (() => {
                  const loc = locations.find((l) => l.id === city);
                  const name = loc?.name?.ua ?? loc?.name?.en ?? city;
                  return t("results.emptyCity").replace("{city}", name);
                })()
              : t("results.empty")}
          </span>
          <span className="masters-empty-cta">
            <button
              className="masters-empty-reset"
              onClick={() => dispatch({ type: ACTIONS.RESET_SEARCH })}
            >
              {t("results.tryChanging")}
            </button>
          </span>
        </div>
      ) : (
        <>
          <div className="masters-grid">
            {visibleMasters.map((master) => (
              <MasterCard
                key={master._id}
                master={master}
                setShowModal={setShowModal}
                isNew={newSet.has(master._id)}
              />
            ))}
          </div>
          {hasMore && (
            <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
          )}
        </>
      )}
    </>
  );
}
