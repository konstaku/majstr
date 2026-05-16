import { useEffect, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTelegramContext } from "../../surface/useTelegramContext";
import { apiFetch } from "../../api/client";
import type { DraftData } from "../schema";

export function StepProfile() {
  const form = useFormContext<DraftData>();
  const { user } = useTelegramContext();
  const { register, formState: { errors }, setValue, watch } = form;

  const photoUrl = watch("photo");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prefill name from Telegram initData if form is still empty.
  useEffect(() => {
    const current = form.getValues("name");
    if (!current && user) {
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
      if (!res.ok) throw new Error();
      const { photoUrl: url } = await res.json();
      setValue("photo", url, { shouldDirty: true });
    } catch {
      setUploadError("Не вдалося завантажити. Перевірте інтернет і спробуйте ще раз.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Файл завеликий (макс. 5 МБ).");
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
      setUploadError("Не вдалося завантажити. Перевірте інтернет і спробуйте ще раз.");
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
              : user?.photo_url
              ? `url(${user.photo_url})`
              : undefined,
          }}
        >
          {!photoUrl && !user?.photo_url && (
            <span className="step-avatar-placeholder">?</span>
          )}
        </div>

        <div className="step-photo-actions">
          <button
            type="button"
            className="wizard-ghost-btn"
            onClick={handleUseTelegramPhoto}
            disabled={uploading}
          >
            {uploading ? "Завантажуємо…" : "Використати фото з Telegram"}
          </button>
          <button
            type="button"
            className="wizard-ghost-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            Завантажити з пристрою
          </button>
          {photoUrl && (
            <button
              type="button"
              className="wizard-ghost-btn wizard-ghost-btn--danger"
              onClick={() => setValue("photo", "", { shouldDirty: true })}
              disabled={uploading}
            >
              Прибрати фото
            </button>
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
          Ваше імʼя <span className="wizard-required">*</span>
        </label>
        <input
          className={`wizard-input${errors.name ? " wizard-input--error" : ""}`}
          placeholder="Як вас звати?"
          {...register("name", {
            required: "Обовʼязкове поле",
            minLength: { value: 2, message: "Мінімум 2 символи" },
            maxLength: { value: 25, message: "Максимум 25 символів" },
          })}
        />
        <p className="wizard-hint">Це побачать клієнти на вашій картці.</p>
        {errors.name && (
          <p className="wizard-field-error">{errors.name.message}</p>
        )}
      </div>
    </div>
  );
}
