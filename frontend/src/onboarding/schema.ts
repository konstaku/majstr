// Single source of truth for wizard form shape.
// Matches the backend PATCH whitelist in routes/draft.js.
export interface DraftData {
  name: string;
  professionID: string;
  locationID: string;
  countryID: string;
  about: string;
  photo: string;
  languages: string[];
  tags: { value: string; label: string }[];
  telephone: string;
  isTelephone: boolean;
  isWhatsapp: boolean;
  isViber: boolean;
  instagram: string;
  telegram: string;
}

export const DRAFT_DEFAULTS: DraftData = {
  name: "",
  professionID: "",
  locationID: "",
  countryID: "IT",
  about: "",
  photo: "",
  languages: [],
  tags: [],
  telephone: "",
  isTelephone: true,
  isWhatsapp: false,
  isViber: false,
  instagram: "",
  telegram: "",
};

// Map a raw server draft document onto DraftData for useForm.reset().
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serverDraftToForm(draft: Record<string, any>): Partial<DraftData> {
  return {
    name: draft.name ?? "",
    professionID: draft.professionID ?? "",
    locationID: draft.locationID ?? "",
    countryID: draft.countryID ?? "IT",
    about: draft.about ?? "",
    photo: draft.photo ?? "",
    languages: Array.isArray(draft.languages) ? draft.languages : [],
    // tags on server: { ua: string[] }; form expects { value, label }[]
    tags: Array.isArray(draft.tags?.ua)
      ? draft.tags.ua.map((t: string) => ({ value: t, label: t }))
      : [],
    telephone: "",
    isTelephone: true,
    isWhatsapp: false,
    isViber: false,
    instagram: "",
    telegram: "",
  };
}
