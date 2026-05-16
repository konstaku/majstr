import { Master } from "../schema/master/master.schema";
import { Profession } from "../schema/state/state.schema";
import Avatar from "./Avatar";
import ContactsLayout from "./ContactsLayout";
import { apiFetch } from "../api/client";

type NewMasterPreviewProps = {
  master: Master;
  professions: Profession[];
};

export default function NewMasterPreview({
  master,
  professions,
}: NewMasterPreviewProps) {
  console.log("master:", master);
  const { _id, name, tags, contacts, locationID, professionID } = master;

  return (
    <div className="master-card" id={_id}>
      <div
        className="master-card-body"
        style={{ backgroundColor: "8080ff" + "35" }}
      >
        <div>
          <div className="master-card-header">
            <Avatar img={master.photo} color={"8080ff"} name={name} />
            <div className="bookmark-container">
              <img src="/img/icons/bookmark-passive.svg" alt="" />
            </div>
          </div>
          <div className="master-card-name">{name}</div>
          <div className="master-card-profession">
            {professions?.find((p) => p.id === professionID)?.name.ua}
          </div>
          <div className="mastercard-location">
            <img src="/img/icons/geopin.svg" alt="" />
            {locationID}
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
        <ContactsLayout contacts={contacts} />
      </div>
      <div className="master-card-footer">
        <button
          className="btn admin"
          onClick={() => approveMaster("approve", _id)}
        >
          ✅
        </button>
        <button
          className="btn admin"
          onClick={() => approveMaster("decline", _id)}
        >
          ❌
        </button>
      </div>
    </div>
  );

  async function approveMaster(
    action: "approve" | "decline",
    masterID: string
  ) {
    const masterData = { action, masterID };
    const controller = new AbortController();

    await apiFetch("/approve-master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(masterData),
      signal: controller.signal,
    })
      .then((response) => {
        if (response.ok) {
          return true;
        }
        return Promise.reject(response);
      })
      .catch(console.error);
  }
}
