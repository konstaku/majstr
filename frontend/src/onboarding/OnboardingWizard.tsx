import "./wizard.css";
import { useForm, FormProvider } from "react-hook-form";
import { BackAffordance } from "../ui/BackAffordance";
import { PrimaryCTA } from "../ui/PrimaryCTA";
import { useWizardMachine } from "./useWizardMachine";
import { useDraft } from "./useDraft";
import { DRAFT_DEFAULTS, STEP_SCHEMAS, STEP_TRIGGER_FIELDS, type DraftData } from "./schema";
import { StepProfile } from "./steps/StepProfile";
import { StepProfession } from "./steps/StepProfession";
import { StepLocation } from "./steps/StepLocation";
import { StepBioTags } from "./steps/StepBioTags";
import { StepContact } from "./steps/StepContact";
import { useHaptic } from "../ui/useHaptic";

const STEP_META = [
  { title: "Профіль" },
  { title: "Професія" },
  { title: "Місцезнаходження" },
  { title: "Про вас" },
  { title: "Контакти" },
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
        {current + 1} of {total}
      </span>
    </div>
  );
}

export default function OnboardingWizard() {
  const form = useForm<DraftData>({
    defaultValues: DRAFT_DEFAULTS,
    mode: "onBlur",
  });
  const { isSyncing, syncError } = useDraft(form);
  const { step, total, isFirst, isLast, goNext, goPrev } = useWizardMachine();
  const haptic = useHaptic();
  const StepComponent = STEP_COMPONENTS[step];

  // Gate: is the current step's required data filled in?
  const values = form.watch();
  const isStepValid = STEP_SCHEMAS[step].safeParse(values).success;

  const handleNext = async () => {
    // Always trigger validation so inline errors appear on first Next tap.
    const fields = STEP_TRIGGER_FIELDS[step];
    const ok = await form.trigger(fields as Parameters<typeof form.trigger>[0]);
    if (!ok) {
      haptic.notify("error");
      return;
    }
    haptic.selection();
    goNext();
  };

  return (
    <FormProvider {...form}>
      <div className="wizard">
        <ProgressDots total={total} current={step} />
        <div className="wizard-step-title">{STEP_META[step].title}</div>

        {syncError && (
          <div className="wizard-sync-error">{syncError}</div>
        )}

        <div className="wizard-body">
          <StepComponent />
        </div>

        <BackAffordance onBack={goPrev} visible={!isFirst} />
        <PrimaryCTA
          label={isLast ? "Надіслати" : "Далі"}
          onPress={handleNext}
          isEnabled={isStepValid && !isSyncing}
        />
      </div>
    </FormProvider>
  );
}
