import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import {
  getDataset,
  cityCategoryCombos,
  categoriesWithMasters,
  masterSlug,
} from "@/lib/data";
import { INDEXED_LANGS, countryForHost, countryID, type Lang } from "@/lib/i18n";
import { abs, homePath, masterPath } from "@/lib/urls";

export const revalidate = 3600;

// Host-aware: each public host serves its own country's sitemap. The Host header
// picks the country (majstr.xyz → IT, fr.majstr.xyz → FR); every URL is emitted
// on that country's origin so the sitemap stays single-host (no cross-host URLs).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const host = (await headers()).get("host") || "";
  const country = countryForHost(host);
  const langAlt = (build: (l: Lang) => string) =>
    Object.fromEntries(INDEXED_LANGS.map((l) => [l, abs(build(l), country)]));

  const { masters, professions, locById, profById } = await getDataset(
    countryID(country)
  );
  const entries: MetadataRoute.Sitemap = [];

  // Home
  for (const lang of INDEXED_LANGS)
    entries.push({
      url: abs(homePath(lang), country),
      changeFrequency: "daily",
      priority: 1,
      alternates: { languages: langAlt(homePath) },
    });

  // City pages (/{lang}/{city})
  for (const id of new Set(masters.map((m) => m.locationID))) {
    if (!locById.get(id)) continue;
    for (const lang of INDEXED_LANGS)
      entries.push({
        url: abs(`/${lang}/${id}`, country),
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: { languages: langAlt((l) => `/${l}/${id}`) },
      });
  }

  // Category pages (/{lang}/{category})
  for (const c of categoriesWithMasters(masters, professions)) {
    for (const lang of INDEXED_LANGS)
      entries.push({
        url: abs(`/${lang}/${c}`, country),
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: { languages: langAlt((l) => `/${l}/${c}`) },
      });
  }

  // City × category pages (/{lang}/{city}/{category}) — the main SEO surface
  for (const combo of cityCategoryCombos(masters, professions)) {
    if (!locById.get(combo.locationID)) continue;
    const path = (l: Lang) => `/${l}/${combo.locationID}/${combo.categoryID}`;
    for (const lang of INDEXED_LANGS)
      entries.push({
        url: abs(path(lang), country),
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: { languages: langAlt(path) },
      });
  }

  // Master pages (/{lang}/m/{slug})
  for (const m of masters) {
    const slug = masterSlug(m, profById.get(m.professionID), locById.get(m.locationID));
    for (const lang of INDEXED_LANGS)
      entries.push({
        url: abs(masterPath(lang, slug), country),
        lastModified: m.updatedAt ? new Date(m.updatedAt) : undefined,
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: { languages: langAlt((l) => masterPath(l, slug)) },
      });
  }

  return entries;
}
