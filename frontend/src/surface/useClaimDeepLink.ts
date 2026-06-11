import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// Telegram Mini App deep link: t.me/<bot>?startapp=claim-<masterId> carries
// the payload in initDataUnsafe.start_param — but Telegram opens the Main
// Mini App at its CONFIGURED url (the /onboard wizard), not at "/". Every
// route that can be the TMA entry point must therefore run this redirect,
// or the claim link silently lands the master in the new-card wizard.
export function useClaimDeepLink(): void {
  const navigate = useNavigate();

  useEffect(() => {
    const sp = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    const m = sp?.match(/^claim[-_]([0-9a-f]{24})$/i);
    if (m) navigate(`/claim/${m[1]}`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
