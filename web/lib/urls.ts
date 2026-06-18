import { SITE_URL } from "./config";
import { INDEXED_LANGS, type Lang } from "./i18n";

export const abs = (path: string) => `${SITE_URL}${path}`;

export const homePath = (lang: Lang) => `/${lang}`;
export const hubPath = (lang: Lang, slug: string) => `/${lang}/${slug}`;
export const landingPath = (lang: Lang, profSlug: string, citySlug: string) =>
  `/${lang}/${profSlug}/${citySlug}`;
export const masterPath = (lang: Lang, slug: string) => `/${lang}/m/${slug}`;

// Default social card for every page that doesn't render its own (home, about,
// faq, privacy, city, category). Next's file-convention opengraph-image
// (app/opengraph-image.png) only attaches to root-level routes — it does NOT
// cascade into the [lang] tree — and a page's own openGraph object shallow-
// overrides the layout's, so each fallback page must reference this explicitly.
// Served by the file-convention route at /opengraph-image.png.
export const DEFAULT_OG_IMAGE = {
  url: abs("/opengraph-image.png"),
  width: 1200,
  height: 630,
  alt: "Majstr — каталог майстрів в Італії",
};

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
