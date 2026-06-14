import "../onboarding/wizard.css";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../api/client";
import { isTMA } from "../surface/detect";

// Landing screen for the share-to-claim deep link
// (t.me/<bot>?startapp=claim-<masterId>). Standalone, styled like the
// add-master wizard — no website header/branding.
type ClaimState =
  | { phase: "checking" }
  | { phase: "success" }
  | { phase: "pending" }
  | { phase: "deleted" }
  | { phase: "error"; message: string };

export default function ClaimCard() {
  const { masterId } = useParams<{ masterId: string }>();
  const navigate = useNavigate();
  const [state, setState] = useState<ClaimState>({ phase: "checking" });
  const [deleting, setDeleting] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!masterId || fired.current) return;
    fired.current = true; // claims are rate-limited — never double-fire

    (async () => {
      if (!isTMA()) {
        setState({
          phase: "error",
          message: "Відкрийте це посилання через Telegram, щоб підтвердити, що картка ваша.",
        });
        return;
      }

      try {
        const res = await apiFetch(
          "/api/claims",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ masterID: masterId }),
          },
          { redirectOn401: false }
        );

        if (res.status === 201) {
          const { autoApproved } = await res.json();
          setState({ phase: autoApproved ? "success" : "pending" });
          return;
        }

        const body = await res.json().catch(() => ({}));
        if (body.error === "already_owner") {
          navigate("/my-cards", { replace: true });
          return;
        }
        if (body.error === "claim_already_pending") {
          setState({ phase: "pending" });
          return;
        }
        if (body.error === "active_card_exists") {
          setState({
            phase: "error",
            message:
              "У вас вже є активна картка майстра — спершу видаліть її в «Мої картки», щоб підтвердити цю.",
          });
          return;
        }
        if (body.error === "not_claimable") {
          setState({
            phase: "error",
            message: "Цю картку не можна підтвердити — вона вже має власника.",
          });
          return;
        }
        if (res.status === 404) {
          setState({ phase: "error", message: "Картку не знайдено." });
          return;
        }
        if (res.status === 429) {
          setState({
            phase: "error",
            message: "Забагато спроб поспіль. Спробуйте приблизно за годину.",
          });
          return;
        }
        setState({
          phase: "error",
          message: `Не вдалося обробити запит (код ${res.status}). Спробуйте пізніше.`,
        });
      } catch {
        setState({ phase: "error", message: "Немає звʼязку. Спробуйте ще раз." });
      }
    })();
  }, [masterId, navigate]);

  async function handleDelete() {
    if (!window.confirm("Видалити картку назавжди? Цю дію не можна скасувати.")) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/masters/${masterId}`, { method: "DELETE" });
      if (res.ok) setState({ phase: "deleted" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="wizard">
      {state.phase === "checking" && (
        <div className="wizard-body">
          <div className="wizard-skeleton" />
          <div className="wizard-skeleton" />
          <div className="wizard-skeleton" style={{ width: "60%" }} />
        </div>
      )}

      {state.phase === "success" && (
        <div className="wizard-success">
          <div className="wizard-success-icon">✅</div>
          <h2 className="wizard-success-title">Картка тепер ваша</h2>
          <p className="wizard-success-text">
            Ми підтвердили, що це ваш профіль. Оновіть дані — після перевірки модератором картка
            отримає позначку VERIFIED і показуватиметься вище в пошуку.
          </p>
          <div className="wizard-actions" style={{ width: "100%", maxWidth: 320 }}>
            <button
              type="button"
              className="wizard-solid-btn"
              onClick={() => navigate("/my-cards")}
            >
              Редагувати картку
            </button>
            <button
              type="button"
              className="wizard-ghost-btn wizard-ghost-btn--danger"
              disabled={deleting}
              onClick={handleDelete}
            >
              Видалити картку
            </button>
          </div>
        </div>
      )}

      {state.phase === "pending" && (
        <div className="wizard-success">
          <div className="wizard-success-icon">⏳</div>
          <h2 className="wizard-success-title">Запит на розгляді</h2>
          <p className="wizard-success-text">
            Ми не змогли підтвердити автоматично, що картка ваша. Модератор перегляне запит і ми
            повідомимо вас у Telegram.
          </p>
        </div>
      )}

      {state.phase === "deleted" && (
        <div className="wizard-success">
          <div className="wizard-success-icon">🗑</div>
          <h2 className="wizard-success-title">Картку видалено</h2>
          <p className="wizard-success-text">Ваші дані прибрано з каталогу.</p>
        </div>
      )}

      {state.phase === "error" && (
        <div className="wizard-success">
          <div className="wizard-success-icon">⚠️</div>
          <h2 className="wizard-success-title">Не вдалося</h2>
          <p className="wizard-success-text">{state.message}</p>
        </div>
      )}
    </div>
  );
}
