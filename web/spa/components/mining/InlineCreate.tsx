"use client";

import { useState, type FormEvent } from "react";
import {
  createProfession,
  createProfCategory,
  createLocation,
  type LocalizedName,
  type Profession,
  type ProfCategory,
  type LocationRef,
  type CountryRef,
} from "../../api/mining";

// Multi-language name form used in every inline-create modal. UA/RU/EN/IT are
// the working set we ask the admin to fill; the server schemas support more
// (pt/de/fr/tr/es) but we don't surface them here to keep the form short.
// `name.en` is required server-side (used to slug the id and for the lexicon).

const LANGS: { code: "en" | "ua" | "ru" | "it"; label: string }[] = [
  { code: "en", label: "English (required)" },
  { code: "ua", label: "Українська" },
  { code: "ru", label: "Русский" },
  { code: "it", label: "Italiano" },
];

function MultiLangName({
  value,
  onChange,
}: {
  value: LocalizedName;
  onChange: (v: LocalizedName) => void;
}) {
  return (
    <div className="ml-name">
      {LANGS.map((l) => (
        <label key={l.code} className="ml-name-row">
          <span className="ml-name-label">{l.label}</span>
          <input
            type="text"
            value={value[l.code] ?? ""}
            onChange={(e) => onChange({ ...value, [l.code]: e.target.value })}
            placeholder={l.code === "en" ? "e.g. Cardiologist" : ""}
            autoFocus={l.code === "en"}
          />
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reusable modal shell. Backdrop closes; Escape would too but we keep the
// form simple — Cancel button is the obvious exit.

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="mining-modal-backdrop" onClick={onClose}>
      <div
        className="mining-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <header className="mining-modal-head">
          <h3>{title}</h3>
          <button
            type="button"
            className="mining-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create ProfCategory — the leaf of the inline-create chain (no further deps).

export function CreateCategoryModal({
  onCreated,
  onClose,
}: {
  onCreated: (created: ProfCategory) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState<LocalizedName>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.en?.trim()) {
      setErr("English name is required.");
      return;
    }
    setBusy(true);
    try {
      const created = await createProfCategory({ name });
      onCreated(created);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create category");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New category" onClose={onClose}>
      <form onSubmit={submit} className="mining-modal-form">
        <MultiLangName value={name} onChange={setName} />
        {err && <p className="mining-modal-error">{err}</p>}
        <div className="mining-modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create category"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

// ---------------------------------------------------------------------------
// Create Profession — needs a category. Lets the admin "+ Add category" inline
// (nested modal) without leaving the review screen.

export function CreateProfessionModal({
  categories,
  onCategoriesRefresh,
  onCreated,
  onClose,
}: {
  categories: ProfCategory[];
  onCategoriesRefresh: (newCategory?: ProfCategory) => void;
  onCreated: (created: Profession) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState<LocalizedName>({});
  const [categoryID, setCategoryID] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showCategory, setShowCategory] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.en?.trim()) {
      setErr("English name is required.");
      return;
    }
    if (!categoryID) {
      setErr("Pick or create a category.");
      return;
    }
    if (!name.ua?.trim() && !name.ru?.trim()) {
      setErr("At least one of UA / RU is required so the mining lexicon can detect this profession.");
      return;
    }
    setBusy(true);
    try {
      const created = await createProfession({ categoryID, name });
      onCreated(created);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create profession");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ModalShell title="New profession" onClose={onClose}>
        <form onSubmit={submit} className="mining-modal-form">
          <MultiLangName value={name} onChange={setName} />
          <label className="ml-name-row">
            <span className="ml-name-label">Category</span>
            <div className="ml-row-pair">
              <select
                value={categoryID}
                onChange={(e) => setCategoryID(e.target.value)}
              >
                <option value="">— select —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name.en || c.name.ua || c.id}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-ghost btn-add"
                onClick={() => setShowCategory(true)}
              >
                + Add category
              </button>
            </div>
          </label>
          {err && <p className="mining-modal-error">{err}</p>}
          <p className="mining-modal-hint">
            After saving, run the lexicon rebuild button on the queue to make the
            mining heuristic pick up this profession.
          </p>
          <div className="mining-modal-actions">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "Creating…" : "Create profession"}
            </button>
          </div>
        </form>
      </ModalShell>

      {showCategory && (
        <CreateCategoryModal
          onCreated={(c) => {
            onCategoriesRefresh(c);
            setCategoryID(c.id);
          }}
          onClose={() => setShowCategory(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Create Location — needs a country (existing list, no inline-create for now).

export function CreateLocationModal({
  countries,
  onCreated,
  onClose,
}: {
  countries: CountryRef[];
  onCreated: (created: LocationRef) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState<LocalizedName>({});
  const [countryID, setCountryID] = useState<string>("IT");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.en?.trim()) {
      setErr("English name is required.");
      return;
    }
    if (!countryID) {
      setErr("Pick a country.");
      return;
    }
    setBusy(true);
    try {
      const created = await createLocation({ countryID, name });
      onCreated(created);
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Failed to create location");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell title="New city" onClose={onClose}>
      <form onSubmit={submit} className="mining-modal-form">
        <MultiLangName value={name} onChange={setName} />
        <label className="ml-name-row">
          <span className="ml-name-label">Country</span>
          <select
            value={countryID}
            onChange={(e) => setCountryID(e.target.value)}
          >
            <option value="">— select —</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.flag ? `${c.flag} ` : ""}
                {c.name.en || c.name.ua || c.id}
              </option>
            ))}
          </select>
        </label>
        {err && <p className="mining-modal-error">{err}</p>}
        <div className="mining-modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create city"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
