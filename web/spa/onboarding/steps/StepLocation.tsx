import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { PickerSheet } from "../ui/PickerSheet";
import { useReferenceData } from "../useReferenceData";
import { useOnbT } from "../i18n";
import { localizedName } from "../../i18n/lang";
import type { DraftData } from "../schema";

export function StepLocation() {
  const { t, lang } = useOnbT();
  const { control, formState: { errors }, watch, setValue } = useFormContext<DraftData>();
  const { locations, loading } = useReferenceData();
  const [showPicker, setShowPicker] = useState(false);

  const locationID = watch("locationID");
  // Cities are scoped to the card's country (legacy IT rows may lack countryID).
  const countryID = watch("countryID") || "IT";
  const countryLocations = locations.filter(
    (l) => (l.countryID ?? "IT") === countryID
  );
  const selected = countryLocations.find((l) => l.id === locationID);

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
              {selected ? localizedName(selected.name, lang, selected.id) : t("loc.chooseCity")}
              <span className="wizard-picker-chevron">›</span>
            </button>
          )}
        />
        <p className="wizard-hint">{t("loc.cityHint")}</p>
        {errors.locationID && (
          <p className="wizard-field-error">{errors.locationID.message}</p>
        )}
      </div>

      {/* Country — read only; set by the entry host (see AddMasterModal). */}
      <div className="wizard-field">
        <label className="wizard-label">{t("loc.countryLabel")}</label>
        <div className="wizard-readonly">
          {t(countryID === "FR" ? "loc.fr" : "loc.italy")}
        </div>
        <p className="wizard-hint">{t("loc.countryHint")}</p>
      </div>

      {showPicker && (
        <PickerSheet
          title={t("loc.cityLabel")}
          options={countryLocations.map((l) => ({
            value: l.id,
            label: localizedName(l.name, lang, l.id),
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
