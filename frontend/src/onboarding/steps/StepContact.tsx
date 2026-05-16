import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTelegramContext } from "../../surface/useTelegramContext";
import type { Contact, DraftData } from "../schema";

function findValue(contacts: Contact[], type: string): string {
  return contacts.find((c) => c.contactType === type)?.value ?? "";
}

export function StepContact() {
  const form = useFormContext<DraftData>();
  const { isTMA, user } = useTelegramContext();
  const {
    setValue,
    getValues,
    formState: { errors },
  } = form;

  const existing = getValues("contacts") || [];
  const [phone, setPhone] = useState(() => findValue(existing, "phone"));
  const [instagram, setInstagram] = useState(() =>
    findValue(existing, "instagram")
  );
  const [telegram, setTelegram] = useState(
    () => findValue(existing, "telegram") || (user?.username ? `@${user.username}` : "")
  );
  const [shareError, setShareError] = useState<string | null>(null);

  // Assemble the canonical contacts array whenever any field changes.
  useEffect(() => {
    const next: Contact[] = [];
    if (phone.trim()) next.push({ contactType: "phone", value: phone.trim() });
    if (telegram.trim())
      next.push({ contactType: "telegram", value: telegram.trim() });
    if (instagram.trim())
      next.push({ contactType: "instagram", value: instagram.trim() });
    setValue("contacts", next, { shouldDirty: true, shouldValidate: true });
  }, [phone, telegram, instagram, setValue]);

  const handleShareTelegramNumber = () => {
    setShareError(null);
    const wa = window.Telegram?.WebApp;
    if (!wa?.requestContact) {
      setShareError("Введіть номер вручну нижче.");
      return;
    }
    wa.requestContact((ok, response) => {
      const shared = response?.responseUnsafe?.contact?.phone_number;
      if (ok && shared) {
        const normalized = shared.startsWith("+") ? shared : `+${shared}`;
        setPhone(normalized);
      } else if (!ok) {
        setShareError("Доступ не надано. Введіть номер вручну нижче.");
      } else {
        setShareError(
          "Не вдалося отримати номер автоматично. Введіть його вручну нижче."
        );
      }
    });
  };

  const contactError = errors.contacts?.message as string | undefined;

  return (
    <div className="wizard-step-content">
      <p className="wizard-step-hint">Як з вами звʼязатися?</p>

      {isTMA && (
        <button
          type="button"
          className="wizard-ghost-btn"
          onClick={handleShareTelegramNumber}
        >
          Поділитися номером з Telegram
        </button>
      )}
      {shareError && <p className="wizard-hint">{shareError}</p>}

      <div className="wizard-field">
        <label className="wizard-label">
          Телефон <span className="wizard-required">*</span>
        </label>
        <input
          className={`wizard-input${
            contactError ? " wizard-input--error" : ""
          }`}
          type="tel"
          inputMode="tel"
          placeholder="+39 333 123 45 67"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="wizard-hint">Клієнти телефонуватимуть на цей номер.</p>
        {contactError && <p className="wizard-field-error">{contactError}</p>}
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Telegram</label>
        <input
          className="wizard-input"
          placeholder="@username"
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
        />
        <p className="wizard-hint">Необовʼязково.</p>
      </div>

      <div className="wizard-field">
        <label className="wizard-label">Instagram</label>
        <input
          className="wizard-input"
          placeholder="@username"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
        />
        <p className="wizard-hint">Необовʼязково.</p>
      </div>
    </div>
  );
}
