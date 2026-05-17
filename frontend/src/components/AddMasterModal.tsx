import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "../custom-hooks/useTranslation";

// Bot/onboarding UI languages. Carry the visitor's site language into the
// Telegram deep link so the bot + wizard open in the same language
// (English version of the site -> English bot, etc.).
const BOT_LANGS = ["uk", "en", "it", "ru"];
function toBotLang(siteLang: string): string {
  return BOT_LANGS.includes(siteLang) ? siteLang : "en";
}

type AddMasterModalProps = {
  onClose: () => void;
};

export default function AddMasterModal({ onClose }: AddMasterModalProps) {
  const { lang } = useTranslation();
  const botLang = toBotLang(lang);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-overlay-inside" onClick={(e) => e.stopPropagation()}>
        <div className="modal-content">
          <div className="master-card-body">
            <div className="master-card-header">
              <h2>Зареєструватися як майстер</h2>
              <div className="close-container" onClick={onClose}>
                <img src="/img/icons/close.svg" alt="close" />
              </div>
            </div>
            <p>
              Реєстрація відбувається через Telegram — він використовується для
              підтвердження особи та збору інформації про вас.
            </p>
            <p className="modal-time-estimate">Займе близько 2 хвилин</p>
            <a
              href={`https://t.me/majstr_bot?startapp=onboard-${botLang}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn"
            >
              Відкрити в Telegram →
            </a>
            <div className="modal-fallback">
              <Link to="/add" onClick={onClose}>
                Немає Telegram? Заповніть форму тут →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
