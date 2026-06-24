import { cache } from "react";
import {
  getApprovedMasters,
  getLocations,
  getProfessions,
  getProfCategories,
  getCountries,
  getCommunities,
  type Location,
  type Profession,
  type Master,
  type ProfCategory,
  type Community,
} from "./api";
import { nomName, type Lang } from "./i18n";
import { PROFESSION_SEO, CITY_PREP } from "./seo-data";

// ── Transliteration for master-page slugs (UK + RU Cyrillic → latin) ──────────
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ё: "e",
  ж: "zh", з: "z", и: "y", і: "i", ї: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh",
  ц: "ts", ч: "ch", ш: "sh", щ: "shch", ъ: "", ы: "y", ь: "", э: "e",
  ю: "yu", я: "ya",
};

export function slugify(input: string): string {
  const latin = (input || "")
    .toLowerCase()
    .split("")
    .map((c) => (c in TRANSLIT ? TRANSLIT[c] : c))
    .join("");
  return latin
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── Dataset (cached per render/build; ISR-refreshed via fetch revalidate) ─────
export interface Dataset {
  masters: Master[];
  locById: Map<string, Location>;
  profById: Map<string, Profession>;
  professions: Profession[];
  locations: Location[];
  profCategories: ProfCategory[];
  countries: unknown[];
  communities: Community[];
}

export const getDataset = cache(async (country = "IT"): Promise<Dataset> => {
  const [masters, locations, professions, profCategories, countries, communities] =
    await Promise.all([
      getApprovedMasters(country),
      getLocations(country),
      getProfessions(),
      getProfCategories(),
      getCountries(),
      getCommunities(),
    ]);
  return {
    masters,
    locations,
    professions,
    profCategories,
    countries,
    communities,
    locById: new Map(locations.map((l) => [l.id, l])),
    profById: new Map(professions.map((p) => [p.id, p])),
  };
});

// ── Slug + label helpers ──────────────────────────────────────────────────────
export function professionSlug(profId: string, lang: Lang): string {
  return PROFESSION_SEO[profId]?.[lang]?.slug ?? profId;
}
export function professionLead(prof: Profession, lang: Lang): string {
  return PROFESSION_SEO[prof.id]?.[lang]?.lead ?? nomName(prof.name, lang);
}
export function professionSub(profId: string, lang: Lang): string | undefined {
  return PROFESSION_SEO[profId]?.[lang]?.sub;
}
export function cityNom(loc: Location, lang: Lang): string {
  return nomName(loc.name, lang);
}
export function cityPrep(loc: Location, lang: Lang): string {
  const fixed = CITY_PREP[loc.id]?.[lang];
  if (fixed) return fixed;
  // English has no prepositional case — "in <City>".
  if (lang === "en") return `in ${nomName(loc.name, "en")}`.trim();
  const alt =
    lang === "ru"
      ? loc.name.ru_alt ?? loc.name.ru
      : loc.name.ua_alt ?? loc.name.ua;
  return `${lang === "ru" ? "в" : "у"} ${alt ?? nomName(loc.name, lang)}`.trim();
}

// Master-page slug is language-independent (one canonical URL per master):
//   <translit-name>-<professionId>-<cityId>-<id6>
export function masterSlug(
  m: { _id: string; name: string; professionID?: string; locationID?: string },
  prof?: { id: string },
  loc?: { id: string }
): string {
  const name = slugify(m.name) || "master";
  return `${name}-${prof?.id ?? m.professionID}-${loc?.id ?? m.locationID}-${m._id.slice(-6)}`;
}

// ── Resolution (slug → entity) ────────────────────────────────────────────────
export function resolveProfessionBySlug(
  slug: string,
  lang: Lang,
  professions: Profession[]
): Profession | undefined {
  return (
    professions.find((p) => professionSlug(p.id, lang) === slug) ??
    professions.find((p) => p.id === slug)
  );
}
export function resolveCityBySlug(
  slug: string,
  locations: Location[]
): Location | undefined {
  return locations.find((l) => l.id === slug);
}

// ── Aggregations ──────────────────────────────────────────────────────────────
export interface Combo {
  professionID: string;
  locationID: string;
  count: number;
}

export function landingCombos(masters: Master[]): Combo[] {
  const counts = new Map<string, number>();
  for (const m of masters) {
    const k = `${m.professionID}__${m.locationID}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([k, count]) => {
    const [professionID, locationID] = k.split("__");
    return { professionID, locationID, count };
  });
}

export function mastersFor(
  masters: Master[],
  professionID: string,
  locationID: string
): Master[] {
  return masters
    .filter((m) => m.professionID === professionID && m.locationID === locationID)
    .sort(masterRank);
}

export function mastersInCity(masters: Master[], locationID: string): Master[] {
  return masters.filter((m) => m.locationID === locationID).sort(masterRank);
}
export function mastersOfProfession(
  masters: Master[],
  professionID: string
): Master[] {
  return masters.filter((m) => m.professionID === professionID).sort(masterRank);
}

export function professionsInCity(
  masters: Master[],
  locationID: string
): Array<{ professionID: string; count: number }> {
  const c = new Map<string, number>();
  for (const m of masters)
    if (m.locationID === locationID)
      c.set(m.professionID, (c.get(m.professionID) ?? 0) + 1);
  return [...c]
    .map(([professionID, count]) => ({ professionID, count }))
    .sort((a, b) => b.count - a.count);
}
export function citiesOfProfession(
  masters: Master[],
  professionID: string
): Array<{ locationID: string; count: number }> {
  const c = new Map<string, number>();
  for (const m of masters)
    if (m.professionID === professionID)
      c.set(m.locationID, (c.get(m.locationID) ?? 0) + 1);
  return [...c]
    .map(([locationID, count]) => ({ locationID, count }))
    .sort((a, b) => b.count - a.count);
}

// Rank: rated/claimed first, then more reviews, then newer.
function masterRank(a: Master, b: Master): number {
  // Owner-verified cards always rank first.
  const av = a.verified ? 1 : 0;
  const bv = b.verified ? 1 : 0;
  if (bv !== av) return bv - av;
  const ar = a.rating ?? -1;
  const br = b.rating ?? -1;
  if (br !== ar) return br - ar;
  const arc = a.reviewCount ?? 0;
  const brc = b.reviewCount ?? 0;
  if (brc !== arc) return brc - arc;
  return (b.createdAt ?? "").localeCompare(a.createdAt ?? "");
}

// ── Master lookup by slug ─────────────────────────────────────────────────────
export async function findMasterBySlug(slug: string, country = "IT") {
  const { masters, profById, locById } = await getDataset(country);
  const id6 = slug.split("-").pop() ?? "";
  if (id6.length !== 6) return null;
  const master = masters.find((m) => m._id.slice(-6) === id6);
  if (!master) return null;
  const prof = profById.get(master.professionID);
  const loc = locById.get(master.locationID);
  return { master, prof, loc, canonical: masterSlug(master, prof, loc) };
}

export async function allMasterParams(country = "IT"): Promise<{ slug: string }[]> {
  const { masters, profById, locById } = await getDataset(country);
  return masters.map((m) => ({
    slug: masterSlug(m, profById.get(m.professionID), locById.get(m.locationID)),
  }));
}

// ── Category helpers (filter dimension = profession category) ─────────────────
export function resolveCategoryBySlug(
  slug: string,
  cats: ProfCategory[]
): ProfCategory | undefined {
  return cats.find((c) => c.id === slug);
}

export function categoryIdOfProfession(
  professionID: string,
  professions: Profession[]
): string | undefined {
  return professions.find((p) => p.id === professionID)?.categoryID;
}

// Distinct (city, category) pairs that have ≥1 master, with counts.
export function cityCategoryCombos(
  masters: Master[],
  professions: Profession[]
): Array<{ locationID: string; categoryID: string; count: number }> {
  const profCat = new Map(professions.map((p) => [p.id, p.categoryID]));
  const counts = new Map<string, number>();
  for (const m of masters) {
    const cat = profCat.get(m.professionID);
    if (!cat) continue;
    const k = `${m.locationID}__${cat}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts].map(([k, count]) => {
    const [locationID, categoryID] = k.split("__");
    return { locationID, categoryID, count };
  });
}

export function categoriesWithMasters(
  masters: Master[],
  professions: Profession[]
): Set<string> {
  const profCat = new Map(professions.map((p) => [p.id, p.categoryID]));
  const set = new Set<string>();
  for (const m of masters) {
    const c = profCat.get(m.professionID);
    if (c) set.add(c);
  }
  return set;
}
