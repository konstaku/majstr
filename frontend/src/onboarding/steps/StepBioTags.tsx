import { useFormContext, Controller } from "react-hook-form";
import { TagPicker } from "../ui/TagPicker";
import type { DraftData } from "../schema";
import tagSuggestions from "../../data/tag-suggestions.json";

const BIO_MAX = 600;
const BIO_WARN_AMBER = Math.round(BIO_MAX * 0.8);  // 480
const BIO_WARN_RED = Math.round(BIO_MAX * 0.95);   // 570

function bioCounterColor(len: number): string {
  if (len >= BIO_WARN_RED) return "var(--app-destructive)";
  if (len >= BIO_WARN_AMBER) return "#f59e0b";
  return "var(--app-hint)";
}

export function StepBioTags() {
  const { control, register, formState: { errors }, watch } = useFormContext<DraftData>();
  const professionID = watch("professionID");
  const about = watch("about") ?? "";

  const suggestions: string[] =
    (tagSuggestions as Record<string, string[]>)[professionID] ??
    (tagSuggestions as Record<string, string[]>)["_default"] ??
    [];

  return (
    <div className="wizard-step-content">
      {/* Tags */}
      <div className="wizard-field">
        <label className="wizard-label">
          Послуги (від 1 до 3) <span className="wizard-required">*</span>
        </label>
        <Controller
          control={control}
          name="tags"
          rules={{ validate: (v) => (v?.length >= 1 ? true : "Вкажіть хоча б одну послугу") }}
          render={({ field }) => (
            <TagPicker
              value={field.value ?? []}
              onChange={field.onChange}
              suggestions={suggestions}
            />
          )}
        />
        {errors.tags && (
          <p className="wizard-field-error">{String(errors.tags.message)}</p>
        )}
      </div>

      {/* Bio */}
      <div className="wizard-field">
        <label className="wizard-label">
          Про вас <span className="wizard-required">*</span>
        </label>
        <textarea
          className={`wizard-input wizard-textarea${errors.about ? " wizard-input--error" : ""}`}
          rows={6}
          placeholder="Що ви робите, в якому районі, як з вами зручно зв'язатися, як скоро ви відповідаєте."
          {...register("about", {
            required: "Обовʼязкове поле",
            minLength: { value: 30, message: "Мінімум 30 символів" },
            maxLength: { value: BIO_MAX, message: `Максимум ${BIO_MAX} символів` },
          })}
        />
        <div
          className="bio-counter"
          style={{ color: bioCounterColor(about.length) }}
          aria-live="polite"
        >
          {about.length} / {BIO_MAX}
        </div>
        <p className="wizard-hint">Від 30 до 600 символів.</p>
        {errors.about && (
          <p className="wizard-field-error">{errors.about.message}</p>
        )}
      </div>
    </div>
  );
}
