// Country the onboarding wizard files a card under. The public host picks it
// (fr.majstr.xyz → FR) and AddMasterModal encodes it for the Mini App — which
// is a separate webview that can't see the originating host — as either the
// `?country=` web-fallback query or the start_param `-co-<iso>` segment. Kept
// in a JSX-free module so it stays unit-testable. Mirrors resolveOnbLang.

// Countries the wizard can file a card under (ISO codes).
const ONB_COUNTRIES = ["IT", "FR"] as const;
const DEFAULT_COUNTRY = "IT";

function knownCountry(c?: string | null): string | null {
  return c && (ONB_COUNTRIES as readonly string[]).includes(c) ? c : null;
}

// The *explicit* country signalled by how the wizard was opened, or null if
// none was given. Priority: `?country=` (web fallback) > start_param `-co-<iso>`
// (Telegram deep link). The `-co-` regex can't collide with the referral
// `-c-<token>` parser.
function entryCountrySignal(
  search: string,
  startParam: string | null
): string | null {
  const q = knownCountry(new URLSearchParams(search).get("country")?.toUpperCase());
  if (q) return q;
  const iso = startParam?.match(/-co[-_]([a-z]{2})\b/i)?.[1]?.toUpperCase();
  return knownCountry(iso);
}

// Resolved country with the Italy fallback — for the form's initial value.
export function resolveOnbCountry(
  search: string,
  startParam: string | null
): string {
  return entryCountrySignal(search, startParam) ?? DEFAULT_COUNTRY;
}
