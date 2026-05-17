import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { PickerSheet } from "../ui/PickerSheet";
import { useReferenceData } from "../useReferenceData";
import { useOnbT } from "../i18n";
import type { DraftData } from "../schema";

export function StepLocation() {
  const { t } = useOnbT();
  const { control, formState: { errors }, watch, setValue } = useFormContext<DraftData>();
  const { locations, loading } = useReferenceData();
  const [showPicker, setShowPicker] = useState(false);

  const locationID = watch("locationID");
  const selected = locations.find((l) => l.id === locationID);

  if (loading) {
    return (
      <div className="wizard-step-content">
        <div className="wizard-skeleton" />
        <div className="wizard-skeleton" style={{ width: "50%" }} />
      </div>
    );
  }

  return (
    <div className="wizard-step-content">
      {/* Location picker */}
      <div className="wizard-field">
        <label className="wizard-label">
          {t("loc.cityLabel")} <span className="wizard-required">*</span>
        </label>
        <Controller
          control={control}
          name="locationID"
          rules={{ required: t("common.required") }}
          render={() => (
            <button
              type="button"
              className={`wizard-picker-btn${!selected ? " wizard-picker-btn--placeholder" : ""}`}
              onClick={() => setShowPicker(true)}
            >
              {selected ? selected.name?.ua ?? selected.id : t("loc.chooseCity")}
              <span className="wizard-picker-chevron">›</span>
            </button>
          )}
        />
        <p className="wizard-hint">{t("loc.cityHint")}</p>
        {errors.locationID && (
          <p className="wizard-field-error">{errors.locationID.message}</p>
        )}
      </div>

      {/* Country — read only */}
      <div className="wizard-field">
        <label className="wizard-label">{t("loc.countryLabel")}</label>
        <div className="wizard-readonly">{t("loc.italy")}</div>
        <p className="wizard-hint">{t("loc.countryHint")}</p>
      </div>

      {showPicker && (
        <PickerSheet
          title={t("loc.cityLabel")}
          options={locations.map((l) => ({
            value: l.id,
            label: l.name?.ua ?? l.id,
          }))}
          selected={locationID}
          onSelect={(id) => {
            setValue("locationID", id, { shouldDirty: true, shouldValidate: true });
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}
