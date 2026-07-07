"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslation } from "../custom-hooks/useTranslation";
import { joinModal } from "../i18n/translations";
import { getActiveReferral } from "../referral/referral";
import { countryForHost, COUNTRY_ISO } from "@/lib/i18n";

const BOT_USERNAME = process.env.NEXT_PUBLIC_TMA_BOT_USERNAME || "majstr_bot";

type AddMasterModalProps = {
  onClose: () => void;
};

export default function AddMasterModal({ onClose }: AddMasterModalProps) {
  const { lang } = useTranslation();
  const c = joinModal(lang);
  // A community share-link token (captured from ?via= on the public site) must
  // ride into the Mini App, which can't see this browser's localStorage —
  // append it to the start_param as `-c-<token>` (read in the wizard).
  const [via, setVia] = useState<string | null>(null);
  // The public host picks the country (fr.majstr.xyz → FR). The Mini App is a
  // separate webview on app.majstr.xyz that can't see this host, so carry the
  // country into the start_param as `-co-<iso>` (read in the wizard) — otherwise
  // a master arriving from fr.majstr.xyz would be filed under Italy.
  const [country, setCountry] = useState<string | null>(null);
  useEffect(() => {
    setVia(getActiveReferral());
    const iso = COUNTRY_ISO[countryForHost(window.location.hostname)];
    // Only carry a non-default country so existing IT links stay byte-identical.
    setCountry(iso && iso !== "IT" ? iso : null);
  }, []);

  // The Mini App wizard supports all 9 languages — pass the site language
  // straight through so onboarding opens in the same language.
  const startParam =
    `onboard-${lang}` +
    (country ? `-co-${country.toLowerCase()}` : "") +
    (via ? `-c-${via}` : "");
  const tgHref = `https://t.me/${BOT_USERNAME}?startapp=${startParam}`;
  // Web fallback (no Telegram): keep token + country in the URL so /add reads them.
  const fallbackQuery = [
    via ? `via=${via}` : "",
    country ? `country=${country}` : "",
  ]
    .filter(Boolean)
    .join("&");
  const addHref = fallbackQuery ? `/add?${fallbackQuery}` : "/add";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="join-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={c.title}
      >
        <button className="join-modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <h2 className="join-modal-title">{c.title}</h2>
        <p className="join-modal-intro">{c.intro}</p>
        <p className="join-modal-time">⏱ {c.time}</p>

        <a
          href={tgHref}
          target="_blank"
          rel="noopener noreferrer"
          className="join-modal-cta"
        >
          {c.openTg}
        </a>

        <Link href={addHref} onClick={onClose} className="join-modal-fallback">
          {c.noTg}
        </Link>
      </div>
    </div>
  );
}
