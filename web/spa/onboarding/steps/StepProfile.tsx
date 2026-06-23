import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTelegramContext } from "../../surface/useTelegramContext";
import { apiFetch } from "../../api/client";
import { useOnbT } from "../i18n";
import type { DraftData } from "../schema";

export function StepProfile() {
  const form = useFormContext<DraftData>();
  const { t } = useOnbT();
  const { user } = useTelegramContext();
  const { register, formState: { errors }, setValue, watch } = form;

  const photoUrl = watch("photo");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // null = checking, true = real TG photo available, false = no real photo
  const [hasTgPhoto, setHasTgPhoto] = useState<boolean | null>(null);
  // Set once the user removes the photo, so the auto-attach effect below won't
  // immediately re-add it.
  const [photoDismissed, setPhotoDismissed] = useState(false);
  const autoAttached = useRef(false);

  // Ask the backend (via Bot API getUserProfilePhotos) whether this user has a
  // real profile photo. Telegram supplies photo_url in initData for ALL users
  // (auto-generated colored-circle avatars), so client-side checks are unreliable.
  useEffect(() => {
    // Soft probe — a 401 here (e.g. opened in a plain browser without a token)
    // must NOT trigger the global 401 handler, which would close the Mini App /
    // bounce to /login. Opt out and just fall back to "no photo".
    apiFetch("/api/masters/draft/photo/telegram-check", {}, { redirectOn401: false })
      .then((r) => (r.ok ? r.json() : { available: false }))
      .then((data) => setHasTgPhoto(data.available === true))
      .catch(() => setHasTgPhoto(false));
  }, []);

  // Prefill name from Telegram initData if the field is still empty. Guarded to
  // run only ONCE: without this, emptying the field to retype (e.g. Konstantin →
  // Константин) re-triggers the effect and restores the old value — the user
  // can never clear it.
  const namePrefilled = useRef(false);
  useEffect(() => {
    if (namePrefilled.current || !user) return;
    namePrefilled.current = true;
    if (!form.getValues("name")) {
      const suggested = [user.first_name, user.last_name?.[0]]
        .filter(Boolean)
        .join(" ");
      setValue("name", suggested, { shouldValidate: false, shouldDirty: false });
    }
  }, [user, form, setValue]);

  const handleUseTelegramPhoto = async () => {
    setUploading(true);
    setUploadError(null);
    try {
      const res = await apiFetch("/api/masters/draft/photo/from-telegram", {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // If the backend confirms there is no photo, hide the button silently.
        if (["no_telegram_photo", "telegram_photo_fetch_failed"].includes(body.error)) {
          setHasTgPhoto(false);
          return;
        }
        throw new Error();
      }
      const { photoUrl: url } = await res.json();
      setValue("photo", url, { shouldDirty: true });
    } catch {
      setUploadError(t("profile.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  // Auto-use the Telegram photo by default: if the user has a real TG photo and
  // hasn't already chosen or removed one, attach it (download → S3) so the
  // previewed avatar is what actually gets saved — users expect the photo they
  // see to be on their card. Runs once; they can still upload another or remove.
  useEffect(() => {
    if (
      hasTgPhoto === true &&
      !photoUrl &&
      !photoDismissed &&
      !uploading &&
      !autoAttached.current
    ) {
      autoAttached.current = true;
      handleUseTelegramPhoto();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasTgPhoto, photoUrl, photoDismissed]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(t("profile.fileTooLarge"));
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("photo", file);
      const res = await apiFetch("/api/masters/draft/photo", { method: "POST", body });
      if (!res.ok) throw new Error();
      const { photoUrl: url } = await res.json();
      setValue("photo", url, { shouldDirty: true });
    } catch {
      setUploadError(t("profile.uploadError"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="wizard-step-content">
      {/* Avatar */}
      <div className="step-photo-wrap">
        <div
          className="step-avatar"
          style={{
            backgroundImage: photoUrl
              ? `url(${photoUrl})`
              : hasTgPhoto && user?.photo_url
                ? `url(${user.photo_url})`
                : undefined,
          }}
        >
          {!photoUrl && !hasTgPhoto && (
            <span className="step-avatar-placeholder">?</span>
          )}
        </div>

        <div className="step-photo-actions">
          {hasTgPhoto && (
            <button
              type="button"
              className="wizard-ghost-btn"
              onClick={handleUseTelegramPhoto}
              disabled={uploading}
            >
              {uploading ? t("profile.uploading") : t("profile.usePhoto")}
            </button>
          )}
          <button
            type="button"
            className="wizard-ghost-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {t("profile.uploadDevice")}
          </button>
          {photoUrl && (
            <button
              type="button"
              className="wizard-ghost-btn wizard-ghost-btn--danger"
              onClick={() => {
                setValue("photo", "", { shouldDirty: true });
                setPhotoDismissed(true);
              }}
              disabled={uploading}
            >
              {t("profile.removePhoto")}
            </button>
          )}
          {hasTgPhoto === false && !photoUrl && (
            <p className="wizard-hint">{t("profile.skipPhoto")}</p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      {uploadError && <p className="wizard-field-error">{uploadError}</p>}

      {/* Name */}
      <div className="wizard-field">
        <label className="wizard-label">
          {t("profile.nameLabel")} <span className="wizard-required">*</span>
        </label>
        <input
          className={`wizard-input${errors.name ? " wizard-input--error" : ""}`}
          placeholder={t("profile.namePlaceholder")}
          {...register("name", {
            required: t("common.required"),
            minLength: { value: 2, message: t("err.min2") },
            maxLength: { value: 25, message: t("err.max25") },
          })}
        />
        <p className="wizard-hint">{t("profile.nameHint")}</p>
        {errors.name && (
          <p className="wizard-field-error">{errors.name.message}</p>
        )}
      </div>
    </div>
  );
}
