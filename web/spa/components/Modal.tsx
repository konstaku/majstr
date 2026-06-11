"use client";

import { useContext, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MasterContext } from "../context";
import { useTranslation } from "../custom-hooks/useTranslation";
import { localizedName } from "../i18n/lang";
import { transliterate } from "../helpers/transliterate";
import Sigil from "./Sigil";
import { masterSlug } from "@/lib/data";

import type { Master, Contacts } from "../schema/master/master.schema";
import { Location, Profession } from "../schema/state/state.schema";

type ModalProps = {
  master: Master;
  setShowModal: React.Dispatch<React.SetStateAction<string | null | boolean>>;
  /** True while the full record (about + contacts) is still being fetched. */
  loadingDetails?: boolean;
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

export default function Modal({ master, setShowModal, loadingDetails }: ModalProps) {
  const {
    state: { locations, professions, masters },
  } = useContext(MasterContext);
  const { t, lang } = useTranslation();

  const { _id: id, languages, about, photo, countryID } = master;
  // Slim masters (grid seed) carry no contacts until the lazy fetch resolves.
  const contacts = master.contacts ?? [];

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

  // CTA precedence: Telegram wins over any other channel when present,
  // otherwise fall back to the first declared contact.
  const primaryContact: Contacts | undefined =
    contacts.find((c) => c.contactType.toLowerCase() === "telegram") ?? contacts[0];
  const primaryMeta = primaryContact ? getContactMeta(primaryContact.contactType) : null;
  const primaryHref = primaryContact && primaryMeta ? primaryMeta.href(primaryContact.value) : "#";
  const primaryType = primaryContact?.contactType.toLowerCase();
  const primaryIsPhone = primaryType === "phone";
  const primaryIsTelegram = primaryType === "telegram";
  const ctaText = primaryIsPhone
    ? "Call"
    : primaryIsTelegram
      ? "Write in Telegram"
      : primaryMeta
        ? `Message on ${primaryMeta.label}`
        : "";

  const useTwoColContacts = contacts.length >= 4;

  // Share-to-claim: a shared card link may carry a #claim (or ?claim=1)
  // marker. Capture it during the FIRST render — the URL-mirroring effect
  // below rewrites the URL (pushState) and would wipe the hash.
  const [claimIntent] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.location.hash === "#claim" ||
        new URLSearchParams(window.location.search).get("claim") === "1")
  );
  const showClaimBanner = claimIntent && master.claimable === true;
  const botUsername = process.env.NEXT_PUBLIC_TMA_BOT_USERNAME || "majstr_bot";

  // While the modal is open, reflect it in the URL as the master page
  // (/{lang}/m/{slug}) so it's shareable, indexable, and back-button closes it.
  useEffect(() => {
    const prevPath = window.location.pathname + window.location.search;
    const prof = professions.find((p: Profession) => p.id === master.professionID);
    const loc = locations.find((l: Location) => l.id === master.locationID);
    const target = `/${lang}/m/${masterSlug(master, prof, loc)}`;
    window.history.pushState(null, "", target);
    return () => {
      window.history.pushState(null, "", prevPath);
    };
  }, [id, lang, master, professions, locations]);

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

          {/* Share-to-claim banner (link carried #claim / ?claim=1) */}
          {showClaimBanner && (
            <a
              href={`https://t.me/${botUsername}?startapp=claim-${id}`}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                background: "#f5c542",
                color: "#0e0a06",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                textDecoration: "none",
                padding: "8px 16px",
                borderBottom: "2px solid #0e0a06",
                textAlign: "center",
              }}
            >
              Це ваша картка? Натисніть, щоб редагувати або видалити →
            </a>
          )}

          {/* Identity row: avatar + name block */}
          <section className="modal-master__identity">
            <div
              className={`modal-master__avatar ${
                photo ? "modal-master__avatar--photo" : "modal-master__avatar--sigil"
              }`}
            >
              {photo ? (
                <>
                  <Image
                    src={photo}
                    alt={displayName}
                    fill
                    sizes="(max-width: 640px) 100vw, 196px"
                    priority
                    className="modal-master__photo"
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
              <div className="modal-master__name-meta">
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
            </div>
          </section>

          {/* Contacts */}
          {loadingDetails && contacts.length === 0 && (
            <section className="modal-master__contacts-section">
              <div className="modal-master__row-label">Contacts</div>
              <div className="skeleton-block" style={{ height: 18, width: "60%", marginTop: 8 }} />
            </section>
          )}
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
          {loadingDetails && about === undefined ? (
            <section className="modal-master__bio">
              <div className="skeleton-block" style={{ height: 14, width: "90%" }} />
              <div className="skeleton-block" style={{ height: 14, width: "75%", marginTop: 8 }} />
            </section>
          ) : (
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
                <span className="modal-master__cta-label">
                  {loadingDetails && contacts.length === 0 ? "…" : "No contact"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
