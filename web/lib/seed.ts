import type { Dataset } from "./data";
import type { Lang } from "./i18n";

// Build the MasterContext seed for a page. Pass a `masters` subset to keep the
// embedded payload small on landing/master pages (home seeds all for its filter).
export function buildSeed(
  lang: Lang,
  ds: Dataset,
  masters?: unknown[]
): Record<string, unknown> {
  return {
    masters: masters ?? ds.masters,
    professions: ds.professions,
    locations: ds.locations,
    profCategories: ds.profCategories,
    countries: ds.countries,
    lang,
    loading: false,
    countryID: "IT",
    countrySet: true,
  };
}
