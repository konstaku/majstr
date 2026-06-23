import type { Dataset } from "./data";
import type { Lang } from "./i18n";
import type { Master } from "./api";

export interface SeedSearchParams {
  selectedCity?: string;
  selectedProfession?: string;
  selectedProfessionCategory?: string;
}

// Only these fields are read from the grid/cards in the SPA. The heavy fields —
// `about` (long bios) and `contacts` (PII) — are stripped here and fetched
// lazily when a master's modal opens (GET /api/master/[id]). Dropping them cuts
// the per-page hydration payload from ~400 KB to a fraction, which is the single
// biggest mobile-load win on the site.
type SlimMaster = Pick<
  Master,
  | "_id"
  | "name"
  | "professionID"
  | "countryID"
  | "locationID"
  | "languages"
  | "photo"
  | "tags"
  | "verified"
  | "claimable"
>;

function slimMaster(m: Master): SlimMaster {
  return {
    _id: m._id,
    name: m.name,
    professionID: m.professionID,
    countryID: m.countryID,
    locationID: m.locationID,
    languages: m.languages,
    photo: m.photo,
    tags: m.tags,
    // Needed by the grid: VERIFIED badge + verified-first ordering.
    verified: m.verified,
    // Needed by the modal: the logged-out "claim this card" CTA renders on any
    // claimable (unowned, scraped) card — the self-Googling-master acquisition path.
    claimable: m.claimable,
  };
}

// Seed the MasterContext for a page. Seeds a SLIM projection of every master
// (enough for the grid, filters, and selects) plus the URL-derived filter state,
// so the first server render already shows the filtered grid for crawlers.
//
// `fullMasterId` keeps that one master's full record (about + contacts) in the
// seed — used by the master detail page so its pre-opened modal renders complete
// in the initial HTML with no client fetch.
export function buildSeed(
  lang: Lang,
  ds: Dataset,
  sp?: SeedSearchParams,
  fullMasterId?: string,
  country = "IT"
): Record<string, unknown> {
  const masters = ds.masters.map((m) =>
    m._id === fullMasterId ? m : slimMaster(m)
  );
  return {
    masters,
    professions: ds.professions,
    locations: ds.locations,
    profCategories: ds.profCategories,
    countries: ds.countries,
    lang,
    loading: false,
    countryID: country,
    countrySet: true,
    searchParams: {
      selectedCity: sp?.selectedCity ?? "",
      selectedProfession: sp?.selectedProfession ?? "",
      selectedProfessionCategory: sp?.selectedProfessionCategory ?? "",
    },
  };
}
