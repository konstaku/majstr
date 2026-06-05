import type { Dataset } from "./data";
import type { Lang } from "./i18n";

export interface SeedSearchParams {
  selectedCity?: string;
  selectedProfession?: string;
  selectedProfessionCategory?: string;
}

// Seed the MasterContext for a page. Always seeds ALL masters + reference data
// (so the selects work exactly like the SPA), plus the filter state parsed from
// the URL so the very first server render already shows the filtered grid.
export function buildSeed(
  lang: Lang,
  ds: Dataset,
  sp?: SeedSearchParams
): Record<string, unknown> {
  return {
    masters: ds.masters,
    professions: ds.professions,
    locations: ds.locations,
    profCategories: ds.profCategories,
    countries: ds.countries,
    lang,
    loading: false,
    countryID: "IT",
    countrySet: true,
    searchParams: {
      selectedCity: sp?.selectedCity ?? "",
      selectedProfession: sp?.selectedProfession ?? "",
      selectedProfessionCategory: sp?.selectedProfessionCategory ?? "",
    },
  };
}
