import { useState } from "react";
import { useFormContext, Controller } from "react-hook-form";
import { PickerSheet } from "../ui/PickerSheet";
import { useReferenceData } from "../useReferenceData";
import type { DraftData } from "../schema";

export function StepLocation() {
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
          Найближче велике місто <span className="wizard-required">*</span>
        </label>
        <Controller
          control={control}
          name="locationID"
          rules={{ required: "Обовʼязкове поле" }}
          render={() => (
            <button
              type="button"
              className={`wizard-picker-btn${!selected ? " wizard-picker-btn--placeholder" : ""}`}
              onClick={() => setShowPicker(true)}
            >
              {selected
                ? `${selected.city.ua} — ${selected.province.ua}`
                : "Оберіть місто"}
              <span className="wizard-picker-chevron">›</span>
            </button>
          )}
        />
        <p className="wizard-hint">
          Це місто буде на вашій картці. Це не означає, що ви не працюєте в інших.
        </p>
        {errors.locationID && (
          <p className="wizard-field-error">{errors.locationID.message}</p>
        )}
      </div>

      {/* Country — read only */}
      <div className="wizard-field">
        <label className="wizard-label">Країна</label>
        <div className="wizard-readonly">🇮🇹 Італія</div>
        <p className="wizard-hint">Поки що Majstr працює тільки в Італії.</p>
      </div>

      {showPicker && (
        <PickerSheet
          title="Місто"
          options={locations.map((l) => ({
            value: l.id,
            label: l.city.ua,
            sublabel: l.province.ua,
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
