# Meeting: Telegram Mini App — Onboarding Wizard UX Spec
Date: 2026-05-15

> Build-ready spec for the React onboarding wizard that ships inside the Telegram Mini App and as a web fallback. Sits beside the Backend API plan and the Frontend tooling plan. All screen, field, copy, and interaction decisions are locked here.

## 1. Final wizard structure

**Locked at 5 steps.** The research draft proposed 5; I kept the count but rebalanced the boundaries: tags moved from Step 2 into Step 4 (next to bio, because both are free-text "describe yourself" inputs and the keyboard is already up). Languages moved out of Step 1 into Step 2 (they're a "what you do" attribute, not an identity attribute). Photo moved from Step 4 into a leading prompt on Step 1 so the user sees themselves on screen from second one. Net: identity is lighter, what-you-do is denser, and bio/tags share the keyboard-heavy screen.

| # | Step | Goal | Fields | Required | Prefill |
|---|---|---|---|---|---|
| 1 | Profile | "Confirm who you are" | photo, name | name | photo ← `initData.user.photo_url` or scraped `photo`; name ← `initData.user.first_name + " " + last_name[0]` or scraped `name` |
| 2 | Profession | "What do you do" | profCategoryID, professionID, languages | category, profession, ≥1 language | category/profession ← scraped if present; languages ← `[initData.user.language_code]` |
| 3 | Location | "Where do you work" | locationID (countryID locked to IT) | locationID | locationID ← scraped if present, else blank |
| 4 | Bio & tags | "Tell clients what you offer" | about, tags | about, ≥1 tag | about ← scraped; tags ← scraped (claim case) |
| 5 | Contact | "How clients reach you" | telephone (+ isTelephone/isWhatsapp/isViber), instagram, telegram, requestWriteAccess | none strictly required, but at least one channel of {phone, instagram, telegram} must be set | telephone ← scraped or `requestContact`; telegram ← `initData.user.username`; instagram ← scraped |

### Validation rules (single source of truth)

| Field | Rules |
|---|---|
| `name` | required, trim, 2–25 chars, no leading/trailing whitespace, no line breaks |
| `profCategoryID` | required, must exist in `professions.json` categories |
| `professionID` | required, must belong to selected category |
| `languages` | required, ≥1, max 5, from a fixed enum {`ua`,`ru`,`en`,`it`,`pl`,`de`,`fr`,`es`} |
| `locationID` | required, must exist in `locations.json` |
| `about` | required, 30–600 chars, trimmed |
| `tags` | required, 1–3 items, each 4–25 chars, trimmed, unique (case-insensitive), no leading `#` |
| `telephone` | optional; if present, must pass `libphonenumber` `isValidNumber`; E.164 stored |
| `isTelephone`/`isWhatsapp`/`isViber` | only meaningful when `telephone` is set; if all three are off and `telephone` is set, force `isTelephone=true` |
| `instagram` | optional, strip leading `@` and full URL, 1–30 chars, `[a-zA-Z0-9._]` |
| `telegram` | optional, strip leading `@`, 5–32 chars, `[a-zA-Z0-9_]` |
| Cross-field | at least one of `telephone`, `instagram`, `telegram` must be present at Step 5 commit |

## 2. Per-screen spec

### Step 1 — Profile

```
┌──────────────────────────────────────────┐
│  ●○○○○                          1 of 5   │   progress dots, left-aligned
│                                          │
│            ╭──────────╮                  │
│            │  AVATAR  │  ← 96px circle   │
│            ╰──────────╯                  │
│        [ Change photo ]                  │   ghost button, secondary color
│                                          │
│  Ваше імʼя                               │
│  ┌────────────────────────────────────┐  │
│  │ Олена К.                           │  │   prefilled, focusable
│  └────────────────────────────────────┘  │
│  Це побачать клієнти на вашій картці     │   hint text, --tg-theme-hint-color
│                                          │
│  (BackButton hidden — first step)        │
│  ════════════════════════════════════    │
│  [   MainButton: Далі   ]                │   sticky, --tg-theme-button-color
└──────────────────────────────────────────┘
```

- **MainButton**: label `Далі` / `Next`. Enabled when `name` is valid. On tap: `HapticFeedback.selectionChanged()`, advance.
- **BackButton**: hidden (`tg.BackButton.hide()`).
- **Top bar**: progress dots component (custom, native is not available). Step counter `1 of 5` right-aligned, in `--tg-theme-hint-color`.
- **Photo affordance**: tapping `Change photo` opens an action sheet (see §4).
- **Focus**: autofocus `name` only if the prefilled value is empty/default. Otherwise no autofocus — avoid the keyboard popping up uninvited.
- **Loading**: first paint shows skeleton avatar + skeleton input (200ms) while we wait for `initData` parse + draft fetch.
- **Errors**: inline below input, red text using `--tg-theme-destructive-text-color`.
- **Native primitives**: `viewport.expand()` on mount, `themeParams` synced to CSS vars, `setHeaderColor('secondary_bg_color')`.

### Step 2 — Profession

```
┌──────────────────────────────────────────┐
│  ●●○○○                          2 of 5   │
│                                          │
│  Категорія                          *    │
│  ┌────────────────────────────────────┐  │
│  │ Авто та транспорт           ▼      │  │   bottom-sheet picker
│  └────────────────────────────────────┘  │
│                                          │
│  Професія                           *    │
│  ┌────────────────────────────────────┐  │
│  │ Автомеханік                ▼       │  │   disabled until category set
│  └────────────────────────────────────┘  │
│                                          │
│  Мови спілкування з клієнтами       *    │
│  [ UA ✓ ] [ IT ] [ EN ] [ RU ] [ + ]     │   chip multi-select
│                                          │
│  ════════════════════════════════════    │
│  ← BackButton           [Далі]           │
└──────────────────────────────────────────┘
```

- **MainButton**: `Далі`. Enabled when category + profession + ≥1 language are set.
- **BackButton**: visible. On tap: save draft (debounced), go to Step 1. No confirm — back is always cheap because draft autosaves.
- **Pickers**: tapping the category/profession field opens a full-screen bottom sheet with a search input on top (sticky) and a tap-to-select list. Selecting a category resets `professionID` to null and surfaces the profession sheet automatically. Use `HapticFeedback.selectionChanged()` on each tap.
- **Languages**: tile chips. Tapping toggles selection (`selectionChanged` haptic). `+` opens an action sheet with the full enum. Max 5 enforced — over-limit tap shows a popup toast with `showPopup` (no destructive).
- **Loading / empty**: if `professions.json` is fetched async, show 3 skeleton rows while loading.
- **Errors**: under each field. If user taps `Далі` with a missing field, scroll to first invalid + shake animation + `notificationOccurred('error')`.

### Step 3 — Location

```
┌──────────────────────────────────────────┐
│  ●●●○○                          3 of 5   │
│                                          │
│  Найближче велике місто             *    │
│  ┌────────────────────────────────────┐  │
│  │ 🔍 Рим                       ▼     │  │
│  └────────────────────────────────────┘  │
│  Це місто буде показане у вашій картці   │
│  Ви все одно можете працювати в інших.   │
│                                          │
│  Країна:  🇮🇹 Італія    (locked в v1)   │
│                                          │
│  ════════════════════════════════════    │
│  ← BackButton           [Далі]           │
└──────────────────────────────────────────┘
```

- **MainButton**: `Далі`. Enabled when `locationID` set.
- **BackButton**: visible, debounce-save + back.
- **Picker**: same bottom-sheet pattern as Step 2. Search filters on `city.ua`, `city.en`, and `city.ua_alt`. Show province as muted secondary line.
- **countryID**: locked to `IT`. Field shown as read-only with a note. (v2 unlocks.)

### Step 4 — Bio & tags

```
┌──────────────────────────────────────────┐
│  ●●●●○                          4 of 5   │
│                                          │
│  Послуги (від 1 до 3)               *    │
│  ┌────────────────────────────────────┐  │
│  │ [Заміна мастила ×] [Техогляд ×]    │  │
│  │ [+ Додати послугу]                 │  │
│  └────────────────────────────────────┘  │
│  Запропоновані: [Сервіс BMW] [Шиномонтаж]│   based on selected profession
│                                          │
│  Про вас                            *    │
│  ┌────────────────────────────────────┐  │
│  │ Що ви робите, в якому районі,      │  │
│  │ як з вами зручно зв'язатися.       │  │
│  │                                    │  │   textarea, 6 rows
│  │                                    │  │
│  └────────────────────────────────────┘  │
│  142 / 600                               │   live counter, right-aligned
│                                          │
│  ════════════════════════════════════    │
│  ← BackButton           [Далі]           │
└──────────────────────────────────────────┘
```

- **MainButton**: `Далі`. Enabled when ≥1 tag and `about` ≥30 chars.
- **Tags**: see §6.
- **Bio**: live char counter changes color at 80% (amber) and 95% (red). On focus, scroll the textarea fully into view, accounting for `--tg-viewport-stable-height`.
- **Keyboard handling**: when the textarea is focused, hide the progress dots row to free vertical space; restore on blur.

### Step 5 — Contact

```
┌──────────────────────────────────────────┐
│  ●●●●●                          5 of 5   │
│                                          │
│  Номер телефону                          │
│  [ 📞 Поділитися номером з Telegram ]    │   primary CTA, secondary color
│  або ввести вручну ↓                     │
│  ┌────────────────────────────────────┐  │
│  │ 🇮🇹 +39 ___ ___ ____               │  │
│  └────────────────────────────────────┘  │
│  ☑ Можна дзвонити                        │
│  ☐ WhatsApp на цей номер                 │
│  ☐ Viber на цей номер                    │
│                                          │
│  Instagram (необовʼязково)               │
│  [ ola_master                       ]    │
│                                          │
│  Telegram (необовʼязково)                │
│  [ @olenak                          ]    │   prefilled, editable
│                                          │
│  ☑ Дозволити боту писати вам у Telegram  │   triggers requestWriteAccess
│      Ми надішлемо лише підтвердження     │   helper text
│      та повідомлення про вашу картку.    │
│                                          │
│  ════════════════════════════════════    │
│  ← BackButton          [Надіслати]       │
└──────────────────────────────────────────┘
```

- **MainButton**: label `Надіслати` / `Submit`. While submitting: `showProgress(true)`, label stays. On success: `notificationOccurred('success')` + popup (see §7).
- **BackButton**: visible.
- **Cross-field rule**: at least one of phone / instagram / telegram must be set. If none on submit: inline error at the top of the step + `notificationOccurred('error')`.
- **Native primitives**: `requestContact`, `requestWriteAccess`. See §5.

## 3. Copy (Ukrainian primary, English fallback)

> Ukrainian is the live language. English strings are translation seeds for the `lng=en` toggle. Where I'm not native-fluent in Ukrainian, I'm matching the existing form's tone (`AddNewRecord.tsx`) — same words and constructions where possible. Flagged items marked `[review-UA]`.

### Global

| Key | UA | EN |
|---|---|---|
| `app.title` | Створити запис | Create your listing |
| `progress.counter` | {n} з 5 | {n} of 5 |
| `errors.required` | Обовʼязкове поле | Required field |
| `errors.network` | Не вдалося зберегти. Спробуйте ще раз. | Couldn't save. Try again. |
| `mainButton.next` | Далі | Next |
| `mainButton.submit` | Надіслати | Submit |
| `mainButton.saving` | Надсилаємо… | Sending… |
| `mainButton.savingDraft` | Зберігаємо… | Saving… |

### Step 1 — Profile

| Key | UA | EN |
|---|---|---|
| `step1.title` | Хто ви | About you |
| `step1.name.label` | Ваше імʼя | Your name |
| `step1.name.placeholder` | Як вас звати? | What's your name? |
| `step1.name.help` | Це побачать клієнти на вашій картці. | Clients will see this on your card. |
| `step1.name.errorMax` | Максимум 25 символів | Max 25 characters |
| `step1.name.errorMin` | Мінімум 2 символи | Min 2 characters |
| `step1.photo.change` | Змінити фото | Change photo |
| `step1.photo.sheet.useTelegram` | Використати фото з Telegram | Use my Telegram photo |
| `step1.photo.sheet.upload` | Завантажити з пристрою | Upload from device |
| `step1.photo.sheet.camera` | Зробити фото | Take a photo |
| `step1.photo.sheet.remove` | Прибрати фото | Remove photo |
| `step1.photo.noTelegram` | У вашому профілі Telegram немає фото — оберіть інший варіант. | Your Telegram profile has no photo — pick another option. |
| `step1.photo.uploading` | Завантажуємо… | Uploading… |
| `step1.photo.uploadFail` | Не вдалося завантажити. Перевірте інтернет і спробуйте ще раз. | Upload failed. Check your connection and retry. |
| `step1.photo.tooLarge` | Файл завеликий (макс. 5 МБ). | File too large (max 5 MB). |

### Step 2 — Profession

| Key | UA | EN |
|---|---|---|
| `step2.title` | Що ви робите | What you do |
| `step2.category.label` | Категорія | Category |
| `step2.category.placeholder` | Оберіть категорію | Pick a category |
| `step2.profession.label` | Професія | Profession |
| `step2.profession.placeholderLocked` | Спершу оберіть категорію | Pick a category first |
| `step2.profession.placeholder` | Оберіть професію | Pick a profession |
| `step2.languages.label` | Мови спілкування | Languages you speak |
| `step2.languages.help` | Оберіть хоча б одну мову. | Pick at least one. |
| `step2.languages.tooMany` | Максимум 5 мов. | Up to 5 languages. |
| `step2.picker.search` | Пошук | Search |
| `step2.picker.empty` | Нічого не знайшли. | No matches. |

### Step 3 — Location

| Key | UA | EN |
|---|---|---|
| `step3.title` | Де ви працюєте | Where you work |
| `step3.location.label` | Найближче велике місто | Nearest major city |
| `step3.location.help` | Це місто буде на вашій картці. Це не означає, що ви не працюєте в інших. | This city appears on your card. You can still work in others. |
| `step3.country.label` | Країна | Country |
| `step3.country.note` | Поки що Majstr працює тільки в Італії. | Majstr currently works only in Italy. |

### Step 4 — Bio & tags

| Key | UA | EN |
|---|---|---|
| `step4.title` | Опишіть вашу роботу | Describe your work |
| `step4.tags.label` | Послуги (від 1 до 3) | Services (1–3) |
| `step4.tags.help` | Наприклад: «Заміна мастила», «Сервіс BMW», «Техогляд». | E.g. "Oil change", "BMW service", "Inspection". |
| `step4.tags.add` | Додати послугу | Add service |
| `step4.tags.suggested` | Запропоновані | Suggested |
| `step4.tags.tooShort` | Мінімум 4 символи | Min 4 characters |
| `step4.tags.tooLong` | Максимум 25 символів | Max 25 characters |
| `step4.tags.tooMany` | Можна вказати до 3 послуг. | Up to 3 services. |
| `step4.tags.duplicate` | Така послуга вже є. | Already added. |
| `step4.about.label` | Про вас | About you |
| `step4.about.placeholder` | Що ви робите, в якому районі, як з вами зручно звʼязатися, як скоро ви відповідаєте. | What you do, your area, how to reach you, how fast you respond. |
| `step4.about.help` | Від 30 до 600 символів. | 30 to 600 characters. |
| `step4.about.tooShort` | Будь ласка, додайте трохи деталей (мін. 30 символів). | Add a bit more (min 30 characters). |

### Step 5 — Contact

| Key | UA | EN |
|---|---|---|
| `step5.title` | Як з вами звʼязатися | How clients reach you |
| `step5.phone.share` | Поділитися номером з Telegram | Share number via Telegram |
| `step5.phone.manualLabel` | або введіть вручну | or enter manually |
| `step5.phone.invalid` | Невірний формат номера. | Invalid phone number. |
| `step5.phone.denied` | Гаразд, можете ввести номер вручну. | No problem, enter it manually. |
| `step5.channels.call` | Можна дзвонити | OK to call |
| `step5.channels.whatsapp` | WhatsApp на цей номер | WhatsApp on this number |
| `step5.channels.viber` | Viber на цей номер | Viber on this number |
| `step5.instagram.label` | Instagram | Instagram |
| `step5.instagram.placeholder` | Імʼя користувача без @ | Username without @ |
| `step5.instagram.invalid` | Некоректне імʼя користувача. | Invalid username. |
| `step5.telegram.label` | Telegram | Telegram |
| `step5.writeAccess.label` | Дозволити боту писати вам у Telegram | Allow the bot to message you |
| `step5.writeAccess.help` | Ми надішлемо підтвердження публікації картки та важливі повідомлення. Без цього ми не зможемо повідомити про схвалення. | We'll DM you when your card is approved or needs attention. Without this we can't notify you. |
| `step5.writeAccess.denied` | Гаразд. Ви зможете дозволити це пізніше в боті. | OK. You can allow this later in the bot. |
| `step5.needOneChannel` | Залиште хоча б один контакт: телефон, Instagram або Telegram. | Leave at least one contact: phone, Instagram, or Telegram. |

### Submit popup

| Key | UA | EN |
|---|---|---|
| `submit.success.title` | Дякуємо! | Thanks! |
| `submit.success.body` | Картку відправлено на перевірку. Ми повідомимо у Telegram, коли вона зʼявиться на сайті. | Your card is in review. We'll DM you on Telegram when it goes live. |
| `submit.success.viewCard` | Переглянути картку | View card |
| `submit.success.share` | Поділитися | Share |
| `submit.success.close` | Закрити | Close |
| `submit.fail.title` | Щось пішло не так | Something went wrong |
| `submit.fail.body` | Не вдалося надіслати. Перевірте підключення та спробуйте ще раз. | We couldn't send it. Check your connection and retry. |
| `submit.fail.retry` | Спробувати ще раз | Try again |

[review-UA] — Native-Ukrainian reviewer pass needed on `step3.location.help`, `step5.writeAccess.help`, and `submit.success.body` for tone, not correctness.

## 4. Photo flow

**Action-sheet on tap of `Change photo`**, options in this order:

1. **Use my Telegram photo** — default highlighted. On tap: server-side copy from `initData.user.photo_url` → S3 (existing `user-og/` plumbing applies, but for the avatar we store in `master.photo`). Preview updates instantly with the URL.
2. **Upload from device** — `<input type="file" accept="image/jpeg,image/png,image/webp">`. Client-side: validate ≤5 MB, downscale to max 1024 px on the long edge using `createImageBitmap` + canvas before upload.
3. **Take a photo** — `<input type="file" accept="image/*" capture="user">` (front camera; we want a portrait, not a workshop shot).
4. **Remove photo** — only when a photo is currently set. Reverts to placeholder initials avatar.

**Preview state**: 96 px circular avatar with thin 1 px border using `--tg-theme-section-separator-color`. While uploading, dim to 50% and overlay a small spinner using `--tg-theme-button-color`.

**Edge cases**:
- **No Telegram photo** (`initData.user.photo_url` absent): hide option 1, show `step1.photo.noTelegram` hint above the sheet. Default selection becomes option 2.
- **Upload fails on slow network**: show `step1.photo.uploadFail` inline below the avatar, with a `Спробувати ще раз` link. Keep the prior photo (no flicker). Retries reuse the same multipart request.
- **Size/format constraints surfaced**: action-sheet footer text: `JPG, PNG або WebP. До 5 МБ.`

## 5. Contact step detail

### `requestContact` flow

```js
window.Telegram.WebApp.requestContact((shared) => {
  if (shared) {
    // contact arrives via the `contact_requested` event;
    // backend gets the validated phone, frontend just reflects it in the field.
  } else {
    showHint('step5.phone.denied'); // soft fallback, never block
  }
});
```

- Button label: `📞 Поділитися номером з Telegram`.
- On consent: phone field auto-fills in E.164 format, country code locked to whatever Telegram returned. `notificationOccurred('success')`. The three channel checkboxes appear (animated reveal).
- On denial: snackbar with `step5.phone.denied` for 3 s. Phone field remains, manual entry path stays available. **Never block.**

### Manual phone entry

- `react-phone-input-2` with `country="it"`, `enableSearch`, `countryCodeEditable`. On blur, validate via `libphonenumber-js` `isValidNumber`. Show `step5.phone.invalid` inline.
- Keyboard: `inputMode="tel"`.

### WhatsApp / Viber

**Same number.** No separate inputs. The phone field is the contact; checkboxes are channel flags persisted as the existing `contacts: [{contactType, value}]` array on save:

```js
contacts = []
if (isTelephone) contacts.push({ contactType: 'telephone', value: phone })
if (isWhatsapp)  contacts.push({ contactType: 'whatsapp',  value: phone })
if (isViber)     contacts.push({ contactType: 'viber',     value: phone })
if (instagram)   contacts.push({ contactType: 'instagram', value: instagram })
if (telegram)    contacts.push({ contactType: 'telegram',  value: telegram })
```

Rationale: 100% of current production data uses the same number for all three. A separate-number input doubles the field count to solve a <1%-of-users problem.

### `requestWriteAccess`

- **Triggered inline** on Step 5, not as a separate step. Tied to a checkbox (default checked), explanation visible underneath.
- **Triggered on submit, not on toggle.** Calling the API immediately on toggle is jarring; instead, when the user taps `Надіслати`, if the checkbox is on and we don't already have write access, call `Telegram.WebApp.requestWriteAccess(cb)` first, then proceed with submit regardless of outcome.
- **Consequence of denial**: we can't DM them on approval — surface this clearly in helper text. The Telegram username remains saved; admin DMs would still fail silently unless they later message the bot, so we also offer a fallback notification path via the email field (out of scope v1 — flag in §10).

### Instagram / telegram handles

- `inputMode="text"`, `autocapitalize="none"`, `autocorrect="off"`.
- **Paste-a-URL handling**: on input change, run a normalizer that strips `https?://`, `(www\.)?instagram\.com/`, `(www\.)?t\.me/`, `@`, trailing slashes, query strings. Final value is just the handle.

## 6. Tags step detail

**Replace `react-select`'s `CreatableSelect` with a custom chip picker.** Reason: in Telegram dark themes, `react-select`'s default styles fight the theme variables and the overlay-style menu collides with the BottomSheet drag area on iOS. A custom component is ~80 lines and gives us full theme control.

```
┌────────────────────────────────────────┐
│ [Заміна мастила ×] [Техогляд ×]        │   selected chips, button-color bg
│ [+ Додати послугу]                     │   tap → open keyboard with text input
├────────────────────────────────────────┤
│ Запропоновані:                         │
│ [Сервіс BMW] [Шиномонтаж] [Балансування]│ tap to add (selectionChanged haptic)
└────────────────────────────────────────┘
```

- **Suggestions** are seeded from a static map keyed by `professionID` (lives in `frontend/src/data/tag-suggestions.json`, 4–8 suggestions per profession). Falls back to a generic set if no map entry exists. Tapping a suggestion adds it to the selected chips and removes it from suggestions.
- **Add gesture**: tap `+ Додати послугу` → inline input replaces the `+` button → type → press Enter or tap an Add affordance. `inputMode="text"`, `maxLength="25"`.
- **Remove gesture**: tap the `×` on a chip. `selectionChanged` haptic.
- **Validation**: live as the user types — disable Enter / Add if length<4, length>25, duplicate, or already 3 chips. Surfaces are the helper text microcopy in §3.
- **Over-limit attempt**: don't show an error toast; just disable add affordances and dim the input, with helper text changing to `step4.tags.tooMany`.

## 7. Submit + success

### On `Надіслати` tap

1. Run full client-side validation across all 5 steps in memory.
2. If invalid:
   - `notificationOccurred('error')`.
   - Determine the first invalid step.
   - `showPopup({ title: 'Перевірте поля', message: '<first error message>', buttons: [{ id: 'goto', text: 'Виправити' }] })` — on `goto`, jump to that step and focus the first invalid field.
3. If valid:
   - `MainButton.showProgress(true)`, label stays as `Надсилаємо…`, disable form interactions (overlay with `pointer-events:none`).
   - `requestWriteAccess` if needed (see §5).
   - Single `POST /miniapp/master/submit` with the full draft payload (server already has autosaved fields; this call also flips `status` from `draft` → `pending` server-side).
   - On 2xx: success popup (below). On 4xx with field errors: map to step, jump there. On 5xx/network: failure popup with retry.

### Success — `showPopup`

```js
Telegram.WebApp.showPopup({
  title: 'Дякуємо!',
  message: 'Картку відправлено на перевірку. Ми повідомимо у Telegram, коли вона зʼявиться на сайті.',
  buttons: [
    { id: 'view',  type: 'default',     text: 'Переглянути картку' },
    { id: 'share', type: 'default',     text: 'Поділитися' },
    { id: 'close', type: 'cancel',      text: 'Закрити' },
  ],
}, (id) => {
  if (id === 'view')  navigateInApp(`/master/${master.id}`);
  if (id === 'share') Telegram.WebApp.switchInlineQuery('', ['users', 'groups']);
  // close → stay in app on a "Ваша картка" screen
});
```

`HapticFeedback.notificationOccurred('success')` fires immediately on 2xx, before the popup, so the haptic registers even if the user dismisses fast.

### Failure

`showPopup({ title: 'Щось пішло не так', message: ..., buttons: [{ id: 'retry', text: 'Спробувати ще раз' }, { id: 'cancel', type: 'cancel' }] })`. On retry, re-run submit without re-validating.

## 8. Returning users / draft resumption

The draft endpoint (`GET /miniapp/draft`) returns either `null` or `{ data, updatedAt, lastStep }`. Source of truth is the server.

**First-paint logic**:

```
on app open:
  step = CloudStorage.getItem('wizard.lastStep')   // instant, no server roundtrip
  optimistically render that step with skeleton fields
  fetch /miniapp/draft in parallel
  when draft arrives:
    if no draft -> reset to step 1
    if draft + step matches -> hydrate fields, done
    if draft + step mismatches -> hydrate fields, jump to draft.lastStep
```

**Resume prompt**: **none.** Just drop the user into the draft step with fields filled. Justification: the wizard's `Назад` button is always one tap away, and an extra "Resume?" popup is a friction step every user hits twice. Cheap back navigation > confirmation modal.

**Discard affordance**: in the SettingsButton menu (top-right native button), surface `Почати з початку` (`Start over`). On tap: `showConfirm('Видалити чернетку? Це не можна скасувати.')`. On confirm: `DELETE /miniapp/draft`, `CloudStorage.removeItem('wizard.lastStep')`, navigate to Step 1 with empty fields.

**Cross-device**: server-side draft is the source of truth. CloudStorage's `lastStep` syncs across devices for free — Telegram CloudStorage is per-user-per-bot, not per-device. So opening on desktop after starting on phone: lastStep from CloudStorage matches what server has → no surprise.

**Cross-surface (web ↔ TMA)**: web also reads the same `GET /miniapp/draft` endpoint (auth via JWT). The `lastStep` index, however, lives only in CloudStorage (TMA-only). On web we default to the lowest non-complete step. On conflict (`server.updatedAt > local.lastEditTimestamp + 30s`), show a `showConfirm` (TMA) / native modal (web): `Ви редагували цю картку нещодавно на іншому пристрої. Завантажити останню версію?`

## 9. Theme + accessibility

### CSS variable mapping

```css
:root {
  --bg-primary:        var(--tg-theme-bg-color,            #ffffff);
  --bg-secondary:      var(--tg-theme-secondary-bg-color,  #f4f4f5);
  --bg-section:        var(--tg-theme-section-bg-color,    #ffffff);
  --text-primary:      var(--tg-theme-text-color,          #000000);
  --text-secondary:    var(--tg-theme-hint-color,          #707579);
  --text-link:         var(--tg-theme-link-color,          #2481cc);
  --text-destructive:  var(--tg-theme-destructive-text-color, #ff3b30);
  --button-bg:         var(--tg-theme-button-color,        #2481cc);
  --button-text:       var(--tg-theme-button-text-color,   #ffffff);
  --border:            var(--tg-theme-section-separator-color, #e4e4e7);
}

[data-surface="web"] {
  /* Web fallback uses the same names but its own values + a light/dark/system toggle. */
}
```

Web fallback gets a manual light/dark/system toggle in the header (per project default). TMA does not — Telegram owns the theme and we follow.

### Contrast

Audit pairs at build time against WCAG AA (4.5:1 for body text, 3:1 for large text). The known bad pair in Telegram's stock dark theme is `--tg-theme-hint-color` on `--tg-theme-bg-color` (≈3.8:1) — never use hint color for anything required to read. Helper text is hint color (acceptable), error messages are destructive color (always ≥4.5:1 in stock palettes).

### Font sizing

Base 16 px on phone, 17 px on desktop Telegram (`window.innerWidth >= 1024`). System fonts via `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Roboto, sans-serif`. Type scale:

| Token | px | Use |
|---|---|---|
| `--text-xs` | 12 | helper, char counters |
| `--text-sm` | 14 | labels, chip text |
| `--text-base` | 16 | inputs, body |
| `--text-lg` | 18 | step title |
| `--text-xl` | 22 | popup title only |

### Touch targets

44×44 px minimum for any tappable element (matches iOS HIG). Chips: 32 px tall but 44 px tappable hit area via padding. MainButton is owned by Telegram (already correct).

### Screen reader

- All inputs have associated `<label>`.
- The custom chip picker exposes `role="listbox"` for the chip group, `role="option"` per chip, with `aria-selected`. The `+ Додати` affordance is `role="button"`.
- Progress dots: `<nav aria-label="Wizard progress">` with each dot as a button `aria-current="step"` for the active one.
- Step transitions: announce step title via `aria-live="polite"` region.
- Action sheets and popups: use Telegram's native `showPopup` / action sheet equivalents wherever possible — they're already screen-reader-friendly.

## 10. Open questions for the user

1. **`requestWriteAccess` denial fallback.** If a user denies write-access and never DMs the bot, we silently can't notify them of approval. Do we (a) add an email field on Step 5 as a fallback, (b) refuse to submit without write-access, or (c) accept the silent-fail edge case and surface it as a banner in the bot menu? Recommend (c) for v1, (a) for v2.
2. **Tag suggestions data source.** Should `tag-suggestions.json` be hand-curated per profession (~30 lines of JSON, 1 hour of writing), or derived from the existing 46 approved cards' tag bigrams (more code, less editorial)? Recommend hand-curated for v1 — small dataset, biased toward what we *want* surfaced.
3. **Languages enum scope.** I locked `{ua, ru, en, it, pl, de, fr, es}`. Is `ru` politically OK to surface for Ukrainian diaspora users, or should we drop it and let people use the chip's "+ Інша" path? Need a product call.
4. **Profile vs. card name display.** Should `name` accept full surname (`Олена Коваленко`) or strict initial-only (`Олена К.`)? Current web form allows up to 25 chars unrestricted. I'm keeping that. Confirm.
5. **Bottom-sheet pickers vs. inline lists for category/profession.** I picked bottom sheets for parity with native Telegram patterns (and search ergonomics). If the dev plan prefers a simpler inline list at first, we can downgrade Step 2 and Step 3 to native `<select>` with no UX regression on Android (slight regression on iOS). Confirm before component build.

---

## Decisions made

- 5-step wizard, fields re-allocated: identity → profession+languages → location → bio+tags → contact.
- Custom chip picker replaces `react-select` `CreatableSelect` for tags.
- Same number for phone/WhatsApp/Viber, no separate inputs.
- `requestWriteAccess` triggered inline on Step 5 submit, not as a standalone step.
- Server-side draft is source of truth; CloudStorage holds only `lastStep` index.
- No "resume your draft?" prompt — silent hydration into the right step.
- Web fallback gets a manual light/dark/system toggle; TMA follows Telegram theme.

## Next steps

- [ ] Founder review of open questions §10 (#1, #3, #5 are blocking the build).
- [ ] Backend Architect: confirm `POST /miniapp/master/submit` and `GET/PUT/DELETE /miniapp/draft` shape matches this spec's field map.
- [ ] Frontend Developer: scaffold the 5 step components + shared `WizardShell` (handles MainButton/BackButton/progress dots/CloudStorage + draft sync).
- [ ] Native-UA reviewer pass on the four `[review-UA]` strings.
- [ ] Build `tag-suggestions.json` once question #2 is decided.
