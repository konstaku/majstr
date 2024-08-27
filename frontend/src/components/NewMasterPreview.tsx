import { Master } from "../schema/master/master.type";
import { Profession } from "../schema/state/state.type";
import Avatar from "./Avatar";
import ContactsLayout from "./ContactsLayout";

type NewMasterPreviewProps = {
  master: Master;
  token: string;
  professions: Profession[];
};

export default function NewMasterPreview({
  master,
  token,
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
          onClick={() => approveMaster("approve", _id, token)}
        >
          ✅
        </button>
        <button
          className="btn admin"
          onClick={() => approveMaster("decline", _id, token)}
        >
          ❌
        </button>
      </div>
    </div>
  );

  async function approveMaster(
    action: "approve" | "decline",
    masterID: string,
    token: string
  ) {
    const masterData = {
      action,
      masterID,
      token,
    };

    const controller = new AbortController();

    await fetch("https://api.majstr.com/approve-master", {
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
