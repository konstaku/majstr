import type { MetadataRoute } from "next";
import {
  getDataset,
  landingCombos,
  professionSlug,
  masterSlug,
} from "@/lib/data";
import { LANGS, type Lang } from "@/lib/i18n";
import { abs, homePath, hubPath, landingPath, masterPath } from "@/lib/urls";

export const revalidate = 3600;

const langAlt = (build: (l: Lang) => string) =>
  Object.fromEntries(LANGS.map((l) => [l, abs(build(l))]));

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { masters, profById, locById } = await getDataset();
  const entries: MetadataRoute.Sitemap = [];

  for (const lang of LANGS)
    entries.push({
      url: abs(homePath(lang)),
      changeFrequency: "daily",
      priority: 1,
      alternates: { languages: langAlt(homePath) },
    });

  // City hubs
  for (const id of new Set(masters.map((m) => m.locationID))) {
    if (!locById.get(id)) continue;
    for (const lang of LANGS)
      entries.push({
        url: abs(hubPath(lang, id)),
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: { languages: langAlt((l) => hubPath(l, id)) },
      });
  }
  // Profession hubs
  for (const id of new Set(masters.map((m) => m.professionID))) {
    const p = profById.get(id);
    if (!p) continue;
    for (const lang of LANGS)
      entries.push({
        url: abs(hubPath(lang, professionSlug(p.id, lang))),
        changeFrequency: "weekly",
        priority: 0.6,
        alternates: {
          languages: langAlt((l) => hubPath(l, professionSlug(p.id, l))),
        },
      });
  }
  // Landing pages (profession × city)
  for (const c of landingCombos(masters)) {
    const p = profById.get(c.professionID);
    const loc = locById.get(c.locationID);
    if (!p || !loc) continue;
    for (const lang of LANGS)
      entries.push({
        url: abs(landingPath(lang, professionSlug(p.id, lang), loc.id)),
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: {
          languages: langAlt((l) =>
            landingPath(l, professionSlug(p.id, l), loc.id)
          ),
        },
      });
  }
  // Master pages
  for (const m of masters) {
    const p = profById.get(m.professionID);
    const loc = locById.get(m.locationID);
    const slug = masterSlug(m, p, loc);
    for (const lang of LANGS)
      entries.push({
        url: abs(masterPath(lang, slug)),
        lastModified: m.updatedAt ? new Date(m.updatedAt) : undefined,
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: { languages: langAlt((l) => masterPath(l, slug)) },
      });
  }

  return entries;
}
