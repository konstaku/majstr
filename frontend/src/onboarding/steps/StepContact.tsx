import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTelegramContext } from "../../surface/useTelegramContext";
import { useOnbT } from "../i18n";
import type { Contact, DraftData } from "../schema";

function findValue(contacts: Contact[], type: string): string {
  return contacts.find((c) => c.contactType === type)?.value ?? "";
}

export function StepContact() {
  const form = useFormContext<DraftData>();
  const { t } = useOnbT();
  const { isTMA, user } = useTelegramContext();
  const {
    setValue,
    getValues,
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
      setShareError(t("contact.shareManual"));
      return;
    }
    wa.requestContact((ok, response) => {
      const shared = response?.responseUnsafe?.contact?.phone_number;
      if (ok && shared) {
        const normalized = shared.startsWith("+") ? shared : `+${shared}`;
        setPhone(normalized);
      } else if (!ok) {
        setShareError(t("contact.shareDenied"));
      } else {
        setShareError(t("contact.shareFailed"));
      }
    });
  };

  const { formState: { errors } } = form;
  const contactError = errors.contacts?.message as string | undefined;

  return (
    <div className="wizard-step-content">
      <p className="wizard-step-hint">{t("contact.hint")}</p>

      {isTMA && (
        <button
          type="button"
          className="wizard-ghost-btn"
          onClick={handleShareTelegramNumber}
        >
          {t("contact.shareNumber")}
        </button>
      )}
      {shareError && <p className="wizard-hint">{shareError}</p>}

      <div className="wizard-field">
        <label className="wizard-label">
          {t("contact.phoneLabel")} <span className="wizard-required">*</span>
        </label>
        <input
          className={`wizard-input${
            contactError ? " wizard-input--error" : ""
          }`}
          type="tel"
          inputMode="tel"
          placeholder={t("contact.phonePlaceholder")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="wizard-hint">{t("contact.phoneHint")}</p>
        {contactError && <p className="wizard-field-error">{contactError}</p>}
      </div>

      <div className="wizard-field">
        <label className="wizard-label">{t("contact.telegramLabel")}</label>
        <input
          className="wizard-input"
          placeholder="@username"
          value={telegram}
          onChange={(e) => setTelegram(e.target.value)}
        />
        <p className="wizard-hint">{t("common.optional")}</p>
      </div>

      <div className="wizard-field">
        <label className="wizard-label">{t("contact.instagramLabel")}</label>
        <input
          className="wizard-input"
          placeholder="@username"
          value={instagram}
          onChange={(e) => setInstagram(e.target.value)}
        />
        <p className="wizard-hint">{t("common.optional")}</p>
      </div>
    </div>
  );
}
