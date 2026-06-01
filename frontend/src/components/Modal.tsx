import { useContext, useEffect, useMemo } from "react";
import { MasterContext } from "../context";
import { useTranslation } from "../custom-hooks/useTranslation";
import { localizedName } from "../i18n/lang";
import { transliterate } from "../helpers/transliterate";
import Sigil from "./Sigil";

import type { Master, Contacts } from "../schema/master/master.schema";
import { Location, Profession } from "../schema/state/state.schema";

type ModalProps = {
  master: Master;
  setShowModal: React.Dispatch<React.SetStateAction<string | null | boolean>>;
};

const LANG_LABELS: Record<string, string> = {
  uk: "UA", en: "EN", it: "IT", pt: "PT",
  es: "ES", de: "DE", fr: "FR", pl: "PL", ru: "RU",
};

type ContactMeta = {
  label: string;
  href: (v: string) => string;
  display: (v: string) => string;
};

const CONTACT_META: Record<string, ContactMeta> = {
  whatsapp: {
    label: "WhatsApp",
    href: (v) => `https://wa.me/${v.replace(/\D/g, "")}`,
    display: (v) => v,
  },
  telegram: {
    label: "Telegram",
    href: (v) => `https://t.me/${v.replace(/^@/, "")}`,
    display: (v) => (v.startsWith("@") ? v : `@${v}`),
  },
  instagram: {
    label: "Instagram",
    href: (v) => `https://www.instagram.com/${v.replace(/^@/, "")}/`,
    display: (v) => (v.startsWith("@") ? v : `@${v}`),
  },
  facebook: {
    label: "Facebook",
    href: (v) => (v.startsWith("http") ? v : `https://facebook.com/${v}`),
    display: (v) => v.replace(/^https?:\/\/(www\.)?facebook\.com\//, ""),
  },
  phone: {
    label: "Phone",
    href: (v) => `tel:${v.replace(/\s/g, "")}`,
    display: (v) => v,
  },
  email: {
    label: "Email",
    href: (v) => `mailto:${v}`,
    display: (v) => v,
  },
};

function getContactMeta(type: string): ContactMeta {
  return CONTACT_META[type.toLowerCase()] ?? {
    label: type,
    href: (v) => v,
    display: (v) => v,
  };
}

/** Registration ordinal — index in `_id`-sorted masters list, 1-based. */
function formatRegCode(masterId: string, allMasters: Master[]): string {
  const idx = allMasters
    .slice()
    .sort((a, b) => a._id.localeCompare(b._id))
    .findIndex((m) => m._id === masterId);
  const n = idx + 1;
  return n < 10 ? `0${n}` : `${n}`;
}

export default function Modal({ master, setShowModal }: ModalProps) {
  const {
    state: { locations, professions, masters },
  } = useContext(MasterContext);
  const { t, lang } = useTranslation();

  const { _id: id, languages, contacts, about, photo, countryID } = master;

  // Mirror MasterCard's fallback so modal always shows language badges.
  const displayLangs = (languages && languages.length > 0)
    ? languages
    : countryID === "IT" ? ["uk", "it"]
    : countryID === "PT" ? ["uk", "pt"]
    : ["uk"];

  const displayName = lang === "uk" ? master.name : transliterate(master.name);

  const profName = localizedName(
    professions.find((p: Profession) => p.id === master.professionID)?.name,
    lang
  );

  const locName = localizedName(
    locations.find((l: Location) => l.id === master.locationID)?.name,
    lang
  );

  const modalTags = (lang === "uk" ? master.tags?.ua : master.tags?.en) ?? [];

  const regCode = useMemo(
    () => formatRegCode(id, masters),
    [id, masters]
  );

  const primaryContact: Contacts | undefined = contacts[0];
  const primaryMeta = primaryContact ? getContactMeta(primaryContact.contactType) : null;
  const primaryHref = primaryContact && primaryMeta ? primaryMeta.href(primaryContact.value) : "#";
  const primaryIsPhone = primaryContact?.contactType.toLowerCase() === "phone";
  const ctaText = primaryIsPhone
    ? "Call"
    : primaryMeta
      ? `Message on ${primaryMeta.label}`
      : "";

  const useTwoColContacts = contacts.length >= 4;

  // Sync URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("card", id);
    window.history.pushState({}, "", `${window.location.pathname}?${params}`);
    return () => {
      window.history.pushState({}, "", `${window.location.pathname}`);
    };
  }, [id]);

  return (
    <div className="modal-overlay">
      <div className="modal-overlay-inside modal-overlay-inside--master">
        <div className="modal-content modal-master" id="details-modal">

          {/* Header strip: wordmark + close */}
          <header className="modal-master__header">
            <div className="modal-master__wordmark">
              MAJSTR<span className="modal-master__wordmark-dot">.</span>
            </div>
            <button
              type="button"
              className="modal-master__close"
              onClick={() => setShowModal(null)}
              aria-label="Close"
            >
              ✕
            </button>
          </header>

          {/* Identity row: avatar + name block */}
          <section className="modal-master__identity">
            <div
              className={`modal-master__avatar ${
                photo ? "modal-master__avatar--photo" : "modal-master__avatar--sigil"
              }`}
            >
              {photo ? (
                <>
                  <div
                    className="modal-master__photo"
                    style={{ backgroundImage: `url(${photo})` }}
                  />
                  <div className="modal-master__photo-overlay" />
                </>
              ) : (
                <>
                  <Sigil seed={id} size={3} />
                  <div className="modal-master__regcode">
                    <span className="modal-master__regcode-dot">●</span>
                    <span>M-{regCode}</span>
                  </div>
                </>
              )}
            </div>

            <div className="modal-master__name-block">
              <h2 className="modal-master__name">
                {displayName}
                <span className="modal-master__name-dot">.</span>
              </h2>
              <div className="modal-master__meta">
                <span className="modal-master__profession">{profName}</span>
                <span className="modal-master__divider" aria-hidden="true" />
                <span className="modal-master__city">{locName}</span>
              </div>
            </div>

            <div className="modal-master__speaks-row">
              <span className="modal-master__row-label">Speaks</span>
              <span className="modal-master__lang-list">
                {displayLangs.slice(0, 4).map((code) => (
                  <span key={code} className="modal-master__lang">
                    {LANG_LABELS[code] ?? code.toUpperCase()}
                  </span>
                ))}
              </span>
            </div>

            {modalTags.length > 0 && (
              <div className="modal-master__tags-row">
                {modalTags.slice(0, 4).join(" · ")}
              </div>
            )}
          </section>

          {/* Contacts */}
          {contacts.length > 0 && (
            <section className="modal-master__contacts-section">
              <div className="modal-master__row-label">Contacts</div>
              <ul
                className={`modal-master__contacts${
                  useTwoColContacts ? " modal-master__contacts--two-col" : ""
                }`}
              >
                {contacts.map((c, i) => {
                  const meta = getContactMeta(c.contactType);
                  return (
                    <li key={i} className="modal-master__contact">
                      <a
                        className="modal-master__contact-link"
                        href={meta.href(c.value)}
                        target={c.contactType === "phone" || c.contactType === "email" ? undefined : "_blank"}
                        rel="noopener noreferrer"
                      >
                        <span className="modal-master__contact-label">{meta.label}</span>
                        <span className="modal-master__contact-value">{meta.display(c.value)}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Bio */}
          {(about || t("modal.noAbout")) && (
            <section className="modal-master__bio">
              {about || t("modal.noAbout")}
            </section>
          )}

          {/* CTA band */}
          <div className="modal-master__cta-band">
            <button type="button" className="modal-master__rate-btn">
              <span className="modal-master__rate-star">☆</span>
              <span>Rate</span>
            </button>
            {primaryContact && primaryMeta ? (
              <a
                className="modal-master__cta"
                href={primaryHref}
                target={primaryContact.contactType === "phone" || primaryContact.contactType === "email" ? undefined : "_blank"}
                rel="noopener noreferrer"
              >
                <span className="modal-master__cta-label">{ctaText}</span>
                <span className="modal-master__cta-arrow" aria-hidden="true">→</span>
              </a>
            ) : (
              <div className="modal-master__cta modal-master__cta--disabled">
                <span className="modal-master__cta-label">No contact</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
