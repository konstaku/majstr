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
  badge?: string;
};

const LANG_LABELS: Record<string, string> = {
  uk: "UA", en: "EN", it: "IT", pt: "PT",
  es: "ES", de: "DE", fr: "FR", pl: "PL",
};

function getCreatedMonth(id: string): string {
  const ms = parseInt(id.slice(0, 8), 16) * 1000;
  return new Date(ms).toLocaleDateString("en", { month: "long", year: "numeric" });
}

function renderStars(rating: number): string {
  const filled = Math.round(rating);
  return "★".repeat(filled) + "☆".repeat(5 - filled);
}

export default function MasterCard({ master, setShowModal, variant = "cream", badge }: MasterCardProps) {
  const {
    state: { locations, professions },
  } = useContext(MasterContext);
  const { t, lang } = useTranslation();

  const { _id, name, professionID, locationID, availability, languages, rating, reviewCount, countryID, photo } = master;

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
            {badge && <span className="card-badge">{badge}</span>}
          </div>
        </div>
      </div>

      {/* Bottom row: signal or rating + OPEN */}
      <div className="card-bottom-row">
        {hasRating ? (
          <>
            <div className="card-rating-num">{rating!.toFixed(1)}</div>
            <div className="card-rating-detail">
              <div className="card-stars-row">{renderStars(rating!)}</div>
              <div className="card-review-count">
                {reviewCount} {lang === "uk" ? "відгуків" : "reviews"}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="card-signal-icon">
              {photo ? "✓" : "◎"}
            </div>
            <div className="card-signal-text">
              <div className="card-signal-primary">
                {photo ? t("masterCard.verified") : t("masterCard.memberSince")}
              </div>
              {!photo && (
                <div className="card-signal-secondary">{getCreatedMonth(_id)}</div>
              )}
            </div>
          </>
        )}
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
