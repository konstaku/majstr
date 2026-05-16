import { z } from "zod";

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

// ─── Per-step zod schemas (used to gate PrimaryCTA + trigger errors on Next) ───

export const STEP_SCHEMAS = [
  // Step 1 — Profile
  z.object({
    name: z
      .string()
      .min(2, "Мінімум 2 символи")
      .max(25, "Максимум 25 символів")
      .regex(/\S/, "Обовʼязкове поле"),
  }),
  // Step 2 — Profession
  z.object({
    professionID: z.string().min(1, "Обовʼязкове поле"),
    languages: z.array(z.string()).min(1, "Оберіть хоча б одну мову"),
  }),
  // Step 3 — Location
  z.object({
    locationID: z.string().min(1, "Обовʼязкове поле"),
  }),
  // Step 4 — Bio & Tags (B4 fills in)
  z.object({
    about: z.string().min(30, "Мінімум 30 символів").max(600, "Максимум 600 символів"),
    tags: z
      .array(z.object({ value: z.string(), label: z.string() }))
      .min(1, "Вкажіть хоча б одну послугу"),
  }),
  // Step 5 — Contact (B5 fills in)
  z.object({}).passthrough(),
] as const;

// Fields to pass to form.trigger() when the user taps Next on each step.
export const STEP_TRIGGER_FIELDS: Array<Array<keyof DraftData>> = [
  ["name"],
  ["professionID", "languages"],
  ["locationID"],
  ["about", "tags"],
  ["telephone", "instagram", "telegram"],
];

export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: "ua", label: "🇺🇦 UA" },
  { code: "it", label: "🇮🇹 IT" },
  { code: "en", label: "🇬🇧 EN" },
  { code: "ru", label: "🇷🇺 RU" },
  { code: "pl", label: "🇵🇱 PL" },
  { code: "de", label: "🇩🇪 DE" },
  { code: "fr", label: "🇫🇷 FR" },
  { code: "es", label: "🇪🇸 ES" },
];

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
