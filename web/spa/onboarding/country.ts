// Country the onboarding wizard files a card under. The public host picks it
// (fr.majstr.xyz → FR) and AddMasterModal encodes it for the Mini App — which
// is a separate webview that can't see the originating host — as either the
// `?country=` web-fallback query or the start_param `-co-<iso>` segment. Kept
// in a JSX-free module so it stays unit-testable. Mirrors resolveOnbLang.

// Countries the wizard can file a card under (ISO codes).
const ONB_COUNTRIES = ["IT", "FR"] as const;
const DEFAULT_COUNTRY = "IT";

export function resolveOnbCountry(
  search: string,
  startParam: string | null
): string {
  const q = new URLSearchParams(search).get("country")?.toUpperCase();
  if (q && (ONB_COUNTRIES as readonly string[]).includes(q)) return q;
  const iso = startParam?.match(/-co[-_]([a-z]{2})\b/i)?.[1]?.toUpperCase();
  if (iso && (ONB_COUNTRIES as readonly string[]).includes(iso)) return iso;
  return DEFAULT_COUNTRY;
}
