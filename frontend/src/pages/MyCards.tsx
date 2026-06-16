import "../onboarding/wizard.css";
import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiFetch } from "../api/client";
import { localizedName } from "../i18n/lang";
import { isTMA } from "../surface/detect";
import { track } from "../analytics";
import { useReferenceData, type Profession, type ProfCategory, type Location } from "../onboarding/useReferenceData";
import { PickerSheet } from "../onboarding/ui/PickerSheet";
import { LANGUAGE_OPTIONS } from "../onboarding/schema";
import { OnboardingI18nProvider } from "../onboarding/i18n";

// Card management for owners (claim flow). Standalone screen styled like the
// add-master wizard — no website header/branding.

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
  shareUrl?: string;
};

const CONTACT_TYPES = ["telegram", "whatsapp", "phone", "instagram", "facebook", "email"];

const SHARE_TEXT = "Я тепер у каталозі Majstr — знайдете мене тут 👉";

// Share the card's public page (its per-master OG image unfurls in Telegram).
function shareCard(master: { _id: string; shareUrl?: string }) {
  if (!master.shareUrl) return;
  track("share_click", { master_id: master._id, share_method: "my_cards" });
  const tg = window.Telegram?.WebApp;
  const tgShare = `https://t.me/share/url?url=${encodeURIComponent(master.shareUrl)}&text=${encodeURIComponent(SHARE_TEXT)}`;
  if (tg?.openTelegramLink) tg.openTelegramLink(tgShare);
  else if (navigator.share) navigator.share({ text: SHARE_TEXT, url: master.shareUrl }).catch(() => {});
  else window.open(tgShare, "_blank");
}

const STATUS_LABEL: Record<string, string> = {
  approved: "Опубліковано",
  archived: "Приховано",
  pending: "На модерації",
  rejected: "Відхилено",
  draft: "Чернетка",
};

type EditState = {
  name: string;
  about: string;
  contacts: Contact[];
  professionID: string;
  locationID: string;
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
    photo: m.photo ?? "",
    languages: m.languages ? [...m.languages] : [],
  };
}

type CardManageProps = {
  master: OwnedMaster;
  professions: Profession[];
  profCategories: ProfCategory[];
  locations: Location[];
  onUpdate: (m: OwnedMaster) => void;
  onDelete: () => void;
};

