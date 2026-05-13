import { useContext, useEffect, useMemo, useState } from "react";
import Avatar from "./Avatar";
import { MasterContext } from "../context";
import ContactsLayout from "./ContactsLayout";
import { colorPalette } from "../data/colors";
import { useTranslation } from "../custom-hooks/useTranslation";
import { transliterate } from "../helpers/transliterate";

import type { Master } from "../schema/master/master.schema";
import { Location, Profession } from "../schema/state/state.schema";

type ModalProps = {
  master: Master;
  setShowModal: React.Dispatch<React.SetStateAction<string | null | boolean>>;
};

export default function Modal({ master, setShowModal }: ModalProps) {
  const {
    state: { locations, professions },
  } = useContext(MasterContext);
  const { t, lang } = useTranslation();

  const { _id: id } = master;
  const [copyUrl, setCopyUrl] = useState<string | null>(null);
  const displayName = lang === "uk" ? master.name : transliterate(master.name);

  // I am using last two digits of an ID to derive a pseudorandom color for a card
  const randomAvatarColor = useMemo(() => {
    const seed = parseInt(id.slice(-2), 16) % colorPalette.length;
    return colorPalette[seed];
  }, [id]);

  // Add card ID to address string, remove at unmount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("card", id);
    window.history.pushState({}, "", `${window.location.pathname}?${params}`);

    return () => {
      const params = new URLSearchParams(window.location.search);
      params.delete("card");
      window.history.pushState({}, "", `${window.location.pathname}`);
    };
  }, [id]);

  async function copyUrlToClipboard(id: string) {
    const url = `${import.meta.env.VITE_APP_URL}/?card=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyUrl(url);
      setTimeout(() => setCopyUrl(null), 2000);
    } catch (err) {
      console.error("Failed to copy text to clipboard", err);
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-overlay-inside">
        <div className="modal-content" id="details-modal">
          <div
            className="master-card-body modal"
            style={{ backgroundColor: randomAvatarColor + "35" }}
          >
            <div>
              <div className="master-card-header">
                <Avatar
                  img={master.photo}
                  color={randomAvatarColor}
                  name={displayName}
                />
                <div className="share-close-container">
                  <div
                    className={`share-container ${copyUrl && "confirm"}`}
                    onClick={() => copyUrlToClipboard(id)}
                  >
                    <img
                      src={`/img/icons/${copyUrl ? "ok" : "share"}.svg`}
                      alt="share"
                    />
                  </div>
                  <div
                    className="close-container"
                    onClick={() => setShowModal(null)}
                  >
                    <img src="/img/icons/close.svg" alt="close" />
                  </div>
                </div>
              </div>
              <div className="master-card-name">{displayName}</div>
              <div className="master-card-profession">
                {lang === "uk"
                  ? professions.find((p: Profession) => p.id === master.professionID)?.name.ua
                  : professions.find((p: Profession) => p.id === master.professionID)?.name.en}
              </div>
              <div className="mastercard-location">
                <img src="/img/icons/geopin.svg" alt="" />
                {lang === "uk"
                  ? locations.find((l: Location) => l.id === master.locationID)?.name.ua
                  : locations.find((l: Location) => l.id === master.locationID)?.name.en}
              </div>
              <div className="mastercard-about">
                <pre className="about-pre">
                  {master.about ? master.about : t("modal.noAbout")}
                </pre>
              </div>
            </div>
            <ContactsLayout contacts={master.contacts} />
          </div>
        </div>
      </div>
    </div>
  );
}
