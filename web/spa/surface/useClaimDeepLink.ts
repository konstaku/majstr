"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Telegram Mini App deep link: t.me/<bot>?startapp=claim-<masterId> carries
// the payload in initDataUnsafe.start_param — but Telegram opens the Main
// Mini App at its CONFIGURED url (the /onboard wizard), not at "/". Every
// route that can be the TMA entry point must therefore run this redirect,
// or the claim link silently lands the master in the new-card wizard.
export function useClaimDeepLink(): void {
  const router = useRouter();

  useEffect(() => {
    const sp = window.Telegram?.WebApp?.initDataUnsafe?.start_param;
    // claim-<24hex> with an optional -dm / -org source suffix. The suffix tags
    // the claim as founder-driven vs organic for the Day-4 growth gate; it's
    // carried to /claim as ?src= and forwarded to the API + analytics.
    const m = sp?.match(/^claim[-_]([0-9a-f]{24})(?:[-_](dm|org))?$/i);
    if (m) {
      const src = m[2] ? `?src=${m[2].toLowerCase()}` : "";
      router.replace(`/claim/${m[1]}${src}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
