import { z } from "zod";

// Single source of truth for wizard form shape.
// Matches the backend PATCH whitelist in routes/draft.js.
export interface Contact {
  contactType: string; // 'phone' | 'telegram' | 'instagram'
  value: string;
}

export interface DraftData {
  name: string;
  professionID: string;
  locationID: string;
  countryID: string;
  about: string;
  photo: string;
  languages: string[];
  tags: { value: string; label: string }[];
  contacts: Contact[];
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
  contacts: [],
};

const PHONE_RE = /^\+?[0-9 ()-]{7,20}$/;

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
  // Step 5 — Contact
  z.object({
    contacts: z
      .array(z.object({ contactType: z.string(), value: z.string() }))
      .refine(
        (arr) =>
          arr.some(
            (c) => c.contactType === "phone" && PHONE_RE.test(c.value.trim())
          ),
        "Вкажіть коректний номер телефону"
      ),
  }),
] as const;

// Fields to pass to form.trigger() when the user taps Next on each step.
export const STEP_TRIGGER_FIELDS: Array<Array<keyof DraftData>> = [
  ["name"],
  ["professionID", "languages"],
  ["locationID"],
  ["about", "tags"],
  ["contacts"],
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
    contacts: Array.isArray(draft.contacts)
      ? draft.contacts.map((c: { contactType?: string; value?: string }) => ({
          contactType: c.contactType ?? "",
          value: c.value ?? "",
        }))
      : [],
  };
}

// Transform a partial FORM diff into the server PATCH shape.
// Server stores tags as { ua: string[] }; the form models them as
// { value, label }[]. Everything else passes through unchanged.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formToServerPatch(diff: Partial<DraftData>): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: Record<string, any> = { ...diff };
  if (diff.tags !== undefined) {
    out.tags = { ua: diff.tags.map((t) => t.label) };
  }
  return out;
}
