import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";

export interface Profession {
  _id: string;
  id: string;
  categoryID: string;
  name: { ua: string; en: string };
}

export interface ProfCategory {
  _id: string;
  id: string;
  name: { ua: string; en: string };
}

export interface Location {
  _id: string;
  id: string;
  countryID?: string;
  name: { ua: string; en: string; ua_alt?: string; ru?: string };
}

interface RefData {
  professions: Profession[];
  profCategories: ProfCategory[];
  locations: Location[];
}

// Module-level cache — only one fetch per session regardless of remounts.
let cache: RefData | null = null;
const listeners: Array<(d: RefData) => void> = [];

function fetchAll() {
  Promise.all([
    apiFetch("/api/reference/professions", undefined, { redirectOn401: false }).then((r) =>
      r.ok ? r.json() : []
    ),
    apiFetch("/api/reference/prof-categories", undefined, { redirectOn401: false }).then((r) =>
      r.ok ? r.json() : []
    ),
    apiFetch("/api/reference/locations", undefined, { redirectOn401: false }).then((r) =>
      r.ok ? r.json() : []
    ),
  ])
    .then(([professions, profCategories, locations]) => {
      cache = { professions, profCategories, locations };
      listeners.forEach((fn) => fn(cache!));
      listeners.length = 0;
    })
    .catch(() => {});
}

export function useReferenceData(): RefData & { loading: boolean } {
  const [data, setData] = useState<RefData | null>(cache);

  useEffect(() => {
    if (cache) {
      setData(cache);
      return;
    }
    listeners.push(setData);
    if (listeners.length === 1) fetchAll();
    return () => {
      const idx = listeners.indexOf(setData);
      if (idx !== -1) listeners.splice(idx, 1);
    };
  }, []);

  return {
    professions: data?.professions ?? [],
    profCategories: data?.profCategories ?? [],
    locations: data?.locations ?? [],
    loading: !data,
  };
}
