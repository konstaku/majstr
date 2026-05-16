import { useState } from "react";

const TOTAL_STEPS = 5;

export interface WizardMachine {
  step: number;
  total: number;
  isFirst: boolean;
  isLast: boolean;
  goNext: () => void;
  goPrev: () => void;
}

export function useWizardMachine(): WizardMachine {
  const [step, setStep] = useState(0);

  return {
    step,
    total: TOTAL_STEPS,
    isFirst: step === 0,
    isLast: step === TOTAL_STEPS - 1,
    goNext: () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)),
    goPrev: () => setStep((s) => Math.max(s - 1, 0)),
  };
}
