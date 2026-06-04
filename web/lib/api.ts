import { cache } from "react";
import { API_BASE, REVALIDATE_SECONDS } from "./config";

// ── Live API types (shapes observed from api.majstr.xyz) ──────────────────────
// Note: localized name objects use `ua` (not `uk`) and carry prepositional
// variants `ua_alt` / `ru_alt` (e.g. Milan → ru_alt "Милане").

export interface LocName {
  en?: string;
  ua?: string;
  ua_alt?: string;
  ru?: string;
  ru_alt?: string;
  it?: string;
  [k: string]: string | undefined;
}

export interface Location {
  _id: string;
  id: string;
  countryID?: string;
  provinceID?: string;
  name: LocName;
}

export interface Profession {
  _id: string;
  id: string;
  categoryID?: string;
  name: LocName;
}

export interface Country {
  _id: string;
  id: string;
  flag?: string;
  name: LocName;
}

export interface Contact {
  contactType: string;
  value: string;
}

export interface Master {
  _id: string;
  name: string;
  professionID: string;
  countryID: string;
  locationID: string;
  contacts?: Contact[];
  about?: string;
  OGimage?: string;
  rating?: number | null;
  reviewCount?: number;
  likes?: number;
  approved?: boolean;
  status?: string;
  claimable?: boolean;
  source?: string;
  tags?: { ua?: string[]; en?: string[]; ru?: string[] };
  createdAt?: string;
  updatedAt?: string;
}

// Shared cache tag so an approval webhook can refresh every data-derived page
// at once via revalidateTag("majstr-data").
export const DATA_TAG = "majstr-data";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    next: { revalidate: REVALIDATE_SECONDS, tags: [DATA_TAG] },
  });
  if (!res.ok) throw new Error(`API ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

// `cache()` dedupes within a single render/build pass; `next.revalidate`
// keeps the data fresh across requests via ISR.
export const getApprovedMasters = cache(async (): Promise<Master[]> => {
  const all = await getJSON<Master[]>("/?q=masters");
  return all.filter((m) => m.approved);
});

export const getLocations = cache(() =>
  getJSON<Location[]>("/api/reference/locations")
);
export const getProfessions = cache(() =>
  getJSON<Profession[]>("/api/reference/professions")
);
export const getCountries = cache(() =>
  getJSON<Country[]>("/api/reference/countries")
);