function CardManage({ master, professions, profCategories, locations, onUpdate, onDelete }: CardManageProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [form, setForm] = useState<EditState>(() => buildEdit(master));
  const status = master.status;
  const [delLoading, setDelLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Category → profession (same UX as the wizard's profession step).
  const [categoryID, setCategoryID] = useState(
    () => professions.find(p => p.id === master.professionID)?.categoryID ?? ""
  );
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [showProfessionPicker, setShowProfessionPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);

  const selectedCategory = profCategories.find(c => c.id === categoryID);
  const selectedProfession = professions.find(p => p.id === form.professionID);
  const selectedLocation = locations.find(l => l.id === form.locationID);
  const filteredProfessions = professions.filter(p => p.categoryID === categoryID);

  const profName = localizedName(selectedProfession?.name, "uk");
  const locName = localizedName(selectedLocation?.name, "uk");

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
        setEditErr(String(err.error ?? "не вдалося завантажити фото"));
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

  async function handleDelete() {
    if (!window.confirm("Видалити картку назавжди? Цю дію не можна скасувати.")) return;
    setDelLoading(true);
    try {
      await apiFetch(`/api/masters/${master._id}`, { method: "DELETE" });
      onDelete();
    } finally {
      setDelLoading(false);
    }
  }

  return (
    <div className="wizard-card">
      <div className="wizard-card-header">
        <span className="wizard-card-name">{master.name}</span>
        <span className="wizard-status">{STATUS_LABEL[status] ?? status}</span>
      </div>
      {(profName || locName) && (
        <div className="wizard-card-sub">
          {[profName, locName].filter(Boolean).join(" · ")}
        </div>
      )}

      {!editing && (
        <div className="wizard-actions">
          {master.shareUrl && (
            <button
              type="button"
              className="wizard-ghost-btn wizard-ghost-btn--primary"
              onClick={() => shareCard(master)}
            >
              Поділитися 🔗
            </button>
          )}
          <button
            type="button"
            className="wizard-ghost-btn wizard-ghost-btn--primary"
            onClick={() => { setEditing(true); setForm(buildEdit(master)); setEditErr(null); }}
          >
            Редагувати
          </button>
          <button
            type="button"
            className="wizard-ghost-btn wizard-ghost-btn--danger wizard-ghost-btn--compact"
            disabled={delLoading}
            onClick={handleDelete}
          >
            Видалити
          </button>
        </div>
      )}

      {editing && (
        <form
          className="wizard-step-content wizard-edit-form"
          onSubmit={e => { e.preventDefault(); handleSave(); }}
          onKeyDown={e => {
            // Enter must never submit the form — only the Save button does.
            // Allow newlines in the "Про себе" textarea; block Enter on inputs.
            if (
              e.key === "Enter" &&
              (e.target as HTMLElement).tagName === "INPUT"
            ) {
              e.preventDefault();
            }
          }}
        >
          <div className="wizard-edit-head">
            <button
              type="button"
              className="wizard-edit-back"
              aria-label="Скасувати редагування"
              onClick={() => { setEditing(false); setEditErr(null); }}
            >
              ← Назад
            </button>
          </div>

          <div className="wizard-field">
            <label className="wizard-label">Фото</label>
            <div className="wizard-photo-row">
              <span
                className="wizard-photo-preview"
                style={form.photo ? { backgroundImage: `url(${form.photo})` } : undefined}
              />
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
                className="wizard-ghost-btn"
                disabled={photoUploading}
                onClick={() => photoInputRef.current?.click()}
              >
                {photoUploading ? "Завантаження…" : form.photo ? "Змінити фото" : "Завантажити фото"}
              </button>
              {form.photo && (
                <button type="button" className="wizard-ghost-btn" onClick={() => setField("photo", "")}>
                  Прибрати
                </button>
              )}
            </div>
          </div>

          <div className="wizard-field">
            <label className="wizard-label">Імʼя</label>
            <input
              className="wizard-input"
              value={form.name}
              maxLength={80}
              onChange={e => setField("name", e.target.value)}
            />
          </div>

          <div className="wizard-field">
            <label className="wizard-label">Категорія</label>
            <button
              type="button"
              className={`wizard-picker-btn${!selectedCategory ? " wizard-picker-btn--placeholder" : ""}`}
              onClick={() => setShowCategoryPicker(true)}
            >
              {selectedCategory ? localizedName(selectedCategory.name, "uk") : "Оберіть категорію"}
              <span className="wizard-picker-chevron">›</span>
            </button>
          </div>

          <div className="wizard-field">
            <label className="wizard-label">Професія</label>
            <button
              type="button"
              className={`wizard-picker-btn${!selectedProfession ? " wizard-picker-btn--placeholder" : ""}${!categoryID ? " wizard-picker-btn--disabled" : ""}`}
              onClick={() => categoryID && setShowProfessionPicker(true)}
              disabled={!categoryID}
            >
              {selectedProfession
                ? localizedName(selectedProfession.name, "uk")
                : categoryID ? "Оберіть професію" : "Спершу оберіть категорію"}
              <span className="wizard-picker-chevron">›</span>
            </button>
          </div>

          <div className="wizard-field">
            <label className="wizard-label">Місто</label>
            <button
              type="button"
              className={`wizard-picker-btn${!selectedLocation ? " wizard-picker-btn--placeholder" : ""}`}
              onClick={() => setShowLocationPicker(true)}
            >
              {selectedLocation ? localizedName(selectedLocation.name, "uk") : "Оберіть місто"}
              <span className="wizard-picker-chevron">›</span>
            </button>
          </div>

          <div className="wizard-field">
            <label className="wizard-label">Мови</label>
            <div className="wizard-chips">
              {LANGUAGE_OPTIONS.map(({ code, label }) => (
                <button
                  key={code}
                  type="button"
                  className={`wizard-chip${form.languages.includes(code) ? " wizard-chip--active" : ""}`}
                  aria-pressed={form.languages.includes(code)}
                  onClick={() => toggleLanguage(code)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="wizard-field">
            <label className="wizard-label">Контакти</label>
            {form.contacts.map((c, i) => (
              <div key={i} className="wizard-contact-row">
                <select
                  className="wizard-input wizard-contact-type"
                  value={c.contactType}
                  onChange={e => setContact(i, "contactType", e.target.value)}
                >
                  {CONTACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="wizard-input"
                  value={c.value}
                  placeholder="значення"
                  onChange={e => setContact(i, "value", e.target.value)}
                />
                <button type="button" className="wizard-ghost-btn" onClick={() => removeContact(i)}>✕</button>
              </div>
            ))}
            {form.contacts.length < 5 && (
              <button type="button" className="wizard-ghost-btn" onClick={addContact}>
                + Додати контакт
              </button>
            )}
          </div>

          <div className="wizard-field">
            <label className="wizard-label">Про себе</label>
            <textarea
              className="wizard-textarea"
              value={form.about}
              maxLength={1000}
              rows={4}
              onChange={e => setField("about", e.target.value)}
            />
          </div>

          {editErr && <p className="wizard-field-error">{editErr}</p>}

          <button type="submit" className="wizard-solid-btn" disabled={saving}>
            {saving ? "Зберігаємо…" : "Зберегти зміни"}
          </button>
          <button
            type="button"
            className="wizard-edit-cancel"
            disabled={saving}
            onClick={() => { setEditing(false); setEditErr(null); }}
          >
            Скасувати
          </button>
          <p className="wizard-hint" style={{ marginTop: 8 }}>
            Після збереження картка піде на перевірку модератором для позначки VERIFIED.
          </p>

          {showCategoryPicker && (
            <PickerSheet
              title="Категорія"
              options={profCategories.map(c => ({ value: c.id, label: localizedName(c.name, "uk", c.id) }))}
              selected={categoryID}
              onSelect={id => {
                setCategoryID(id);
                setField("professionID", "");
              }}
              onClose={() => setShowCategoryPicker(false)}
            />
          )}
          {showProfessionPicker && (
            <PickerSheet
              title="Професія"
              options={filteredProfessions.map(p => ({ value: p.id, label: localizedName(p.name, "uk", p.id) }))}
              selected={form.professionID}
              onSelect={id => setField("professionID", id)}
              onClose={() => setShowProfessionPicker(false)}
            />
          )}
          {showLocationPicker && (
            <PickerSheet
              title="Місто"
              options={locations.map(l => ({ value: l.id, label: localizedName(l.name, "uk", l.id) }))}
              selected={form.locationID}
              onSelect={id => setField("locationID", id)}
              onClose={() => setShowLocationPicker(false)}
            />
          )}
        </form>
      )}
    </div>
  );
}

// PickerSheet (category/profession/city pickers) calls useOnbT(), which throws
// outside an OnboardingI18nProvider. This standalone route isn't under the
// wizard, so it must supply the provider itself — otherwise opening a picker
// crashes into the router errorElement.
export default function MyCards() {
  return (
    <OnboardingI18nProvider>
      <MyCardsInner />
    </OnboardingI18nProvider>
  );
}

function MyCardsInner() {
  const { professions, profCategories, locations, loading: refLoading } = useReferenceData();
  const [masters, setMasters] = useState<OwnedMaster[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    apiFetch("/api/masters/mine", {}, { redirectOn401: false })
      .then(r => {
        if (r.status === 401) {
          setUnauthorized(true);
          return { masters: [] };
        }
        return r.ok ? r.json() : { masters: [] };
      })
      .then(({ masters: data }: { masters: OwnedMaster[] }) => {
        setMasters(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Web visitors without a session go to login; inside the TMA auth rides on
  // initData headers, so a 401 there means something else — show a message.
  if (unauthorized && !isTMA()) return <Navigate to="/login" />;

  return (
    <div className="wizard">
      <div className="wizard-step-title">Мої картки</div>
      <div className="wizard-body">
        {(loading || refLoading) && (
          <>
            <div className="wizard-skeleton" />
            <div className="wizard-skeleton" style={{ width: "60%" }} />
          </>
        )}

        {unauthorized && isTMA() && (
          <p className="wizard-hint">Не вдалося підтвердити сесію. Закрийте і відкрийте Mini App ще раз.</p>
        )}

        {!loading && !refLoading && !unauthorized && masters?.length === 0 && (
          <p className="wizard-hint">
            У вас поки немає карток. Підтвердіть свою картку з каталогу або створіть нову.
          </p>
        )}

        {!refLoading && masters?.map(m => (
          <CardManage
            key={m._id}
            master={m}
            professions={professions}
            profCategories={profCategories}
            locations={locations}
            onUpdate={updated => setMasters(prev => prev!.map(x => x._id === updated._id ? updated : x))}
            onDelete={() => setMasters(prev => prev!.filter(x => x._id !== m._id))}
          />
        ))}
      </div>
    </div>
  );
}
