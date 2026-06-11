import { useContext, useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { MasterContext } from "../context";
import { apiFetch } from "../api/client";
import { localizedName } from "../i18n/lang";
import { isTMA } from "../surface/detect";
import { LANGUAGE_OPTIONS } from "../onboarding/schema";
import type { Profession, Location } from "../schema/state/state.schema";

type Contact = { contactType: string; value: string };

type OwnedMaster = {
  _id: string;
  name: string;
  status: string;
  professionID?: string;
  locationID?: string;
  about?: string;
  contacts: Contact[];
  photo?: string | null;
  tags?: { ua?: string[]; en?: string[] };
  languages?: string[];
  availability?: string;
};

const CONTACT_TYPES = ["telegram", "whatsapp", "phone", "instagram", "facebook", "email"];
const AVAILABILITY_VALUES = ["available", "next_week", "busy"] as const;

const STATUS_LABEL: Record<string, string> = {
  approved: "Live",
  archived: "Hidden",
  pending: "Pending review",
  rejected: "Rejected",
  draft: "Draft",
};

type EditState = {
  name: string;
  about: string;
  contacts: Contact[];
  professionID: string;
  locationID: string;
  availability: string;
  photo: string;
  languages: string[];
};

function buildEdit(m: OwnedMaster): EditState {
  return {
    name: m.name ?? "",
    about: m.about ?? "",
    contacts: m.contacts.length ? m.contacts.map(c => ({ ...c })) : [{ contactType: "telegram", value: "" }],
    professionID: m.professionID ?? "",
    locationID: m.locationID ?? "",
    availability: m.availability ?? "",
    photo: m.photo ?? "",
    languages: m.languages ? [...m.languages] : [],
  };
}

type CardManageProps = {
  master: OwnedMaster;
  professions: Profession[];
  locations: Location[];
  onUpdate: (m: OwnedMaster) => void;
  onDelete: () => void;
};

function CardManage({ master, professions, locations, onUpdate, onDelete }: CardManageProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [form, setForm] = useState<EditState>(() => buildEdit(master));
  const [status, setStatus] = useState(master.status);
  const [visLoading, setVisLoading] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const profName = localizedName(
    professions.find(p => p.id === master.professionID)?.name,
    "uk"
  );
  const locName = localizedName(
    locations.find(l => l.id === master.locationID)?.name,
    "uk"
  );

  function setField<K extends keyof EditState>(key: K, val: EditState[K]) {
    setForm(f => ({ ...f, [key]: val }));
  }

  function setContact(i: number, field: keyof Contact, val: string) {
    setForm(f => {
      const contacts = f.contacts.map((c, idx) => idx === i ? { ...c, [field]: val } : c);
      return { ...f, contacts };
    });
  }

  function addContact() {
    setForm(f => ({ ...f, contacts: [...f.contacts, { contactType: "telegram", value: "" }] }));
  }

  function removeContact(i: number) {
    setForm(f => ({ ...f, contacts: f.contacts.filter((_, idx) => idx !== i) }));
  }

  function toggleLanguage(code: string) {
    setForm(f => ({
      ...f,
      languages: f.languages.includes(code)
        ? f.languages.filter(l => l !== code)
        : [...f.languages, code],
    }));
  }

  async function handlePhotoUpload(file: File) {
    setPhotoUploading(true);
    setEditErr(null);
    try {
      const body = new FormData();
      body.append("photo", file);
      // Same upload pipeline as the onboarding wizard — resizes, fixes EXIF
      // orientation and returns a fresh S3 URL (not draft-coupled).
      const r = await apiFetch("/api/masters/draft/photo", { method: "POST", body });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        setEditErr(String(err.error ?? "photo upload failed"));
        return;
      }
      const { photoUrl } = await r.json();
      setField("photo", photoUrl);
    } catch (err) {
      setEditErr(String(err));
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setEditErr(null);
    try {
      const r = await apiFetch(`/api/masters/${master._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          about: form.about,
          contacts: form.contacts.filter(c => c.value.trim()),
          professionID: form.professionID || undefined,
          locationID: form.locationID || undefined,
          availability: form.availability || undefined,
          photo: form.photo || undefined,
          languages: form.languages,
        }),
      });
      if (!r.ok) {
        const body = await r.json();
        setEditErr(JSON.stringify(body.errors ?? body.error));
        setSaving(false);
        return;
      }
      const { master: updated } = await r.json();
      onUpdate(updated);
      setEditing(false);
    } catch (err) {
      setEditErr(String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleVisibility() {
    const hide = status === "approved";
    setVisLoading(true);
    try {
      await apiFetch(`/api/masters/${master._id}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: hide }),
      });
      setStatus(hide ? "archived" : "approved");
    } finally {
      setVisLoading(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this card permanently? This cannot be undone.")) return;
    setDelLoading(true);
    try {
      await apiFetch(`/api/masters/${master._id}`, { method: "DELETE" });
      onDelete();
    } finally {
      setDelLoading(false);
    }
  }

  return (
    <article className="mycard">
      <div className="mycard__header">
        <div className="mycard__title-row">
          <strong className="mycard__name">{master.name}</strong>
          {profName && <span className="mycard__prof">{profName}</span>}
          {locName && <span className="mycard__loc">· {locName}</span>}
        </div>
        <span className={`mycard__status mycard__status--${status}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      <div className="mycard__actions">
        <button
          type="button"
          className="mycard__btn"
          onClick={() => { setEditing(e => !e); setForm(buildEdit(master)); setEditErr(null); }}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
        {(status === "approved" || status === "archived") && (
          <button
            type="button"
            className="mycard__btn"
            disabled={visLoading}
            onClick={handleVisibility}
          >
            {status === "approved" ? "Hide" : "Restore"}
          </button>
        )}
        <button
          type="button"
          className="mycard__btn mycard__btn--danger"
          disabled={delLoading}
          onClick={handleDelete}
        >
          Delete
        </button>
      </div>

      {editing && (
        <form className="mycard__form" onSubmit={e => { e.preventDefault(); handleSave(); }}>
          <div className="mycard__field">
            <span className="mycard__field-label">Photo</span>
            <div className="mycard__photo-row">
              {form.photo ? (
                <span
                  className="mycard__photo-preview"
                  style={{ backgroundImage: `url(${form.photo})` }}
                />
              ) : (
                <span className="mycard__photo-preview mycard__photo-preview--empty">—</span>
              )}
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                }}
              />
              <button
                type="button"
                className="mycard__btn"
                disabled={photoUploading}
                onClick={() => photoInputRef.current?.click()}
              >
                {photoUploading ? "Uploading…" : form.photo ? "Change photo" : "Upload photo"}
              </button>
              {form.photo && (
                <button
                  type="button"
                  className="mycard__btn"
                  onClick={() => setField("photo", "")}
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <label className="mycard__field">
            <span className="mycard__field-label">Name</span>
            <input
              className="mycard__input"
              value={form.name}
              maxLength={80}
              onChange={e => setField("name", e.target.value)}
            />
          </label>

          <label className="mycard__field">
            <span className="mycard__field-label">Profession</span>
            <select
              className="mycard__input"
              value={form.professionID}
              onChange={e => setField("professionID", e.target.value)}
            >
              <option value="">— not set —</option>
              {professions.map(p => (
                <option key={p.id} value={p.id}>
                  {localizedName(p.name, "uk")}
                </option>
              ))}
            </select>
          </label>

          <label className="mycard__field">
            <span className="mycard__field-label">City</span>
            <select
              className="mycard__input"
              value={form.locationID}
              onChange={e => setField("locationID", e.target.value)}
            >
              <option value="">— not set —</option>
              {locations.map(l => (
                <option key={l.id} value={l.id}>
                  {localizedName(l.name, "uk")}
                </option>
              ))}
            </select>
          </label>

          <label className="mycard__field">
            <span className="mycard__field-label">Availability</span>
            <select
              className="mycard__input"
              value={form.availability}
              onChange={e => setField("availability", e.target.value)}
            >
              <option value="">— not set —</option>
              {AVAILABILITY_VALUES.map(v => (
                <option key={v} value={v}>{v.replace("_", " ")}</option>
              ))}
            </select>
          </label>

          <div className="mycard__field">
            <span className="mycard__field-label">Contacts</span>
            {form.contacts.map((c, i) => (
              <div key={i} className="mycard__contact-row">
                <select
                  className="mycard__input mycard__input--sm"
                  value={c.contactType}
                  onChange={e => setContact(i, "contactType", e.target.value)}
                >
                  {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="mycard__input mycard__input--grow"
                  value={c.value}
                  placeholder="value"
                  onChange={e => setContact(i, "value", e.target.value)}
                />
                <button type="button" className="mycard__remove-contact" onClick={() => removeContact(i)}>✕</button>
              </div>
            ))}
            {form.contacts.length < 5 && (
              <button type="button" className="mycard__add-contact" onClick={addContact}>+ Add contact</button>
            )}
          </div>

          <div className="mycard__field">
            <span className="mycard__field-label">Languages</span>
            <div className="mycard__chips">
              {LANGUAGE_OPTIONS.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  className={`mycard__chip${form.languages.includes(code) ? " mycard__chip--active" : ""}`}
                  aria-pressed={form.languages.includes(code)}
                  onClick={() => toggleLanguage(code)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="mycard__field">
            <span className="mycard__field-label">About</span>
            <textarea
              className="mycard__input mycard__input--textarea"
              value={form.about}
              maxLength={1000}
              rows={4}
              onChange={e => setField("about", e.target.value)}
            />
          </label>

          {editErr && <div className="mycard__error">{editErr}</div>}

          <div className="mycard__form-actions">
            <button type="submit" className="mycard__btn mycard__btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

export default function MyCards() {
  const {
    state: { user, professions, locations },
  } = useContext(MasterContext);

  const [masters, setMasters] = useState<OwnedMaster[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/masters/mine", {}, { redirectOn401: false })
      .then(r => r.ok ? r.json() : { masters: [] })
      .then(({ masters: data }: { masters: OwnedMaster[] }) => {
        setMasters(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Inside the Telegram Mini App auth rides on initData headers, not the
  // web localStorage token — never bounce TMA users to /login.
  if (!user.isLoggedIn && !isTMA()) return <Navigate to="/login" />;

  return (
    <main className="my-cards-page">
      <h1 className="my-cards-page__title">My cards</h1>

      {loading && <p className="my-cards-page__empty">Loading…</p>}

      {!loading && masters?.length === 0 && (
        <p className="my-cards-page__empty">
          You don&apos;t own any cards yet. Claim a card from the search results.
        </p>
      )}

      {masters?.map(m => (
        <CardManage
          key={m._id}
          master={m}
          professions={professions}
          locations={locations}
          onUpdate={updated => setMasters(prev => prev!.map(x => x._id === updated._id ? updated : x))}
          onDelete={() => setMasters(prev => prev!.filter(x => x._id !== m._id))}
        />
      ))}
    </main>
  );
}
