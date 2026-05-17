import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { useHaptic } from "../../ui/useHaptic";
import { usePopup } from "../../ui/usePopup";
import { PickerSheet } from "../ui/PickerSheet";
import { useReferenceData } from "../useReferenceData";
import { LANGUAGE_OPTIONS } from "../schema";
import { useOnbT } from "../i18n";
import type { DraftData } from "../schema";

const MAX_LANGUAGES = 5;

export function StepProfession() {
  const form = useFormContext<DraftData>();
  const { t } = useOnbT();
  const { control, formState: { errors }, setValue, watch } = form;
  const haptic = useHaptic();
  const popup = usePopup();
  const { professions, profCategories, loading } = useReferenceData();

  const [categoryID, setCategoryID] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showProfessionPicker, setShowProfessionPicker] = useState(false);

  const professionID = watch("professionID");
  const languages = watch("languages") ?? [];

  const selectedCategory = profCategories.find((c) => c.id === categoryID);
  const selectedProfession = professions.find((p) => p.id === professionID);
  const filteredProfessions = professions.filter((p) => p.categoryID === categoryID);

  const toggleLanguage = (code: string) => {
    if (languages.includes(code)) {
      setValue("languages", languages.filter((l) => l !== code), { shouldDirty: true, shouldValidate: true });
      haptic.selection();
    } else if (languages.length >= MAX_LANGUAGES) {
      popup({ message: t("prof.maxLangs"), buttons: [{ id: "ok", text: "OK" }] });
    } else {
      setValue("languages", [...languages, code], { shouldDirty: true, shouldValidate: true });
      haptic.selection();
    }
  };

  if (loading) {
    return (
      <div className="wizard-step-content">
        <div className="wizard-skeleton" />
        <div className="wizard-skeleton" />
        <div className="wizard-skeleton" style={{ width: "60%" }} />
      </div>
    );
  }

  return (
    <div className="wizard-step-content">
      {/* Category picker */}
      <div className="wizard-field">
        <label className="wizard-label">
          {t("prof.categoryLabel")} <span className="wizard-required">*</span>
        </label>
        <button
          type="button"
          className={`wizard-picker-btn${!selectedCategory ? " wizard-picker-btn--placeholder" : ""}`}
          onClick={() => setShowCategoryPicker(true)}
        >
          {selectedCategory?.name.ua ?? t("prof.chooseCategory")}
          <span className="wizard-picker-chevron">›</span>
        </button>
      </div>

      {/* Profession picker */}
      <div className="wizard-field">
        <label className="wizard-label">
          {t("prof.professionLabel")} <span className="wizard-required">*</span>
        </label>
        <Controller
          control={control}
          name="professionID"
          rules={{ required: t("common.required") }}
          render={() => (
            <button
              type="button"
              className={`wizard-picker-btn${!selectedProfession ? " wizard-picker-btn--placeholder" : ""}${!categoryID ? " wizard-picker-btn--disabled" : ""}`}
              onClick={() => categoryID && setShowProfessionPicker(true)}
              disabled={!categoryID}
            >
              {selectedProfession?.name.ua ?? (categoryID ? t("prof.chooseProfession") : t("prof.chooseCategoryFirst"))}
              <span className="wizard-picker-chevron">›</span>
            </button>
          )}
        />
        {errors.professionID && (
          <p className="wizard-field-error">{errors.professionID.message}</p>
        )}
      </div>

      {/* Language chips */}
      <div className="wizard-field">
        <label className="wizard-label">
          {t("prof.langLabel")} <span className="wizard-required">*</span>
        </label>
        <div className="wizard-chips">
          {LANGUAGE_OPTIONS.map(({ code, label }) => (
            <button
              key={code}
              type="button"
              className={`wizard-chip${languages.includes(code) ? " wizard-chip--active" : ""}`}
              onClick={() => toggleLanguage(code)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="wizard-hint">{t("prof.langHint")}</p>
        {errors.languages && (
          <p className="wizard-field-error">{t("prof.langRequired")}</p>
        )}
      </div>

      {/* Pickers */}
      {showCategoryPicker && (
        <PickerSheet
          title={t("prof.categoryLabel")}
          options={profCategories.map((c) => ({ value: c.id, label: c.name.ua }))}
          selected={categoryID}
          onSelect={(id) => {
            setCategoryID(id);
            setValue("professionID", "", { shouldDirty: true });
          }}
          onClose={() => setShowCategoryPicker(false)}
        />
      )}

      {showProfessionPicker && (
        <PickerSheet
          title={t("prof.professionLabel")}
          options={filteredProfessions.map((p) => ({ value: p.id, label: p.name.ua }))}
          selected={professionID}
          onSelect={(id) => setValue("professionID", id, { shouldDirty: true, shouldValidate: true })}
          onClose={() => setShowProfessionPicker(false)}
        />
      )}
    </div>
  );
}
