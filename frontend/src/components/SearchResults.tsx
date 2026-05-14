import { useContext } from "react";
import { Link } from "react-router-dom";
import { MasterContext } from "../context";
import MasterCard from "./MasterCard";
import QuoteCard from "./QuoteCard";
import { useTranslation } from "../custom-hooks/useTranslation";
import { ACTIONS } from "../data/actions";

import type { Master } from "../schema/master/master.schema";
import type { Profession } from "../schema/state/state.schema";

const VARIANTS = ["cream", "ink", "terra"] as const;

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

function buildBadgeMap(allCountryMasters: Master[], newThisWeekLabel: string, recentlyAddedLabel: string): Map<string, string> {
  const weekStart = getWeekStart();
  const sorted = [...allCountryMasters].sort((a, b) => getCreatedMs(b._id) - getCreatedMs(a._id));
  const thisWeek = sorted.filter(m => getCreatedMs(m._id) >= weekStart);
  const map = new Map<string, string>();

  if (thisWeek.length >= 2) {
    thisWeek.forEach(m => map.set(m._id, newThisWeekLabel));
  } else {
    sorted.slice(0, 4).forEach(m => map.set(m._id, recentlyAddedLabel));
  }
  return map;
}

export default function SearchResults({
  masters,
  city,
  professionCategory,
  setShowModal,
}: SearchResultsProps) {
  const {
    state: { professions, countryID },
    dispatch,
  } = useContext(MasterContext);
  const { t } = useTranslation();

  const availableProfessionIDs = professions
    .filter((p: Profession) => (!professionCategory ? true : p.categoryID === professionCategory))
    .map((p: Profession) => p.id);

  const filteredMasters = masters.filter(
    (m) =>
      m.countryID === countryID &&
      m.locationID.includes(city) &&
      availableProfessionIDs.includes(m.professionID)
  );

  const countryMasters = masters.filter(m => m.countryID === countryID);
  const badgeMap = buildBadgeMap(countryMasters, t("badge.newThisWeek"), t("badge.recentlyAdded"));

  const hasActiveFilter = city !== "" || professionCategory !== "";

  // Show QuoteCard on mobile (2+ results) and on 3-col desktop (5+ results)
  const showQuote = filteredMasters.length >= 2;
  const showQuoteDesktop = filteredMasters.length >= 5;

  function quoteVariantIndex(i: number): number {
    if (!showQuote || i < 2) return i % 3;
    if (showQuoteDesktop && i >= 4) return (i + 2) % 3;
    return (i + 1) % 3;
  }

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
        <div className="search-empty-state">
          <p>{t("results.empty")}</p>
          <p>{t("results.tryChanging")}</p>
          <div className="empty-state-actions">
            {hasActiveFilter && (
              <button
                className="empty-state-btn"
                onClick={() => dispatch({ type: ACTIONS.RESET_SEARCH })}
              >
                {t("browse.allCategories")} →
              </button>
            )}
            <Link to="/add" className="empty-state-btn empty-state-btn-secondary">
              {t("nav.addMaster")} →
            </Link>
          </div>
        </div>
      ) : (
        <div className="masters-grid">
          {filteredMasters.map((master, i) => {
            const cards = [];

            cards.push(
              <MasterCard
                key={master._id}
                master={master}
                setShowModal={setShowModal}
                variant={VARIANTS[quoteVariantIndex(i)]}
                badge={badgeMap.get(master._id)}
              />
            );

            // Inject after 2nd master card: mobile always, desktop only at 5+ results
            if (showQuote && i === 1) {
              cards.push(
                <QuoteCard
                  key="quote-card"
                  variant="terra"
                  showOnDesktop={showQuoteDesktop}
                />
              );
            }

            return cards;
          })}
        </div>
      )}
    </>
  );
}
