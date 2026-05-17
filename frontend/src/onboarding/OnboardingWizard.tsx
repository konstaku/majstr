import "./wizard.css";
import { useState } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { BackAffordance } from "../ui/BackAffordance";
import { PrimaryCTA } from "../ui/PrimaryCTA";
import { usePopup } from "../ui/usePopup";
import { useWizardMachine } from "./useWizardMachine";
import { useDraft } from "./useDraft";
import { DRAFT_DEFAULTS, STEP_SCHEMAS, STEP_TRIGGER_FIELDS, type DraftData } from "./schema";
import { StepProfile } from "./steps/StepProfile";
import { StepProfession } from "./steps/StepProfession";
import { StepLocation } from "./steps/StepLocation";
import { StepBioTags } from "./steps/StepBioTags";
import { StepContact } from "./steps/StepContact";
import { useHaptic } from "../ui/useHaptic";
import { OnboardingI18nProvider, useOnbT } from "./i18n";

const STEP_TITLE_KEYS = [
  "step.profile",
  "step.profession",
  "step.location",
  "step.bio",
  "step.contact",
];

const STEP_COMPONENTS = [
  StepProfile,
  StepProfession,
  StepLocation,
  StepBioTags,
  StepContact,
];

function ProgressDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="wizard-progress">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`wizard-dot${i <= current ? " wizard-dot--active" : ""}`}
        />
      ))}
      <span className="wizard-step-counter">
        {current + 1} / {total}
      </span>
    </div>
  );
}

function WizardInner() {
  const { t } = useOnbT();
  const form = useForm<DraftData>({
    defaultValues: DRAFT_DEFAULTS,
    mode: "onBlur",
  });
  const { isSyncing, syncError, isSubmitting, submit } = useDraft(form);
  const { step, total, isFirst, isLast, goNext, goPrev } = useWizardMachine();
  const haptic = useHaptic();
  const popup = usePopup();
  const [submitted, setSubmitted] = useState(false);
  const StepComponent = STEP_COMPONENTS[step];

  // Gate: is the current step's required data filled in?
  const values = form.watch();
  const isStepValid = STEP_SCHEMAS[step].safeParse(values).success;

  const handleSubmit = async () => {
    const result = await submit();
    if (result.ok) {
      haptic.notify("success");
      setSubmitted(true);
      return;
    }
    haptic.notify("error");
    const message =
      result.error === "active_master_exists"
        ? t("submit.errExists")
        : result.error === "offline" || result.error === "network"
        ? t("submit.errOffline")
        : result.errors
        ? t("submit.errValidation", {
            fields: Object.keys(result.errors).join(", "),
          })
        : t("submit.errGeneric");
    await popup({
      title: t("submit.failTitle"),
      message,
      buttons: [{ id: "ok", text: t("submit.failOk") }],
    });
  };

  const handleNext = async () => {
    // Always trigger validation so inline errors appear on first Next tap.
    const fields = STEP_TRIGGER_FIELDS[step];
    const ok = await form.trigger(fields as Parameters<typeof form.trigger>[0]);
    if (!ok) {
      haptic.notify("error");
      return;
    }
    haptic.selection();
    if (isLast) {
      await handleSubmit();
      return;
    }
    goNext();
  };

  if (submitted) {
    return (
      <div className="wizard">
        <div className="wizard-success">
          <div className="wizard-success-icon">✅</div>
          <h2 className="wizard-success-title">{t("success.title")}</h2>
          <p className="wizard-success-text">{t("success.text")}</p>
        </div>
      </div>
    );
  }

  return (
    <FormProvider {...form}>
      <div className="wizard">
        <ProgressDots total={total} current={step} />
        <div className="wizard-step-title">{t(STEP_TITLE_KEYS[step])}</div>

        {syncError && <div className="wizard-sync-error">{syncError}</div>}

        <div className="wizard-body">
          <StepComponent />
        </div>

        <BackAffordance onBack={goPrev} visible={!isFirst} />
        <PrimaryCTA
          label={isLast ? t("nav.submit") : t("nav.next")}
          onPress={handleNext}
          isEnabled={isStepValid && !isSyncing && !isSubmitting}
        />
      </div>
    </FormProvider>
  );
}

export default function OnboardingWizard() {
  return (
    <OnboardingI18nProvider>
      <WizardInner />
    </OnboardingI18nProvider>
  );
}
