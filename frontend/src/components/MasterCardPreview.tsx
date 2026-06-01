import Avatar from "./Avatar";
import { useContext } from "react";
import { MasterContext } from "../context";
import { MasterPreviewType } from "../schema/form/form.schema";
import { Location, Profession } from "../schema/state/state.schema";
import { localizedName } from "../i18n/lang";

type MasterCardPreviewProps = {
  className?: string;
  masterPreview: MasterPreviewType;
};

export default function MasterCardPreview({ masterPreview }: MasterCardPreviewProps) {
  const { photo, watcher } = masterPreview;
  const { name, locationID, professionID, tags, useThisPhoto } = watcher;
  const {
    state: { locations, professions, lang },
  } = useContext(MasterContext);

  const profName = professionID
    ? localizedName(
        professions.find((p: Profession) => p.id === professionID)?.name,
        lang
      )
    : "";

  const locName = locationID
    ? localizedName(
        locations.find((l: Location) => l.id === locationID)?.name,
        lang
      )
    : "";

  const previewTags = Array.isArray(tags)
    ? tags.sort((a, b) => a.value.length - b.value.length).slice(0, 4)
    : [];

  return (
    <div className="card-with-strip master-card preview">
      <div className="card-left-strip" />
      <div className="card-inner">
        <div className="card-top">
          <div className="card-avatar-wrapper">
            <Avatar
              img={useThisPhoto ? photo : null}
              name={name || "?"}
              seed={name || "preview"}
            />
          </div>
          <div className="card-info">
            <div className="card-name">{name || "Ваше ім'я"}</div>
            <div className="card-profession">{profName}</div>
            <div className="card-location">📍 {locName}</div>
          </div>
        </div>

        {previewTags.length > 0 && (
          <div className="tags">
            {previewTags.map((tag, i) => (
              <span key={i} className="tag">{tag.value.toLowerCase()}</span>
            ))}
          </div>
        )}

        <div className="card-footer">
          <div />
          <button className="details-btn" disabled>Детальніше</button>
        </div>
      </div>
    </div>
  );
}
