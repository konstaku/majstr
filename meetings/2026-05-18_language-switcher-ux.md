# Meeting: Language-Switcher UX (web + Telegram), 9 locales

Date: 2026-05-18

## What we discussed

Majstr now ships 9 UI languages (`en, uk, ru, it, pt, de, fr, tr, es`) across two
surfaces: the React website and the Telegram bot (inline keyboard + Mini App
webview). The current web `LanguageSwitcher` (`frontend/src/components/Root.tsx:189`)
renders all 9 flat — that is the clutter we are removing. The bot's
`langButtonsRows()` (`backend/i18n.js:235`) chunks all 9 into rows of 4 — also too
many. This doc defines one coherent pattern that satisfies the founder's rules on
both surfaces and is build-ready.

## Founder rules (restated, locked)

1. Always visible: **Ukrainian + English**.
2. One **contextual slot**: the user's system language *iff* it is in our 9 and
   not already `uk`/`en`. Otherwise the slot collapses (no filler).
3. **RU is always present, always the text label `RU`, never a flag.**
4. All other languages reachable, but **behind a disclosure**, not in the primary
   row.
5. Telegram primary switch: **max 4 buttons** = EN, UK, contextual (or collapsed),
   RU. Rest behind an in-bot affordance.

---

## 1. Website switcher

### 1.1 Visible elements (primary row, left → right)

A single `lang-switcher` cluster, max **4 + 1** controls:

| Slot | Content | Always? |
|---|---|---|
| 1 | `🇬🇧 EN` | yes |
| 2 | `🇺🇦 UA` | yes |
| 3 | Contextual: `🇮🇹 IT` (system lang) | only if eligible — else slot omitted |
| 4 | `RU` (text only, **no flag**) | yes |
| 5 | `🌐 ▾` disclosure trigger | yes |

So an Italian visitor sees `🇬🇧 EN · 🇺🇦 UA · 🇮🇹 IT · RU · 🌐▾`; a visitor whose
system language is English/Ukrainian/unsupported sees `🇬🇧 EN · 🇺🇦 UA · RU · 🌐▾`
(slot 3 collapses, row does not reflow to a gap).

The active language gets `aria-current="true"` and the existing `.active` class
(brutalist outline). RU renders label-only via the existing `LANG_LABELS`/
`LANG_FLAGS` split already in `Root.tsx` — keep `LANG_FLAGS.ru` absent.

### 1.2 Disclosure pattern — decision: **popover menu** (not modal, not native select)

Chosen: a lightweight **popover/dropdown** anchored to the `🌐▾` trigger,
listing the remaining languages (those of the 9 not already shown in the primary
row) as a single-column list of `flag + LABEL` rows. Selecting one closes the
popover and applies immediately; if the chosen language was hidden, it does **not**
get promoted into the primary row (primary row stays deterministic — see §1.4) but
becomes the active item and is shown highlighted at the top of the popover next
time it opens.

Rationale vs alternatives:

- **Native `<select>`** — accessible for free, but cannot show flags reliably,
  breaks the brutalist visual language, and gives no room for the RU-as-text rule
  or the active-state styling. Rejected.
- **Full modal/dialog** — overkill for ≤6 short items; steals focus and dims the
  page for a 1-tap decision. Reserve modals for multi-step. Rejected.
- **Telegram-style "spoiler"/accordion that pushes layout** — causes header
  reflow (the switcher lives in `header-controls`, also reused in the burger
  menu). Rejected.
- **Popover** — anchored, dismiss-on-outside-click/Esc, no layout shift, fits the
  header and the mobile burger context unchanged. **Chosen.**

On mobile (burger menu, `Root.tsx:144`) the same component renders; the popover
opens as a bottom-anchored block within the burger panel (no separate mobile
design — one component, CSS handles placement).

### 1.3 Placement

