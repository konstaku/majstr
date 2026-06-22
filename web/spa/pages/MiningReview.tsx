"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import useAuthenticateUser from "../custom-hooks/useAuthenticateUser";
import {
  acceptCandidate,
  declineCandidate,
  fetchCountries,
  fetchLocations,
  fetchProfCategories,
  fetchProfessions,
  listCandidates,
  pickName,
  rebuildLexicon,
  DECLINE_REASONS,
  type CandidateContact,
  type CountryRef,
  type DeclineReason,
  type LocationRef,
  type MasterPayload,
  type MiningCandidate,
  type ProfCategory,
  type Profession,
  type CandidateKind,
  type DuplicateMaster,
} from "../api/mining";
import {
  CreateLocationModal,
  CreateProfessionModal,
} from "../components/mining/InlineCreate";
import "../components/mining/mining.css";

// One-page review workflow: same loop as scripts/mine-review.js, exposed as
// a real admin UI. Loads the `new` queue + reference data on mount, walks
// candidates one at a time, and on Accept publishes a live Master via the
// API. Inline-create flows for profession / city / category route through
// the reference-admin endpoints (#116). The lexicon-rebuild button calls the
// explicit rebuild endpoint after a batch of creates.

const CONTACT_TYPES = ["phone", "telegram", "instagram", "whatsapp", "viber", "other"];

interface FormState {
  name: string;
  professionID: string;
  locationID: string;
  contacts: CandidateContact[];
  about: string;
  // Tags edited as comma-separated strings; split into arrays on submit.
  tagsUa: string;
  tagsEn: string;
}

function emptyForm(): FormState {
  return {
    name: "",
    professionID: "",
    locationID: "",
    contacts: [],
    about: "",
    tagsUa: "",
    tagsEn: "",
  };
}

