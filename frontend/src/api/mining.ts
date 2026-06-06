// Mining review + reference-admin API client. Calls the M3 endpoints shipped
// in backend/routes/{miningReview,referenceAdmin}.js. All endpoints are
// admin-gated server-side; this client assumes the caller is already an admin
// (the page guards on user.isAdmin before mounting).

import { apiFetch } from "./client";

// ---------------------------------------------------------------------------
// Types — mirror the server payloads exactly. Multi-lang `name` covers every
// language the underlying schemas support; the dashboard form only edits the
// big four (UA / RU / EN / IT) but tolerates more on read.

export type LangCode =
  | "ua"
  | "en"
  | "ru"
  | "it"
  | "pt"
  | "de"
  | "fr"
  | "tr"
  | "es"
  | "ua_alt"
  | "ru_alt";

export type LocalizedName = Partial<Record<LangCode, string>>;

export interface ProfCategory {
  _id?: string;
  id: string;
  name: LocalizedName;
}

export interface Profession {
  _id?: string;
  id: string;
  categoryID: string;
  name: LocalizedName;
}

export interface CountryRef {
  _id?: string;
  id: string;
  name: LocalizedName;
  flag?: string;
}

export interface LocationRef {
  _id?: string;
  id: string;
  countryID: string;
  name: LocalizedName;
}

export type CandidateStatus = "raw" | "new" | "accepted" | "declined" | "carded";
export type CandidateKind = "recommendation" | "announcement" | "unknown";

export interface CandidateContact {
  contactType: string;
  value: string;
}

export interface CandidateTags {
  ua: string[];
  en: string[];
}

export interface CandidateExtracted {
  name?: string | null;
  profession?: string | null;
  city?: string | null;
  contacts?: CandidateContact[];
  description?: string | null;
  tags?: CandidateTags;
}

export type CandidateSourceType = "thread_answer" | "announcement" | "forwarded";

export interface CandidateSubmitter {
  telegramID: number | null;
  name: string | null;
  isAdmin: boolean;
}

// A live master that shares a contact with this candidate (likely duplicate).
export interface DuplicateMaster {
  id: string;
  name: string | null;
  professionID: string | null;
  locationID: string | null;
  status: string;
  source: string;
  claimable: boolean;
  contacts: CandidateContact[];
}

export interface MiningCandidate {
  id: string;
  chatID: string;
  kind: CandidateKind;
  score: number;
  status: CandidateStatus;
  declineReason: string | null;
  sourceType: CandidateSourceType;
  anchorMessageID: number;
  messageIDs: number[];
  inquiryMessageID: number | null;
  inquiryText: string | null;
  responderName: string | null;
  text: string;
  // null for forwarded leads with no linkable origin (synthetic chat id).
  tgLink: string | null;
  // Forwarded-lead provenance (null on auto-mined candidates).
  submittedBy: CandidateSubmitter | null;
  originChatTitle: string | null;
  reviewPriority: number;
  // Live masters already sharing a contact with this candidate (server-annotated).
  duplicateMasters: DuplicateMaster[];
  // Forwarded screenshots (S3 URLs) + OCR text filled at process time.
  images: { url: string; ocrText: string | null }[];
  // Set when a raw forward has been run through the local LLM.
  processedAt: string | null;
  extracted: CandidateExtracted;
  classifierName: string;
  classifierVersion: string;
  masterRef: string | null;
  suggestProfessionID: string;
  suggestLocationID: string;
  createdAt: string;
  updatedAt: string;
}

export interface CandidateListResponse {
  page: number;
  pageSize: number;
  total: number;
  queueDepth: number;
  candidates: MiningCandidate[];
}

export const DECLINE_REASONS = [
  "not_a_master",
  "spam",
  "duplicate",
  "wrong_extraction",
  "out_of_scope",
  "other",
] as const;
export type DeclineReason = (typeof DECLINE_REASONS)[number];

export interface MasterPayload {
  name: string;
  professionID: string;
  locationID: string;
  countryID?: string;
  contacts: CandidateContact[];
  about?: string;
  tags?: CandidateTags;
}

