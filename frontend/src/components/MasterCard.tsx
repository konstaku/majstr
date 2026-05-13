import { useContext, useMemo, useRef } from "react";
import { MasterContext } from "../context";
import { useTranslation } from "../custom-hooks/useTranslation";
import { transliterate } from "../helpers/transliterate";

import type { Master } from "../schema/master/master.schema";
import { Location, Profession } from "../schema/state/state.schema";

type CardVariant = "cream" | "ink" | "terra";

type MasterCardProps = {
  master: Master;
  setShowModal: (show: string) => void;
  variant?: CardVariant;
};

const LANG_LABELS: Record<string, string> = {
  uk: "UA", en: "EN", it: "IT", pt: "PT",
  es: "ES", de: "DE", fr: "FR", pl: "PL",
};

export default function MasterCard({ master, setShowModal, variant = "cream" }: MasterCardProps) {
  const {
    state: { locations, professions },
  } = useContext(MasterContext);
  const { t, lang } = useTranslation();

  const { _id, name, professionID, locationID, availability, languages, rating, reviewCount, countryID } = master;

  const photoRef = useRef(master.photo);
  const displayName = lang === "uk" ? name : transliterate(name);

  const hue = useMemo(() => {
    return (parseInt(_id.slice(-4), 16) % 360);
  }, [_id]);

  const profName = lang === "uk"
    ? professions.find((p: Profession) => p.id === professionID)?.name.ua
    : professions.find((p: Profession) => p.id === professionID)?.name.en;

  const locName = lang === "uk"
    ? locations.find((l: Location) => l.id === locationID)?.name.ua
    : locations.find((l: Location) => l.id === locationID)?.name.en;

  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const hasRating = rating != null && reviewCount != null && reviewCount > 0;

  const displayLangs = (languages && languages.length > 0)
    ? languages
    : countryID === "IT" ? ["uk", "it"]
    : countryID === "PT" ? ["uk", "pt"]
    : ["uk"];

  return (
    <article
      className={`master-card variant-${variant}`}
      id={_id}
      onClick={() => setShowModal(_id)}
    >
      {/* Top row: photo + identity */}
      <div className="card-top-row">
        <div
          className="card-photo-block"
          style={{
            background: photoRef.current
              ? undefined
              : `linear-gradient(135deg, hsl(${hue},45%,52%), hsl(${hue},52%,32%))`,
          }}
        >
          {photoRef.current ? (
            <div
              className="card-avatar"
              style={{ backgroundImage: `url(${photoRef.current})` }}
            />
          ) : (
            initials
          )}
          {availability && (
            <span
              className={`card-avail-dot ${
                availability === "available" ? "green" :
                availability === "next_week" ? "amber" : "red"
              }`}
            />
          )}
        </div>

        <div className="card-identity">
          <div>
            <div className="card-name" title={displayName}>{displayName}</div>
            <div className="card-meta">{profName} · {locName?.toUpperCase()}</div>
          </div>
          <div className="card-lang-row">
            {displayLangs.slice(0, 3).map((code) => (
              <span key={code} className="card-lang-badge">
                {LANG_LABELS[code] ?? code.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row: rating + OPEN */}
      <div className="card-bottom-row">
        <div className={`card-rating-num${!hasRating ? " card-rating-none" : ""}`}>
          {hasRating ? rating!.toFixed(1) : "—"}
        </div>
        <div className="card-rating-detail">
          <div className="card-stars-row">★★★★★</div>
          <div className="card-review-count">
            {hasRating
              ? `${reviewCount} ${lang === "uk" ? "відгуків" : "reviews"}`
              : t("masterCard.noReviews")}
          </div>
        </div>
        <button
          className="card-open-btn"
          onClick={(e) => { e.stopPropagation(); setShowModal(_id); }}
        >
          {t("masterCard.details")} →
        </button>
      </div>
    </article>
  );
}
