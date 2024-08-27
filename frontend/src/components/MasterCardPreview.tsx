import Avatar from "./Avatar";
import { useContext } from "react";
import { MasterContext } from "../context";
import { MasterPreviewType } from "../types";

type MasterCardPreviewProps = {
  className?: string;
  masterPreview: MasterPreviewType;
};

export default function MasterCardPreview({
  masterPreview,
}: MasterCardPreviewProps) {
  const { photo, watcher } = masterPreview;
  const { name, locationID, professionID, tags, useThisPhoto } = watcher;
  const {
    state: { locations, professions },
  } = useContext(MasterContext);

  return (
    <>
      <div className="master-card preview">
        <div
          className="master-card-body"
          style={{ backgroundColor: "#F3AB4735" }}
        >
          <div>
            <div className="master-card-header">
              <Avatar
                img={useThisPhoto ? photo : null}
                color="#F3AB47"
                name={name}
              />
              <div className="bookmark-container">
                <img src="/img/icons/bookmark-passive.svg" alt="" />
              </div>
            </div>
            <div className="master-card-name">{name}</div>
            <div className="master-card-profession">
              {professionID
                ? professions.find((p) => p.id === professionID)?.name.ua
                : "Професія невідома"}
            </div>
            <div className="mastercard-location">
              <img src="/img/icons/geopin.svg" alt="" />
              {locationID
                ? locations.find((l) => l.id === locationID)?.name.ua
                : "Локація невідома"}
            </div>
          </div>
          <div className="mastercard-tag-container">
            {!!tags?.length &&
              tags
                .sort((a, b) => a.value.length - b.value.length)
                .map((tag, index) => (
                  <div key={index} className="mastercard-tag">
                    {tag.value.toLowerCase()}
                  </div>
                ))}
          </div>
        </div>
        <div className="master-card-footer">
          <button className="btn" /* onClick={() => setShowModal(_id)} */>
            Детальніше
          </button>
        </div>
      </div>
    </>
  );
}