// ---------------------------------------------------------------------------
// Small helper that throws on non-2xx so callers can `try { ... } catch`.

async function asJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof data.error === "string"
        ? data.error
        : `HTTP ${res.status} ${res.statusText}`;
    throw Object.assign(new Error(msg), { status: res.status, body: data });
  }
  return data as T;
}

// ---------------------------------------------------------------------------
// Candidate queue + actions (#93 / #94)

export interface ListParams {
  status?: CandidateStatus;
  kind?: CandidateKind;
  page?: number;
  pageSize?: number;
  sort?: "score" | "created";
}

export async function listCandidates(
  params: ListParams = {}
): Promise<CandidateListResponse> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") q.set(k, String(v));
  }
  const res = await apiFetch(`/api/mining/candidates?${q.toString()}`);
  return asJson<CandidateListResponse>(res);
}

export async function acceptCandidate(
  id: string,
  master: MasterPayload,
  // force=true publishes despite a duplicate_master 409.
  force = false
): Promise<{ ok: true; masterID: string; candidateID: string }> {
  const res = await apiFetch(`/api/mining/candidates/${id}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ master, force }),
  });
  return asJson(res);
}

export async function declineCandidate(
  id: string,
  reasonCode: DeclineReason,
  note?: string
): Promise<{ ok: true; candidateID: string; status: "declined" }> {
  const res = await apiFetch(`/api/mining/candidates/${id}/decline`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reasonCode, note }),
  });
  return asJson(res);
}

// ---------------------------------------------------------------------------
// Reference data — read live so newly-created entries appear immediately.

export async function fetchProfessions(): Promise<Profession[]> {
  const res = await apiFetch("/api/reference/professions");
  return asJson<Profession[]>(res);
}
export async function fetchProfCategories(): Promise<ProfCategory[]> {
  const res = await apiFetch("/api/reference/prof-categories");
  return asJson<ProfCategory[]>(res);
}
export async function fetchLocations(): Promise<LocationRef[]> {
  const res = await apiFetch("/api/reference/locations");
  return asJson<LocationRef[]>(res);
}
export async function fetchCountries(): Promise<CountryRef[]> {
  const res = await apiFetch("/api/reference/countries");
  return asJson<CountryRef[]>(res);
}

// ---------------------------------------------------------------------------
// Reference-admin (#116) — inline-create from the review dashboard.

export interface CreateProfessionInput {
  id?: string;
  categoryID: string;
  name: LocalizedName;
}
export async function createProfession(
  input: CreateProfessionInput
): Promise<Profession> {
  const res = await apiFetch("/api/reference/professions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson<Profession>(res);
}

export interface CreateProfCategoryInput {
  id?: string;
  name: LocalizedName;
}
export async function createProfCategory(
  input: CreateProfCategoryInput
): Promise<ProfCategory> {
  const res = await apiFetch("/api/reference/prof-categories", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson<ProfCategory>(res);
}

export interface CreateLocationInput {
  id?: string;
  countryID: string;
  name: LocalizedName;
}
export async function createLocation(
  input: CreateLocationInput
): Promise<LocationRef> {
  const res = await apiFetch("/api/reference/locations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return asJson<LocationRef>(res);
}

// ---------------------------------------------------------------------------
// Lexicon rebuild — explicit endpoint, single-flight on the server.

export interface RebuildResult {
  ok: true;
  professions: number;
  terms: number;
  generatedAt: string;
  ms: number;
}
export async function rebuildLexicon(): Promise<RebuildResult> {
  const res = await apiFetch("/api/admin/lexicon/rebuild", { method: "POST" });
  return asJson<RebuildResult>(res);
}

// ---------------------------------------------------------------------------
// Small UI helper: best name in the admin's preferred order.

export function pickName(
  n: LocalizedName | undefined,
  prefer: LangCode[] = ["en", "ua", "ru", "it"]
): string {
  if (!n) return "";
  for (const l of prefer) {
    const v = n[l];
    if (v && v.trim()) return v;
  }
  for (const v of Object.values(n)) {
    if (v && v.trim()) return v;
  }
  return "";
}
