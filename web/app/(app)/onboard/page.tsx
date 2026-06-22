import OnboardingWizard from "@/spa/onboarding/OnboardingWizard";

// /onboard — the add-master wizard, the bot's Main Mini App entry point.
// Rendered from the (app) route group (own <html>/<body> + Telegram bridge).
export default function OnboardPage() {
  return <OnboardingWizard />;
}
