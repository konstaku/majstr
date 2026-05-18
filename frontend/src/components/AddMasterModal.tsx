import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../custom-hooks/useTranslation";
import { joinModal } from "../i18n/translations";

const BOT_USERNAME = import.meta.env.VITE_TMA_BOT_USERNAME || "majstr_bot";

type AddMasterModalProps = {
  onClose: () => void;
};

export default function AddMasterModal({ onClose }: AddMasterModalProps) {
  const { lang } = useTranslation();
  const c = joinModal(lang);
  // The Mini App wizard supports all 9 languages — pass the site language
  // straight through so onboarding opens in the same language.
  const tgHref = `https://t.me/${BOT_USERNAME}?startapp=onboard-${lang}`;

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
        <button
          className="join-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
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

        <Link to="/add" onClick={onClose} className="join-modal-fallback">
          {c.noTg}
        </Link>
      </div>
    </div>
  );
}
