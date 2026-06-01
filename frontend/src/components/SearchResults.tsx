import { useContext } from "react";
import { Link } from "react-router-dom";
import { MasterContext } from "../context";
import MasterCard from "./MasterCard";
import { useTranslation } from "../custom-hooks/useTranslation";
import { ACTIONS } from "../data/actions";

import type { Master } from "../schema/master/master.schema";
import type { Profession } from "../schema/state/state.schema";

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
          {filteredMasters.map((master) => (
            <MasterCard
              key={master._id}
              master={master}
              setShowModal={setShowModal}
              isNew={newSet.has(master._id)}
            />
          ))}
        </div>
      )}
    </>
  );
}
