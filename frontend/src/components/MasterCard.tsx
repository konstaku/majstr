import { useContext } from "react";
import { MasterContext } from "../context";
import { useTranslation } from "../custom-hooks/useTranslation";
import { localizedName } from "../i18n/lang";
import { transliterate } from "../helpers/transliterate";
import Sigil from "./Sigil";

import type { Master } from "../schema/master/master.schema";
import { Location, Profession } from "../schema/state/state.schema";

type MasterCardProps = {
  master: Master;
  setShowModal: (show: string) => void;
  /** SearchResults computes this — newest-in-dataset signal. */
  isNew?: boolean;
};

const LANG_LABELS: Record<string, string> = {
  uk: "UA", en: "EN", it: "IT", pt: "PT",
  es: "ES", de: "DE", fr: "FR", pl: "PL",
};

/** Mongo ObjectId → 4-digit creation year (first 4 hex bytes = unix seconds). */
function getCreatedYear(id: string): number {
  return new Date(parseInt(id.slice(0, 8), 16) * 1000).getFullYear();
}

export default function MasterCard({ master, setShowModal, isNew }: MasterCardProps) {
  const {
    state: { locations, professions, lang },
  } = useContext(MasterContext);
  const { t } = useTranslation();

  const { _id, name, professionID, locationID, languages, countryID, photo, tags } = master;

  const displayName = lang === "uk" ? name : transliterate(name);
  // Owner-verified by a moderator (claim flow) — not merely "has a photo".
  const isVerified = !!master.verified;

  const profName = localizedName(
    professions.find((p: Profession) => p.id === professionID)?.name,
    lang,
  );
  const locName = localizedName(
    locations.find((l: Location) => l.id === locationID)?.name,
    lang,
  );

  const displayLangs = (languages && languages.length > 0)
    ? languages
    : countryID === "IT" ? ["uk", "it"]
    : countryID === "PT" ? ["uk", "pt"]
    : ["uk"];

  // Verified beats new — a master who is both shows only VERIFIED.
  const statusBadge: "verified" | "new" | null =
    isVerified ? "verified" : isNew ? "new" : null;

  // Tags from the master's preferred language. Fall back to ua, then en.
  const tagList = (lang === "uk" ? tags?.ua : tags?.en) ?? tags?.ua ?? tags?.en ?? [];
  const tagDisplay = tagList.slice(0, 4).join(" · ");

  const year = getCreatedYear(_id);

  return (
    <article
      className="master-card master-card--list"
      id={_id}
      onClick={() => setShowModal(_id)}
    >
      <div className="master-card__sigil-cell">
        {photo ? (
          <>
            <div
              className="master-card__photo"
              style={{ backgroundImage: `url(${photo})` }}
            />
            <div className="master-card__photo-overlay" />
          </>
        ) : (
          <Sigil seed={_id} size={3} />
        )}
      </div>

      <div className="master-card__body">
        <div className="master-card__body-inner">
          <h3 className="master-card__name" title={displayName}>
            {displayName}
          </h3>
          <div className="master-card__meta">
            <span>{profName}</span>
            {locName && (
              <>
                {" "}<span className="master-card__sep">·</span>{" "}
                <span className="master-card__city">{locName}</span>
              </>
            )}
          </div>

          <div className="master-card__badges">
            {displayLangs.slice(0, 3).map((code) => (
              <span key={code} className="master-card__badge">
                {LANG_LABELS[code] ?? code.toUpperCase()}
              </span>
            ))}
            {statusBadge === "verified" && (
              <span
                className="master-card__badge master-card__badge--status master-card__badge--verified"
                title={t("masterCard.verified")}
              >
                VERIFIED
              </span>
            )}
            {statusBadge === "new" && (
              <span className="master-card__badge master-card__badge--status master-card__badge--new">
                NEW
              </span>
            )}
          </div>

          {tagDisplay && (
            <div className="master-card__tags">{tagDisplay}</div>
          )}
        </div>

        <div className="master-card__strip">
          <span className="master-card__member-since">
            {t("masterCard.memberSince")}{" "}
            <span className="master-card__year">{year}</span>
          </span>
          <button
            className="master-card__cta"
            onClick={(e) => { e.stopPropagation(); setShowModal(_id); }}
          >
            {t("masterCard.details")} →
          </button>
        </div>
      </div>
    </article>
  );
}
