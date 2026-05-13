import { useContext, useEffect, useState } from "react";
import { MasterContext } from "../context";
import ContactsLayout from "./ContactsLayout";
import { useTranslation } from "../custom-hooks/useTranslation";
import { transliterate } from "../helpers/transliterate";

import type { Master } from "../schema/master/master.schema";
import { Location, Profession } from "../schema/state/state.schema";

type ModalProps = {
  master: Master;
  setShowModal: React.Dispatch<React.SetStateAction<string | null | boolean>>;
};

const LANG_FLAG_MAP: Record<string, string> = {
  uk: "🇺🇦 Ukrainian",
  en: "🇬🇧 English",
  it: "🇮🇹 Italiano",
  pt: "🇵🇹 Português",
  es: "🇪🇸 Español",
  de: "🇩🇪 Deutsch",
  fr: "🇫🇷 Français",
  pl: "🇵🇱 Polski",
};

export default function Modal({ master, setShowModal }: ModalProps) {
  const {
    state: { locations, professions },
  } = useContext(MasterContext);
  const { t, lang } = useTranslation();

  const { _id: id, availability, languages, rating, reviewCount } = master;
  const [copyUrl, setCopyUrl] = useState<string | null>(null);

  const displayName = lang === "uk" ? master.name : transliterate(master.name);

  const profName = lang === "uk"
    ? professions.find((p: Profession) => p.id === master.professionID)?.name.ua
    : professions.find((p: Profession) => p.id === master.professionID)?.name.en;

  const locName = lang === "uk"
    ? locations.find((l: Location) => l.id === master.locationID)?.name.ua
    : locations.find((l: Location) => l.id === master.locationID)?.name.en;

  const modalTags = (lang === "uk" ? master.tags.ua : master.tags.en);

  // Sync URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("card", id);
    window.history.pushState({}, "", `${window.location.pathname}?${params}`);
    return () => {
      const p = new URLSearchParams(window.location.search);
      p.delete("card");
      window.history.pushState({}, "", `${window.location.pathname}`);
    };
  }, [id]);

  async function copyUrlToClipboard() {
    const url = `${import.meta.env.VITE_APP_URL}/?card=${id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyUrl(url);
      setTimeout(() => setCopyUrl(null), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-overlay-inside">
        <div className="modal-content" id="details-modal">

          {/* Terracotta header band */}
          <div className="modal-top-band">
            <div className="modal-top-pattern" />

            <div className="modal-head-row">
              <ModalAvatar photo={master.photo} name={displayName} />
              <div className="modal-title-area">
                <div className="modal-name">{displayName}</div>
                <div className="modal-profession">{profName}</div>
                <div className="modal-location">📍 {locName}</div>
              </div>
              <div className="modal-header-actions">
                <div
                  className={`share-container ${copyUrl ? "confirm" : ""}`}
                  onClick={copyUrlToClipboard}
                  title="Share"
                >
                  <img src={`/img/icons/${copyUrl ? "ok" : "share"}.svg`} alt="share" />
                </div>
                <div
                  className="close-container"
                  onClick={() => setShowModal(null)}
                  title="Close"
                >
                  <img src="/img/icons/close.svg" alt="close" />
                </div>
              </div>
            </div>

            {/* Rating row */}
            {rating != null && reviewCount != null && (
              <div style={{ position: "relative", zIndex: 1, marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#fcd34d", fontSize: 14 }}>{"★".repeat(Math.round(rating))}</span>
                <span style={{ color: "rgba(255,255,255,0.9)", fontWeight: 800, fontSize: 15 }}>{rating.toFixed(1)}</span>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }}>({reviewCount} reviews)</span>
              </div>
            )}

            {/* Availability badge */}
            {availability && (
              <div className="modal-avail">
                <div className="modal-avail-dot" />
                {t(`availability.${availability}`)}
              </div>
            )}
          </div>

          {/* Modal body */}
          <div className="modal-body">

            {/* Languages */}
            {languages && languages.length > 0 && (
              <>
                <div className="modal-section-title">{t("modal.languages")}</div>
                <div className="modal-langs">
                  {languages.map((code) => (
                    <div key={code} className="modal-lang-badge">
                      {LANG_FLAG_MAP[code] ?? code.toUpperCase()}
                    </div>
                  ))}
                </div>
                <div className="modal-divider" />
              </>
            )}

            {/* About */}
            <div className="modal-section-title">{t("modal.about")}</div>
            <p className="modal-bio">
              {master.about ? master.about : t("modal.noAbout")}
            </p>

            {/* Skills / tags */}
            {modalTags.length > 0 && (
              <>
                <div className="modal-section-title">{t("modal.skills")}</div>
                <div className="modal-tags">
                  {modalTags.map((tag, i) => (
                    <span key={i} className="modal-tag">{tag}</span>
                  ))}
                </div>
              </>
            )}

            <div className="modal-divider" />

            {/* Contacts */}
            <div className="modal-section-title">{t("modal.contact")}</div>
            <ContactsLayout contacts={master.contacts} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ModalAvatar({ photo, name }: { photo: string | null; name: string }) {
  if (photo) {
    return (
      <div
        className="modal-avatar"
        style={{ backgroundImage: `url(${photo})` }}
      />
    );
  }
  return (
    <div className="modal-avatar">
      {name ? name[0].toUpperCase() : "?"}
    </div>
  );
}
