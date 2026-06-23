import { COUNTRY_ORIGIN } from "./config";
import { INDEXED_LANGS, type Country, type Lang } from "./i18n";

// Public origin for a country's pages. URLs are country-free paths; the origin
// (host) carries the country, so canonical/hreflang/OG must use the right host.
export const originFor = (country: Country) => COUNTRY_ORIGIN[country];

// Absolute URL for a country-free path on a given country's host.
//   abs("/uk", "it") → https://majstr.xyz/uk
//   abs("/uk", "fr") → https://fr.majstr.xyz/uk
export const abs = (path: string, country: Country) =>
  `${originFor(country)}${path}`;

export const homePath = (lang: Lang) => `/${lang}`;
export const hubPath = (lang: Lang, slug: string) => `/${lang}/${slug}`;
export const landingPath = (lang: Lang, profSlug: string, citySlug: string) =>
  `/${lang}/${profSlug}/${citySlug}`;
export const masterPath = (lang: Lang, slug: string) => `/${lang}/m/${slug}`;

// Default social card for every page that doesn't render its own (home, about,
// faq, privacy, city, category). Next's file-convention opengraph-image
// (app/opengraph-image.png) only attaches to root-level routes — it does NOT
// cascade into the [country]/[lang] tree — and a page's own openGraph object
// shallow-overrides the layout's, so each fallback page references this. Served
// per host so the OG url matches the page's canonical origin.
export const defaultOgImage = (country: Country) => ({
  url: abs("/opengraph-image.png", country),
  width: 1200,
  height: 630,
  alt: "Majstr — каталог майстрів",
});

// hreflang alternates for a page that exists in every indexed locale. `build`
// maps a lang to its localized (country-free) path. Iterates INDEXED_LANGS so a
// gated locale (e.g. en while unpublished) is not advertised to crawlers.
// Always includes x-default → default lang. Pinned to the country's own host.
export function languageAlternates(
  build: (lang: Lang) => string,
  country: Country
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of INDEXED_LANGS) out[l] = abs(build(l), country);
  out["x-default"] = abs(build("uk"), country);
  return out;
}
