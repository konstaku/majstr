import { useContext, useMemo, useRef } from "react";
import { MasterContext } from "../context";
import { colorPalette } from "../data/colors";
import Avatar from "./Avatar";
import { useTranslation } from "../custom-hooks/useTranslation";
import { transliterate } from "../helpers/transliterate";

import type { Master } from "../schema/master/master.schema";
import { Location, Profession } from "../schema/state/state.schema";

type MasterCardProps = {
  master: Master;
  setShowModal: (show: string) => void;
};

export default function MasterCard({ master, setShowModal }: MasterCardProps) {
  const {
    state: { locations, professions },
  } = useContext(MasterContext);
  const { t, lang } = useTranslation();

  const { _id, name, professionID, locationID, tags } = master;
  const displayName = lang === "uk" ? name : transliterate(name);

  // Null if no photo. Used for conditional rendering of avatar or first lettar of the name
  const photoRef = useRef(master.photo);

  const randomAvatarColor = useMemo(() => {
    // I am using last two digits of an ID to derive a pseudorandom color for a card
    const seed = parseInt(_id.slice(-2), 16) % colorPalette.length;
    return colorPalette[seed];
  }, [_id]);

  return (
    <>
      <div className="master-card" id={_id} onClick={() => setShowModal(_id)} style={{ cursor: "pointer" }}>
        <div
          className="master-card-body"
          style={{ backgroundColor: randomAvatarColor + "35" }}
        >
          <div>
            <div className="master-card-header">
              <Avatar
                img={photoRef.current}
                color={randomAvatarColor}
                name={displayName}
              />
              <div className="bookmark-container">
                <img src="/img/icons/bookmark-passive.svg" alt="" />
              </div>
            </div>
            <div className="master-card-name">{displayName}</div>
            <div className="master-card-profession">
              {lang === "uk"
                ? professions.find((p: Profession) => p.id === professionID)?.name.ua
                : professions.find((p: Profession) => p.id === professionID)?.name.en}
            </div>
            <div className="mastercard-location">
              <img src="/img/icons/geopin.svg" alt="" />
              {lang === "uk"
                ? locations.find((l: Location) => l.id === locationID)?.name.ua
                : locations.find((l: Location) => l.id === locationID)?.name.en}
            </div>
          </div>
          <div className="mastercard-tag-container">
            {(lang === "uk" ? tags.ua : tags.en)
              .sort((a, b) => a.length - b.length)
              .map((tag, index) => (
                <div key={index} className="mastercard-tag">
                  {tag}
                </div>
              ))}
          </div>
        </div>
        <div className="master-card-footer">
          <button className="btn" onClick={(e) => { e.stopPropagation(); setShowModal(_id); }}>
            {t("masterCard.details")}
          </button>
        </div>
      </div>
    </>
  );
}
