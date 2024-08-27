import { useContext, useMemo, useRef } from "react";
import Avatar from "./Avatar";
import { MasterContext } from "../context";

import type { Master } from "../schema/master/master.type";
import { colorPalette } from "../data/colors";

type MasterCardProps = {
  master: Master;
  setShowModal: (show: string) => void;
};

export default function MasterCard({ master, setShowModal }: MasterCardProps) {
  const {
    state: { locations, professions },
  } = useContext(MasterContext);

  const { _id, name, professionID, locationID, tags } = master;

  // Null if no photo. Used for conditional rendering of avatar or first lettar of the name
  const photoRef = useRef(master.photo);

  const randomAvatarColor = useMemo(() => {
    // I am using last two digits of an ID to derive a pseudorandom color for a card
    const seed = parseInt(_id.slice(-2), 16) % colorPalette.length;
    return colorPalette[seed];
  }, [_id]);

  return (
    <>
      <div className="master-card" id={_id}>
        <div
          className="master-card-body"
          style={{ backgroundColor: randomAvatarColor + "35" }}
        >
          <div>
            <div className="master-card-header">
              <Avatar
                img={photoRef.current}
                color={randomAvatarColor}
                name={name}
              />
              <div className="bookmark-container">
                <img src="/img/icons/bookmark-passive.svg" alt="" />
              </div>
            </div>
            <div className="master-card-name">{name}</div>
            <div className="master-card-profession">
              {professions.find((p) => p.id === professionID)?.name.ua}
            </div>
            <div className="mastercard-location">
              <img src="/img/icons/geopin.svg" alt="" />
              {locations.find((l) => l.id === locationID)?.name.ua}
            </div>
          </div>
          <div className="mastercard-tag-container">
            {tags.ua
              .sort((a, b) => a.length - b.length)
              .map((tag, index) => (
                <div key={index} className="mastercard-tag">
                  {tag}
                </div>
              ))}
          </div>
        </div>
        <div className="master-card-footer">
          <button className="btn" onClick={() => setShowModal(_id)}>
            Детальніше
          </button>
        </div>
      </div>
    </>
  );
}
