import { useEffect } from "react";
import { Link } from "react-router-dom";

type AddMasterModalProps = {
  onClose: () => void;
};

export default function AddMasterModal({ onClose }: AddMasterModalProps) {
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
              href="https://t.me/majstr_bot?startapp=onboard"
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
