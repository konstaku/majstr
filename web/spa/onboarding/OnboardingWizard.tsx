"use client";

import "./wizard.css";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, FormProvider } from "react-hook-form";
import { apiFetch } from "../api/client";
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
import { useClaimDeepLink } from "../surface/useClaimDeepLink";
import { captureReferralFromUrl } from "../referral/referral";
import { track } from "../analytics";
import { OnboardingI18nProvider, useOnbT } from "./i18n";
import { resolveOnbCountry } from "./country";

// Country the card is filed under, resolved from how the wizard was opened
// (?country= web fallback / start_param -co-<iso> Telegram deep link). The
// public host sets it (fr.majstr.xyz → FR); see AddMasterModal. A returning
// user's saved draft overrides this when useDraft hydrates the form.
function entryCountryID(): string {
  if (typeof window === "undefined") return "IT";
  return resolveOnbCountry(
    window.location.search,
    window.Telegram?.WebApp?.initDataUnsafe?.start_param ?? null
  );
}

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
    defaultValues: { ...DRAFT_DEFAULTS, countryID: entryCountryID() },
    mode: "onBlur",
  });
  const { isSyncing, syncError, isSubmitting, submit } = useDraft(form);
  const { step, total, isFirst, isLast, goNext, goPrev } = useWizardMachine();
  const haptic = useHaptic();
  const popup = usePopup();
  const [submitted, setSubmitted] = useState(false);
  const StepComponent = STEP_COMPONENTS[step];

  // Persist a community share-link token if the wizard was opened via
  // /add?via=<token> (direct deep link that skipped the catalogue chrome).
  // The Mini App entry carries the token in start_param instead — both are
  // resolved at submit time (useDraft → registerReferralIfAny).
  useEffect(() => {
    captureReferralFromUrl();
  }, []);

  // Gate: is the current step's required data filled in?
  const values = form.watch();
  const isStepValid = STEP_SCHEMAS[step].safeParse(values).success;

  const handleSubmit = async () => {
    const result = await submit();
    if (result.ok) {
      haptic.notify("success");
      const v = form.getValues();
      track("master_submit", {
        profession_id: v.professionID,
        location_id: v.locationID,
      });
      setSubmitted(true);
      return;
    }
    haptic.notify("error");
    const message =
      result.error === "active_master_exists"
        ? t("submit.errExists")
        : result.error === "session"
        ? t("draft.errSession")
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
          <div className="wizard-actions" style={{ width: "100%", maxWidth: 320 }}>
            <button
              type="button"
              className="wizard-solid-btn"
              onClick={() => {
                // Inside Telegram, close the Mini App; on the web, go home.
                const wa = window.Telegram?.WebApp;
                if (wa?.close) wa.close();
                else window.location.href = "/";
              }}
            >
              {t("success.done")}
            </button>
          </div>
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
          isLoading={isSubmitting}
        />
      </div>
    </FormProvider>
  );
}

// A "card" for dispatch purposes is a real submitted listing — a half-finished
// draft should resume the wizard, not bounce the user to management.
const OWNED_CARD_STATUSES = ["pending", "approved", "archived"];

// The bot's Main Mini App opens HERE (/onboard) for everyone. Decide on launch
// where the user actually belongs: an owner goes to /my-cards (Manage), a new
// user stays on the wizard (Add). Returns true while the decision is pending.
function useOwnedCardRedirect(): boolean {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // A claim deep link wins — useClaimDeepLink redirects to /claim; don't also
    // race a /my-cards bounce.
    const sp = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    if (sp && /^claim[-_]/i.test(sp)) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    apiFetch("/api/masters/mine", {}, { redirectOn401: false })
      .then((r) => (r.ok ? r.json() : { masters: [] }))
      .then(({ masters }: { masters?: { status: string }[] }) => {
        if (cancelled) return;
        const owns = (masters ?? []).some((m) =>
          OWNED_CARD_STATUSES.includes(m.status)
        );
        if (owns) router.replace("/my-cards");
        else setChecking(false);
      })
      .catch(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return checking;
}

function WizardLoading() {
  return (
    <div className="wizard">
      <div className="wizard-body">
        <div className="wizard-skeleton" />
        <div className="wizard-skeleton" />
        <div className="wizard-skeleton" style={{ width: "60%" }} />
      </div>
    </div>
  );
}

export default function OnboardingWizard() {
  // Claim deep links (startapp=claim-<id>) also arrive on this route — redirect
  // before the wizard mounts its draft flow.
  useClaimDeepLink();
  const checking = useOwnedCardRedirect();

  return (
    <OnboardingI18nProvider>
      {checking ? <WizardLoading /> : <WizardInner />}
    </OnboardingI18nProvider>
  );
}
