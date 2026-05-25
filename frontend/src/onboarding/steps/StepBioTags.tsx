import { useEffect } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { TagPicker } from "../ui/TagPicker";
import { useOnbT } from "../i18n";
import { useReferenceData } from "../useReferenceData";
import { buildBioTemplate } from "../bioTemplates";
import { localizedName } from "../../i18n/lang";
import type { DraftData } from "../schema";
import tagSuggestions from "../../data/tag-suggestions.i18n.json";

const BIO_MAX = 600;
const BIO_WARN_AMBER = Math.round(BIO_MAX * 0.8);  // 480
const BIO_WARN_RED = Math.round(BIO_MAX * 0.95);   // 570

function bioCounterColor(len: number): string {
  if (len >= BIO_WARN_RED) return "var(--app-destructive)";
  if (len >= BIO_WARN_AMBER) return "#f59e0b";
  return "var(--app-hint)";
}

export function StepBioTags() {
  const { t, lang } = useOnbT();
  const { control, register, formState: { errors }, watch, setValue, getValues } = useFormContext<DraftData>();
  const { professions, locations, loading } = useReferenceData();

  const professionID = watch("professionID");
  const about = watch("about") ?? "";

  // Pre-fill bio with a structured template once reference data is loaded,
  // but only when the field is still empty (don't overwrite user's text).
  useEffect(() => {
    if (loading) return;
    if (getValues("about")) return;

    const profession = professions.find((p) => p.id === professionID);
    const locationID = getValues("locationID");
    const location = locations.find((l) => l.id === locationID);
    const languages = getValues("languages") ?? [];

    if (!profession || !location) return;

    const profName = localizedName(profession.name, lang);
    const cityName =
      lang === "uk"
        ? (location.name.ua_alt ?? localizedName(location.name, "uk"))
        : localizedName(location.name, lang);

    setValue("about", buildBioTemplate(lang, profName, cityName, languages), {
      shouldDirty: false,
      shouldValidate: false,
    });
  // Run once on mount and again if reference data finishes loading after mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const tagData = tagSuggestions as Record<string, Record<string, string[]>>;
  const byProf = tagData[professionID] ?? tagData["_default"];
  const suggestions: string[] =
    byProf?.[lang] ?? byProf?.uk ?? byProf?.en ?? [];

  return (
    <div className="wizard-step-content">
      {/* Tags — optional */}
      <div className="wizard-field">
        <label className="wizard-label">
          {t("bio.servicesLabel")}
        </label>
        <Controller
          control={control}
          name="tags"
          render={({ field }) => (
            <TagPicker
              value={field.value ?? []}
              onChange={field.onChange}
              suggestions={suggestions}
            />
          )}
        />
      </div>

      {/* Bio */}
      <div className="wizard-field">
        <label className="wizard-label">
          {t("bio.aboutLabel")} <span className="wizard-required">*</span>
        </label>
        <textarea
          className={`wizard-input wizard-textarea${errors.about ? " wizard-input--error" : ""}`}
          rows={6}
          placeholder={t("bio.aboutPlaceholder")}
          {...register("about", {
            required: t("common.required"),
            minLength: { value: 30, message: t("err.min30") },
            maxLength: { value: BIO_MAX, message: t("err.max600") },
          })}
        />
        <div
          className="bio-counter"
          style={{ color: bioCounterColor(about.length) }}
          aria-live="polite"
        >
          {about.length} / {BIO_MAX}
        </div>
        <p className="wizard-hint">{t("bio.aboutHint")} {t("bio.editLater")}</p>
        {errors.about && (
          <p className="wizard-field-error">{errors.about.message}</p>
        )}
      </div>
    </div>
  );
}
