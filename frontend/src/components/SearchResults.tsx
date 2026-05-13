import { useContext } from "react";
import { MasterContext } from "../context";
import MasterCard from "./MasterCard";
import { useTranslation } from "../custom-hooks/useTranslation";

import type { Master } from "../schema/master/master.schema";
import type { Profession } from "../schema/state/state.schema";

type SearchResultsProps = {
  masters: Master[];
  city: string;
  professionCategory: string;
  setShowModal: (show: string) => void;
};

export default function SearchResults({
  masters,
  city,
  professionCategory,
  setShowModal,
}: SearchResultsProps) {
  const {
    state: { professions, countryID },
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

  return (
    <>
      <div className="results-top">
        <div className="search-results-header">
          <h2>{t("results.found")}</h2>
          <span className="found-amount">{filteredMasters.length}</span>
        </div>
      </div>

      {filteredMasters.length === 0 ? (
        <div className="search-empty-state">
          <p>{t("results.empty")}</p>
          <p>{t("results.tryChanging")}</p>
        </div>
      ) : (
        <div className="masters-grid">
          {filteredMasters.map((master) => (
            <MasterCard key={master._id} master={master} setShowModal={setShowModal} />
          ))}
        </div>
      )}
    </>
  );
}
