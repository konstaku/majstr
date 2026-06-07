import { SITE_URL } from "./config";
import { INDEXED_LANGS, type Lang } from "./i18n";

export const abs = (path: string) => `${SITE_URL}${path}`;

export const homePath = (lang: Lang) => `/${lang}`;
export const hubPath = (lang: Lang, slug: string) => `/${lang}/${slug}`;
export const landingPath = (lang: Lang, profSlug: string, citySlug: string) =>
  `/${lang}/${profSlug}/${citySlug}`;
export const masterPath = (lang: Lang, slug: string) => `/${lang}/m/${slug}`;

// hreflang alternates for a page that exists in every indexed locale. `build`
// maps a lang to its localized path. Iterates INDEXED_LANGS so a gated locale
// (e.g. en while its content is unpublished) is not advertised to crawlers.
// Always includes x-default → default lang.
export function languageAlternates(
  build: (lang: Lang) => string
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of INDEXED_LANGS) out[l] = abs(build(l));
  out["x-default"] = abs(build("uk"));
  return out;
}
