"use client";

import { useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { MasterContext } from "../context";
import { useTranslation } from "../custom-hooks/useTranslation";
import { localizedName } from "../i18n/lang";
import { transliterate } from "../helpers/transliterate";
import Sigil from "./Sigil";
import { masterSlug } from "@/lib/data";
import { masterPath } from "@/lib/urls";
import type { Lang } from "@/lib/i18n";

import type { Master } from "../schema/master/master.schema";
import { Location, Profession } from "../schema/state/state.schema";

type MasterCardProps = {
  master: Master;
  setShowModal: (show: string) => void;
  /** SearchResults computes this — newest-in-dataset signal. */
  isNew?: boolean;
};

const LANG_LABELS: Record<string, string> = {
  uk: "UA", en: "EN", it: "IT", pt: "PT",
  es: "ES", de: "DE", fr: "FR", pl: "PL",
};

/** Mongo ObjectId → 4-digit creation year (first 4 hex bytes = unix seconds). */
function getCreatedYear(id: string): number {
  return new Date(parseInt(id.slice(0, 8), 16) * 1000).getFullYear();
}

export default function MasterCard({ master, setShowModal, isNew }: MasterCardProps) {
  const {
    state: { locations, professions, lang },
  } = useContext(MasterContext);
  const { t } = useTranslation();

  const { _id, name, professionID, locationID, languages, countryID, photo, tags } = master;

  const displayName = lang === "uk" ? name : transliterate(name);
  // Owner-verified by a moderator (claim flow) — not merely "has a photo".
  const isVerified = !!master.verified;

  const prof = professions.find((p: Profession) => p.id === professionID);
  const loc = locations.find((l: Location) => l.id === locationID);
  const profName = localizedName(prof?.name, lang);
  const locName = localizedName(loc?.name, lang);

  // Crawlable master-page URL in the current locale. `lang` mirrors the URL
  // locale (seeded server-side), so it's the right prefix for uk/ru/en.
  const href = masterPath(lang as Lang, masterSlug(master, prof, loc));

  const displayLangs = (languages && languages.length > 0)
    ? languages
    : countryID === "IT" ? ["uk", "it"]
    : countryID === "PT" ? ["uk", "pt"]
    : ["uk"];

  // Verified beats new — a master who is both shows only VERIFIED.
  const statusBadge: "verified" | "new" | null =
    isVerified ? "verified" : isNew ? "new" : null;

  // Tags from the master's preferred language. Fall back to ua, then en.
  const tagList = (lang === "uk" ? tags?.ua : tags?.en) ?? tags?.ua ?? tags?.en ?? [];
  const tagDisplay = tagList.slice(0, 4).join(" · ");

  const year = getCreatedYear(_id);

  return (
    <Link
      href={href}
      className="master-card master-card--list"
      id={_id}
      onClick={(e) => {
        // Left-click opens the modal (preserve UX); the real href lets
        // crawlers and cmd/ctrl-click reach the master page.
        if (e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          setShowModal(_id);
        }
      }}
    >
      <div className="master-card__sigil-cell">
        {photo ? (
          <>
            <Image
              src={photo}
              alt={displayName}
              fill
              sizes="(max-width: 640px) 45vw, 220px"
              className="master-card__photo"
            />
            <div className="master-card__photo-overlay" />
          </>
        ) : (
          <Sigil seed={_id} size={3} />
        )}
      </div>

      <div className="master-card__body">
        <div className="master-card__body-inner">
          <h3 className="master-card__name" title={displayName}>
            {displayName}
          </h3>
          <div className="master-card__meta">
            <span>{profName}</span>
            {locName && (
              <>
                {" "}<span className="master-card__sep">·</span>{" "}
                <span className="master-card__city">{locName}</span>
              </>
            )}
          </div>

          <div className="master-card__badges">
            {displayLangs.slice(0, 3).map((code) => (
              <span key={code} className="master-card__badge">
                {LANG_LABELS[code] ?? code.toUpperCase()}
              </span>
            ))}
            {statusBadge === "verified" && (
              <span
                className="master-card__badge master-card__badge--status master-card__badge--verified"
                title={t("masterCard.verified")}
              >
                {t("masterCard.verifiedBadge")}
              </span>
            )}
            {statusBadge === "new" && (
              <span className="master-card__badge master-card__badge--status master-card__badge--new">
                NEW
              </span>
            )}
          </div>

          {tagDisplay && (
            <div className="master-card__tags">{tagDisplay}</div>
          )}
        </div>

        <div className="master-card__strip">
          <span className="master-card__member-since">
            {t("masterCard.memberSince")}{" "}
            <span className="master-card__year">{year}</span>
          </span>
          <span className="master-card__cta">
            {t("masterCard.details")} →
          </span>
        </div>
      </div>
    </Link>
  );
}