Unchanged location: inside `.header-controls` after `CountryToggle`, and the same
component instance inside the mobile `.burger-controls`. The footer gets **no**
switcher (avoid duplicate state surfaces). One `<LanguageSwitcher/>` definition,
two render sites — exactly as today.

### 1.4 Behaviour on selection

- Calls existing `setLang(code)` (`useTranslation.ts:26`) → writes
  `localStorage.lang` + dispatches `SET_LANGUAGE`. **No reload**, React re-renders
  via context. This already works; we are only restructuring the trigger surface.
- Persisted choice always wins over detection on next visit (already true:
  `getInitialLang()` reads `localStorage` first).
- The contextual slot (#3) is computed from **system language only**, never from
  the saved choice — so it stays stable even after the user picks, say, Portuguese
  from the popover. This keeps the primary row deterministic and predictable.

### 1.5 Accessibility

- Primary row = `<nav aria-label="Language">` containing `<button>`s. Active
  button: `aria-current="true"`. Each button keeps a `title`/`aria-label` of the
  full endonym (e.g. `aria-label="Українська"`) so screen readers don't read a
  bare flag emoji or "UA".
- RU button: visible text is `RU`; `aria-label="Русский"`. The deliberate
  no-flag rule is purely visual — assistive tech still announces the language
  name. Add `aria-label="RU — Русский"` to keep parity with flagged items.
- Disclosure trigger: `<button aria-haspopup="menu" aria-expanded={open}
  aria-controls="lang-more">`, `aria-label="More languages"`.
- Popover: `role="menu"`, items `role="menuitem"`. Keyboard: `Enter`/`Space`
  opens; `↑`/`↓` move; `Enter` selects; `Esc` closes and returns focus to the
  trigger; `Tab` out closes. Focus trap inside popover while open. Outside-click
  closes.
- Flags are decorative: wrap emoji in `<span aria-hidden="true">`.

### 1.6 Contextual-slot computation + edge cases

```
SUPPORTED = [en,uk,ru,it,pt,de,fr,tr,es]
sys = navigator.language.split('-')[0].toLowerCase()

contextual =
  (SUPPORTED.includes(sys) && sys !== 'en' && sys !== 'uk' && sys !== 'ru')
    ? sys
    : null     // collapses slot 3
```

Edge cases:

- `sys === 'en'` or `'uk'` → already a permanent slot → `contextual = null`.
- `sys === 'ru'` → RU is already permanent slot #4 → `contextual = null`
  (no duplicate RU; explicitly excluded above).
- `sys` not in the 9 (e.g. `pl`, `ar`) → `contextual = null`, English remains
  the fallback for actual copy (`translations[lang] ?? translations.en`).
- `navigator.language` empty/undefined → treat as unsupported → `null`.
- Multi-region (`it-CH`, `pt-BR`) → base subtag only (`it`, `pt`) — matches
  existing `getInitialLang()` logic, keep consistent.

Primary visible set = `dedupe(['en','uk', contextual, 'ru'])` with `null`
filtered out; popover set = `SUPPORTED − primaryVisibleSet`.

---

## 2. Telegram switcher

### 2.1 The 4-button row

Replace `langButtonsRows()`'s "all 9 chunked by 4" with a **single primary row of
exactly ≤4 buttons + a More button**, in the welcome message keyboard
(`buildWelcomeKeyboard`, `bot.js:328`). Computed from `mapTgLang(from.language_code)`
(`backend/i18n.js:10`) — same algorithm as web §1.6.

Primary row (one inline-keyboard row):

```
[ 🇬🇧 EN ] [ 🇺🇦 UA ] [ 🇮🇹 IT* ] [ RU ]
```

`* = contextual` slot; if it collapses, the row is 3 buttons
`[🇬🇧 EN][🇺🇦 UA][RU]` (Telegram auto-sizes — no placeholder). Active language
keeps the existing `· label ·` marker. RU is `RU` text, never a flag (already
correct in `LANG_BUTTONS`, keep `ru.label = 'RU'`).

Second keyboard row:

```
[ 🌐 More languages ]      callback_data = uilang:more
```

Then the existing rows below stay exactly as-is:

```
[ ➕ Add my master card ]   (web_app → /onboard?lng=)
[ 🌐 Open the website ]     (url → /login…)
```

So full welcome keyboard, top→bottom:
**lang row · More-languages row · Add-master row · Open-site row.** Language
controls stay topmost (they're understandable pre-language), exactly the current
ordering rationale at `bot.js:332`.

### 2.2 "More languages" affordance — full interaction flow

Telegram inline keyboards can't expand inline or open native menus. The only
reliable mechanic is **swapping the keyboard on the same message via
`editMessageReplyMarkup`**. Flow:

1. User taps **`🌐 More languages`** → callback `uilang:more`.
2. Handler answers the callback (no toast) and `editMessageReplyMarkup` swaps the
   keyboard to the **full grid view**, message text unchanged:

   ```
   [ 🇮🇹 IT ] [ 🇵🇹 PT ] [ 🇩🇪 DE ]
   [ 🇫🇷 FR ] [ 🇹🇷 TR ] [ 🇪🇸 ES ]
   [ 🇬🇧 EN ] [ 🇺🇦 UA ] [ RU ]
   [ ◀ Back ]
   ```

   The grid shows **all 9** (rows of 3) so the user never has to remember which
   were "primary"; active language keeps the `· · ` marker. `◀ Back`
   = `callback_data: uilang:back`.
3. User taps any language `uilang:<code>` → existing `handleUiLangCallback`
   (`bot.js:433`) persists `uiLanguage`, answers with the `lang.switched` toast,
   and `editMessageText` re-renders the welcome body **and rebuilds the keyboard
   in compact (primary 4) form** in the new language. So selecting from the grid
   auto-collapses back — no extra Back tap needed after a pick.
4. `◀ Back` (chosen without picking) → `editMessageReplyMarkup` back to the
   compact primary keyboard, language unchanged.

This is one message, two keyboard states, zero new messages — no chat spam, works
in private chat and groups, survives the Mini App being closed.

Inside the **Mini App webview** (`/onboard`), the switcher is the *website*
component (§1) rendered with `?lng=` seeding initial state — no inline-keyboard
constraint applies there. The bot's 4-button switch governs only the chat
welcome/`/languages` surfaces.

### 2.3 Coexistence with existing buttons

No conflict: `Add my master card` and `Open the website` rows are appended after
the language rows and are untouched in both keyboard states **except** while the
full-grid is shown — to keep the grid uncluttered, the grid view shows **only
the 9 + Back** (Add/Open rows are hidden during grid mode and restored on Back or
on language pick). This keeps the grid scannable and the welcome actions always
one tap away in the default state. `/languages` command reuses the identical
compact-keyboard builder.

---

## 3. Build-ready spec

### 3.1 Shared contextual-slot algorithm (both surfaces)

```
SUPPORTED = ['en','uk','ru','it','pt','de','fr','tr','es']
PERMANENT = ['en','uk','ru']           // ru last, label-only

function contextualLang(sysRaw):
    sys = lower(split(sysRaw, /[-_]/)[0])           // 'it-CH' -> 'it'
    if !sys: return null
    if !SUPPORTED.includes(sys): return null
    if PERMANENT.includes(sys): return null         // covers en/uk/ru
    return sys

function primaryOrder(sysRaw):
    c = contextualLang(sysRaw)
    return ['en','uk', c, 'ru'].filter(x => x != null)   // 3 or 4 items

function hiddenLangs(sysRaw):
    p = new Set(primaryOrder(sysRaw))
    return SUPPORTED.filter(x => !p.has(x))               // 5 or 6 items
```

- Web `sysRaw` = `navigator.language`.
- Bot `sysRaw` = `message.from.language_code` (already normalized by
  `i18n.mapTgLang`; reuse it, then apply the `PERMANENT` exclusion).

### 3.2 RU rendering rule (single source of truth)

`LANG_OPTIONS` in `frontend/src/i18n/lang.ts` and `LANG_BUTTONS` in
`backend/i18n.js` already encode `ru.label = 'RU'` / no flag. **Rule:** RU label
is `"RU"` everywhere, no flag emoji ever, in both primary and grid/popover views,
in active (`· RU ·` / `.active`) and inactive states. `aria-label="RU — Русский"`
on web only. Do not add `🇷🇺` to either map.

### 3.3 Exact button/label set per surface

**Web — primary row** (`<nav aria-label="Language">`):
`🇬🇧 EN` · `🇺🇦 UA` · `[🇮🇹 IT contextual, optional]` · `RU` · `🌐 ▾ (more)`

**Web — popover** (`role="menu"`): one row per `hiddenLangs()` entry, using
`LANG_OPTIONS` flag+label (PT/DE/FR/TR/ES, plus IT when contextual collapsed).
Active language pinned/highlighted at top if it lives in the hidden set.

**Bot — compact keyboard** (rows):
1. `langButtonsRows`→ replace with `[EN][UA][IT?][RU]` (`uilang:<code>`),
   active = `· label ·`
2. `[🌐 More languages]` (`uilang:more`)
3. `[btn.addMaster]` (web_app)
4. `[btn.loginSite]` (url)

**Bot — grid keyboard** (rows): all 9 in rows of 3 (`uilang:<code>`) +
`[◀ Back]` (`uilang:back`). Add/site rows hidden in this state.

### 3.4 State & handlers

- **Web:** no new global state. Add `open: boolean` local to `LanguageSwitcher`.
  Derive `primaryOrder`/`hiddenLangs` once from `navigator.language` (memoize).
  Reuse `useTranslation().setLang`. Persisted lang already wins via
  `getInitialLang()` — keep.
- **Bot:** no DB schema change (`uiLanguage` already persisted). Add two
  callback branches in `handleUiLangCallback` dispatch (`bot.js:284`):
  `uilang:more` → render grid via `editMessageReplyMarkup`;
  `uilang:back` → render compact via `editMessageReplyMarkup`;
  existing `uilang:<code>` path unchanged (already re-renders compact + body).
  Introduce `buildLangKeyboard(lang, mode, token)` with
  `mode ∈ {compact, grid}` used by both `buildWelcomeKeyboard` and the new
  branches.

## Decisions made

- Disclosure on web = **anchored popover menu** (not modal, not native select,
  not layout-pushing accordion).
- Bot "more" = **same-message keyboard swap** to a **full 9-language grid** with
  a Back button; picking a language auto-collapses to compact.
- Contextual slot is computed from **system language only**, never the saved
  preference; collapses (no placeholder) when sys ∈ {en,uk,ru} or unsupported.
- RU = text `"RU"` everywhere, no flag, ever. Single source of truth in the two
  existing lang maps.
- Add/Open-site buttons hidden only during bot grid mode, restored on pick/Back.
- One web component, two render sites (header + burger); no footer switcher.

## Open questions

- See "Confirm" item below re: grid ordering.

## Next steps

- [ ] Refactor `frontend/src/components/Root.tsx` `LanguageSwitcher` to
      primary-row + popover; add `primaryOrder`/`hiddenLangs` helper in
      `i18n/lang.ts`.
- [ ] `backend/i18n.js`: replace `langButtonsRows` with
      `buildLangKeyboard(lang, mode)` (compact/grid).
- [ ] `backend/bot.js`: add `uilang:more` / `uilang:back` branches; hide
      Add/Open rows in grid mode.
- [ ] A11y pass: ARIA roles, keyboard nav, RU `aria-label`.
- [ ] QA matrix: sys = it / en / uk / ru / pl(unsupported) / empty, on web +
      bot, mobile burger + Mini App webview.