// "a, b , c" -> ["a","b","c"]; arrays -> trimmed/filtered.
function splitTags(s: string): string[] {
  return s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

function formFromCandidate(c: MiningCandidate): FormState {
  const tags = c.extracted.tags || { ua: [], en: [] };
  return {
    name: (c.extracted.name || c.responderName || "").trim(),
    professionID: c.suggestProfessionID || "",
    locationID: c.suggestLocationID || "",
    contacts: (c.extracted.contacts || []).map((x) => ({
      contactType: x.contactType,
      value: x.value,
    })),
    about: (c.extracted.description || "").trim(),
    tagsUa: (tags.ua || []).join(", "),
    tagsEn: (tags.en || []).join(", "),
  };
}

export default function MiningReview() {
  const auth = useAuthenticateUser();
  const router = useRouter();

  const [candidates, setCandidates] = useState<MiningCandidate[]>([]);
  const [queueDepth, setQueueDepth] = useState(0);
  const [total, setTotal] = useState(0);
  const [idx, setIdx] = useState(0);
  const [kindFilter, setKindFilter] = useState<CandidateKind | "">("");
  const [sort, setSort] = useState<"score" | "created">("score");

  const [professions, setProfessions] = useState<Profession[]>([]);
  const [categories, setCategories] = useState<ProfCategory[]>([]);
  const [locations, setLocations] = useState<LocationRef[]>([]);
  const [countries, setCountries] = useState<CountryRef[]>([]);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the server blocks an accept with duplicate_master (409); holds the
  // conflicting live masters and unlocks the "publish anyway" override.
  const [dupConflict, setDupConflict] = useState<DuplicateMaster[] | null>(null);

  const [showCreateProfession, setShowCreateProfession] = useState(false);
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [showDecline, setShowDecline] = useState(false);
  const [rebuildBusy, setRebuildBusy] = useState(false);
  const [rebuildMsg, setRebuildMsg] = useState<string | null>(null);

  const [counters, setCounters] = useState({ accepted: 0, declined: 0, skipped: 0 });

  // Hard-gate: only admins can mount this page. A logged-out / non-admin user
  // gets bounced to / so they aren't sitting on a forbidden screen.
  useEffect(() => {
    if (auth.loading) return;
    if (!auth.user || !auth.user.isAdmin) router.replace("/");
  }, [auth, router]);

  // Initial load.
  const loadQueue = useCallback(async () => {
    try {
      const r = await listCandidates({ kind: kindFilter || undefined, sort });
      setCandidates(r.candidates);
      setQueueDepth(r.queueDepth);
      setTotal(r.total);
      setIdx(0);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    }
  }, [kindFilter, sort]);

  const loadReference = useCallback(async () => {
    const [p, c, l, co] = await Promise.all([
      fetchProfessions(),
      fetchProfCategories(),
      fetchLocations(),
      fetchCountries(),
    ]);
    setProfessions(p);
    setCategories(c);
    setLocations(l);
    setCountries(co);
  }, []);

  useEffect(() => {
    if (!auth.user || !auth.user.isAdmin) return;
    void loadQueue();
    void loadReference();
  }, [auth.user, loadQueue, loadReference]);

  const current = candidates[idx] || null;

  // Reset the form whenever the candidate changes.
  useEffect(() => {
    setError(null);
    setDupConflict(null);
    setForm(current ? formFromCandidate(current) : emptyForm());
  }, [current]);

  const canSubmit =
    !!form.name.trim() &&
    !!form.professionID &&
    !!form.locationID &&
    form.contacts.some((c) => c.value.trim());

  function advance() {
    setIdx((i) => i + 1);
  }

  function buildPayload(): MasterPayload {
    const tagsUa = splitTags(form.tagsUa);
    const tagsEn = splitTags(form.tagsEn);
    return {
      name: form.name.trim(),
      professionID: form.professionID,
      locationID: form.locationID,
      countryID: "IT",
      about: form.about.trim() || undefined,
      contacts: form.contacts
        .map((c) => ({ contactType: c.contactType, value: c.value.trim() }))
        .filter((c) => c.value),
      ...(tagsUa.length || tagsEn.length
        ? { tags: { ua: tagsUa, en: tagsEn } }
        : {}),
    };
  }

  async function doAccept(force: boolean) {
    if (!current || !canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      await acceptCandidate(current.id, buildPayload(), force);
      setCounters((c) => ({ ...c, accepted: c.accepted + 1 }));
      setQueueDepth((q) => Math.max(0, q - 1));
      setDupConflict(null);
      advance();
    } catch (e: unknown) {
      // duplicate_master (409) is recoverable: surface the conflicts + offer
      // "publish anyway" instead of a generic error.
      const body = (e as { body?: { error?: string; duplicates?: DuplicateMaster[] } })
        .body;
      if (body?.error === "duplicate_master" && body.duplicates) {
        setDupConflict(body.duplicates);
      } else {
        setError(e instanceof Error ? e.message : "Accept failed");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(e: FormEvent) {
    e.preventDefault();
    await doAccept(false);
  }

  async function handleDecline(reasonCode: DeclineReason, note?: string) {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await declineCandidate(current.id, reasonCode, note);
      setCounters((c) => ({ ...c, declined: c.declined + 1 }));
      setQueueDepth((q) => Math.max(0, q - 1));
      setShowDecline(false);
      advance();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Decline failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRebuild() {
    setRebuildBusy(true);
    setRebuildMsg(null);
    try {
      const r = await rebuildLexicon();
      setRebuildMsg(
        `✓ Lexicon rebuilt: ${r.professions} professions → ${r.terms} terms (${r.ms} ms)`
      );
    } catch (e: unknown) {
      setRebuildMsg(
        "✗ Rebuild failed: " + (e instanceof Error ? e.message : "unknown error")
      );
    } finally {
      setRebuildBusy(false);
    }
  }

  // Reference data live in two collections that the admin can extend inline.
  // After a successful create, refresh the relevant list and select the new id.
  function handleCreatedProfession(p: Profession) {
    setProfessions((all) => [...all, p]);
    setForm((f) => ({ ...f, professionID: p.id }));
  }
  function handleCreatedLocation(l: LocationRef) {
    setLocations((all) => [...all, l]);
    setForm((f) => ({ ...f, locationID: l.id }));
  }
  function handleCreatedCategory(c: ProfCategory) {
    setCategories((all) => [...all, c]);
  }

  // ----- Render -----------------------------------------------------------

  if (auth.loading) {
    return <div className="mining-page"><p className="mining-empty">Authenticating…</p></div>;
  }
  if (!auth.user || !auth.user.isAdmin) {
    // The effect will redirect; render nothing in the meantime.
    return null;
  }

  return (
    <div className="mining-page">
      <header className="mining-header">
        <div className="mining-title-row">
          <h1>Mining review</h1>
          <button
            type="button"
            className="btn-ghost mining-rebuild"
            onClick={handleRebuild}
            disabled={rebuildBusy}
            title="Regenerates backend/mining/data/profession-lexicon.json from the Profession collection. Call after adding new professions."
          >
            {rebuildBusy ? "Rebuilding…" : "Rebuild lexicon"}
          </button>
        </div>
        {rebuildMsg && <p className="mining-rebuild-msg">{rebuildMsg}</p>}

        <div className="mining-stats">
          <span>queue depth <b>{queueDepth}</b></span>
          <span>· this session: accepted <b>{counters.accepted}</b></span>
          <span>· declined <b>{counters.declined}</b></span>
          <span>· skipped <b>{counters.skipped}</b></span>
          <span>· showing <b>{total}</b></span>
        </div>

        <div className="mining-filters">
          <label>
            Kind:
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value as CandidateKind | "")}
            >
              <option value="">all</option>
              <option value="recommendation">recommendation</option>
              <option value="announcement">announcement</option>
            </select>
          </label>
          <label>
            Sort:
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "score" | "created")}
            >
              <option value="score">highest score</option>
              <option value="created">newest</option>
            </select>
          </label>
          <button type="button" className="btn-ghost" onClick={() => void loadQueue()}>
            Reload queue
          </button>
        </div>
      </header>

      {!current && total === 0 && (
        <p className="mining-empty">Queue is empty. Nothing to review.</p>
      )}

      {!current && total > 0 && (
        <div className="mining-empty">
          <p>All {total} candidates in this filter have been reviewed.</p>
          <button type="button" className="btn-primary" onClick={() => void loadQueue()}>
            Reload queue
          </button>
        </div>
      )}

      {current && (
        <article className="mining-card">
          <div className="mining-meta">
            <span className="mining-tag">{current.kind}</span>
            <span className="mining-tag">{current.sourceType}</span>
            <span className="mining-score">score {current.score.toFixed(2)}</span>
            <span className="mining-source">
              {current.classifierName} v{current.classifierVersion}
            </span>
          </div>

          {current.sourceType === "forwarded" && (
            <div className="mining-inquiry">
              <span className="mining-inquiry-label">
                FORWARDED LEAD
                {current.submittedBy?.name
                  ? ` · by ${current.submittedBy.name}`
                  : ""}
                {current.submittedBy && !current.submittedBy.isAdmin
                  ? " (community)"
                  : ""}
              </span>
              {current.originChatTitle && (
                <p>from chat: {current.originChatTitle}</p>
              )}
            </div>
          )}

          {current.inquiryText && (
            <div className="mining-inquiry">
              <span className="mining-inquiry-label">
                QUESTION ASKED
                {current.responderName ? ` · responder: ${current.responderName}` : ""}
              </span>
              <p>{current.inquiryText}</p>
            </div>
          )}

          <div className="mining-message">{current.text}</div>

          {current.tgLink && (
            <a
              className="mining-tg-link"
              href={current.tgLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              ↗ open original message in Telegram (to fetch a contact)
            </a>
          )}

          <form className="mining-form" onSubmit={handleAccept}>
            <label className="mining-field">
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>

            <label className="mining-field">
              <span>Profession</span>
              <div className="mining-row-pair">
                <select
                  value={form.professionID}
                  onChange={(e) => setForm({ ...form, professionID: e.target.value })}
                >
                  <option value="">— select —</option>
                  {professions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {pickName(p.name)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost btn-add"
                  onClick={() => setShowCreateProfession(true)}
                >
                  + Add new
                </button>
              </div>
              {current.extracted.profession && (
                <p className="mining-hint">
                  Classifier read: &ldquo;{current.extracted.profession}&rdquo;
                </p>
              )}
            </label>

            <label className="mining-field">
              <span>City</span>
              <div className="mining-row-pair">
                <select
                  value={form.locationID}
                  onChange={(e) => setForm({ ...form, locationID: e.target.value })}
                >
                  <option value="">— select —</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {pickName(l.name, ["en", "it", "ua", "ru"])}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn-ghost btn-add"
                  onClick={() => setShowCreateLocation(true)}
                >
                  + Add new
                </button>
              </div>
              {current.extracted.city && (
                <p className="mining-hint">
                  Classifier read: &ldquo;{current.extracted.city}&rdquo;
                </p>
              )}
            </label>

            <fieldset className="mining-field">
              <legend>Contacts</legend>
              {form.contacts.map((c, i) => (
                <div key={i} className="mining-contact-row">
                  <select
                    value={c.contactType}
                    onChange={(e) => {
                      const next = [...form.contacts];
                      next[i] = { ...next[i], contactType: e.target.value };
                      setForm({ ...form, contacts: next });
                    }}
                  >
                    {CONTACT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <input
                    type="text"
                    placeholder="number / @handle / link"
                    value={c.value}
                    onChange={(e) => {
                      const next = [...form.contacts];
                      next[i] = { ...next[i], value: e.target.value };
                      setForm({ ...form, contacts: next });
                    }}
                  />
                  <button
                    type="button"
                    className="btn-ghost btn-x"
                    aria-label="Remove contact"
                    onClick={() => {
                      const next = form.contacts.filter((_, j) => j !== i);
                      setForm({ ...form, contacts: next });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost btn-add"
                onClick={() =>
                  setForm({
                    ...form,
                    contacts: [...form.contacts, { contactType: "phone", value: "" }],
                  })
                }
              >
                + Add contact
              </button>
            </fieldset>

            <label className="mining-field">
              <span>Description (optional)</span>
              <textarea
                rows={3}
                value={form.about}
                onChange={(e) => setForm({ ...form, about: e.target.value })}
              />
            </label>

            <label className="mining-field">
              <span>Tags · UA (comma-separated)</span>
              <input
                type="text"
                placeholder="заміна екрана, акумулятор"
                value={form.tagsUa}
                onChange={(e) => setForm({ ...form, tagsUa: e.target.value })}
              />
            </label>
            <label className="mining-field">
              <span>Tags · EN (comma-separated)</span>
              <input
                type="text"
                placeholder="screen replacement, battery"
                value={form.tagsEn}
                onChange={(e) => setForm({ ...form, tagsEn: e.target.value })}
              />
            </label>

            {(() => {
              const dupList = dupConflict ?? current.duplicateMasters ?? [];
              if (!dupList.length) return null;
              return (
                <div className="mining-warn mining-dup">
                  <strong>
                    ⚠ Possible duplicate — a live master already has this contact:
                  </strong>
                  <ul>
                    {dupList.map((d) => (
                      <li key={d.id}>
                        {d.name || "(no name)"} · {d.status}/{d.source}
                        {d.contacts.length
                          ? ` · ${d.contacts.map((c) => c.value).join(", ")}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                  {dupConflict && (
                    <button
                      type="button"
                      className="btn-decline"
                      disabled={busy}
                      onClick={() => void doAccept(true)}
                    >
                      Publish anyway
                    </button>
                  )}
                </div>
              );
            })()}

            {!canSubmit && (
              <p className="mining-warn">
                Approve needs: name + profession + city + at least one contact.
              </p>
            )}
            {error && <p className="mining-error">{error}</p>}

            <div className="mining-actions">
              <button
                type="button"
                className="btn-decline"
                disabled={busy}
                onClick={() => setShowDecline(true)}
              >
                Decline
              </button>
              <button
                type="button"
                className="btn-skip"
                disabled={busy}
                onClick={() => {
                  setCounters((c) => ({ ...c, skipped: c.skipped + 1 }));
                  advance();
                }}
              >
                Skip
              </button>
              <button type="submit" className="btn-primary" disabled={busy || !canSubmit}>
                {busy ? "Saving…" : "Approve → publish live"}
              </button>
            </div>
          </form>
        </article>
      )}

      {showCreateProfession && (
        <CreateProfessionModal
          categories={categories}
          onCategoriesRefresh={(c) => c && handleCreatedCategory(c)}
          onCreated={(p) => {
            handleCreatedProfession(p);
            setShowCreateProfession(false);
          }}
          onClose={() => setShowCreateProfession(false)}
        />
      )}
      {showCreateLocation && (
        <CreateLocationModal
          countries={countries}
          onCreated={(l) => {
            handleCreatedLocation(l);
            setShowCreateLocation(false);
          }}
          onClose={() => setShowCreateLocation(false)}
        />
      )}
      {showDecline && (
        <DeclineModal
          busy={busy}
          onClose={() => setShowDecline(false)}
          onSubmit={handleDecline}
        />
      )}
    </div>
  );
}

// Small inline component — decline reason picker + optional note.
function DeclineModal({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: (reasonCode: DeclineReason, note?: string) => void;
}) {
  const [reason, setReason] = useState<DeclineReason | "">("");
  const [note, setNote] = useState("");
  const reasonLabels = useMemo<Record<DeclineReason, string>>(
    () => ({
      not_a_master: "Not a master / specialist",
      spam: "Spam",
      duplicate: "Duplicate of an existing master",
      wrong_extraction: "Classifier mis-extracted",
      out_of_scope: "Out of scope (not in Italy / wrong field)",
      other: "Other (note)",
    }),
    []
  );

  return (
    <div className="mining-modal-backdrop" onClick={onClose}>
      <div
        className="mining-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="mining-modal-head">
          <h3>Decline candidate</h3>
          <button
            type="button"
            className="mining-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <form
          className="mining-modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!reason) return;
            onSubmit(reason as DeclineReason, note.trim() || undefined);
          }}
        >
          <div className="mining-decline-reasons">
            {DECLINE_REASONS.map((r) => (
              <label key={r} className="mining-decline-reason">
                <input
                  type="radio"
                  name="reason"
                  value={r}
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                <span>{reasonLabels[r]}</span>
              </label>
            ))}
          </div>
          <label className="mining-field">
            <span>Note (optional)</span>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="mining-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-decline" disabled={busy || !reason}>
              {busy ? "Saving…" : "Decline"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
