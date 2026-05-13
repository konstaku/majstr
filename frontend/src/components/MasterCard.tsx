import { useContext, useMemo, useRef } from "react";
import { MasterContext } from "../context";
import Avatar from "./Avatar";
import { useTranslation } from "../custom-hooks/useTranslation";
import { transliterate } from "../helpers/transliterate";

import type { Master } from "../schema/master/master.schema";
import { Location, Profession } from "../schema/state/state.schema";

type MasterCardProps = {
  master: Master;
  setShowModal: (show: string) => void;
};

const LANG_FLAG_MAP: Record<string, string> = {
  uk: "🇺🇦 UA",
  en: "🇬🇧 EN",
  it: "🇮🇹 IT",
  pt: "🇵🇹 PT",
  es: "🇪🇸 ES",
  de: "🇩🇪 DE",
  fr: "🇫🇷 FR",
  pl: "🇵🇱 PL",
};

export default function MasterCard({ master, setShowModal }: MasterCardProps) {
  const {
    state: { locations, professions },
  } = useContext(MasterContext);
  const { t, lang } = useTranslation();

  const { _id, name, professionID, locationID, tags, availability, languages, rating, reviewCount } = master;

  const photoRef = useRef(master.photo);
  const displayName = lang === "uk" ? name : transliterate(name);

  // derive avatar color from last 2 hex digits of ID
  const avatarColor = useMemo(() => {
    const colors = ["#c84b31", "#5a7a5c", "#c9a84c", "#4a7fb5", "#7b5ea7"];
    const seed = parseInt(_id.slice(-2), 16) % colors.length;
    return colors[seed];
  }, [_id]);

  const profName = lang === "uk"
    ? professions.find((p: Profession) => p.id === professionID)?.name.ua
    : professions.find((p: Profession) => p.id === professionID)?.name.en;

  const locName = lang === "uk"
    ? locations.find((l: Location) => l.id === locationID)?.name.ua
    : locations.find((l: Location) => l.id === locationID)?.name.en;

  const cardTags = (lang === "uk" ? tags.ua : tags.en)
    .sort((a, b) => a.length - b.length)
    .slice(0, 4);

  const availClass =
    availability === "available" ? "" :
    availability === "next_week" ? "amber-text" : "red-text";

  return (
    <div
      className="card-with-strip"
      id={_id}
      onClick={() => setShowModal(_id)}
    >
      <div className="card-left-strip" />
      <div className="card-inner">
        <div className="card-top">
          <div className="card-avatar-wrapper">
            <Avatar img={photoRef.current} color={avatarColor} name={displayName} />
            {availability && (
              <span
                className={`avail-dot ${
                  availability === "available" ? "green" :
                  availability === "next_week" ? "amber" : "red"
                }`}
              />
            )}
          </div>
          <div className="card-info">
            <div className="card-name" title={displayName}>{displayName}</div>
            <div className="card-profession">{profName}</div>
            <div className="card-location">📍 {locName}</div>
          </div>
        </div>

        {availability && (
          <div className={`avail-status ${availClass}`}>
            {t(`availability.${availability}`)}
          </div>
        )}

        {languages && languages.length > 0 && (
          <div className="lang-badges">
            {languages.map((code) => (
              <span key={code} className="lang-badge">
                {LANG_FLAG_MAP[code] ?? code.toUpperCase()}
              </span>
            ))}
          </div>
        )}

        {cardTags.length > 0 && (
          <div className="tags">
            {cardTags.map((tag, i) => (
              <span key={i} className="tag">{tag}</span>
            ))}
          </div>
        )}

        <div className="card-footer">
          {rating != null && reviewCount != null ? (
            <div className="card-stars">
              <span className="star">★</span>
              <span className="star-rating">{rating.toFixed(1)}</span>
              <span className="star-count">({reviewCount})</span>
            </div>
          ) : (
            <div />
          )}
          <button
            className="details-btn"
            onClick={(e) => { e.stopPropagation(); setShowModal(_id); }}
          >
            {t("masterCard.details")}
          </button>
        </div>
      </div>
    </div>
  );
}
