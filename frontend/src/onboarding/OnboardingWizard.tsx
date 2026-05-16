import "./wizard.css";
import { BackAffordance } from "../ui/BackAffordance";
import { PrimaryCTA } from "../ui/PrimaryCTA";
import { useWizardMachine } from "./useWizardMachine";
import { StepProfile } from "./steps/StepProfile";
import { StepProfession } from "./steps/StepProfession";
import { StepLocation } from "./steps/StepLocation";
import { StepBioTags } from "./steps/StepBioTags";
import { StepContact } from "./steps/StepContact";

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
  const { step, total, isFirst, isLast, goNext, goPrev } = useWizardMachine();
  const StepComponent = STEP_COMPONENTS[step];

  return (
    <div className="wizard">
      <ProgressDots total={total} current={step} />
      <div className="wizard-step-title">{STEP_META[step].title}</div>
      <div className="wizard-body">
        <StepComponent />
      </div>
      <BackAffordance onBack={goPrev} visible={!isFirst} />
      <PrimaryCTA
        label={isLast ? "Надіслати" : "Далі"}
        onPress={goNext}
        isEnabled={true}
      />
    </div>
  );
}
