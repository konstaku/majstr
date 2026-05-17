# Meeting: Multilingual Bot + Onboarding (i18n)
Date: 2026-05-17

## What we discussed
After the master-registration flow was confirmed working end-to-end (the
"data stored locally" turned out to be the one-active-card-per-user 409 on
an account that already owned a card; a clean account works), the next
requirement was internationalization: a very apparent language switch in
the bot's first message, the whole onboarding wizard translated, and the
website carrying its language into the bot/wizard.

## Decisions made
- Languages: **uk, en, it, ru**. RU included but **no Russian flag** — RU
  shown as a text label (deliberate, given the Ukrainian-diaspora context).
- Default language **auto-detected from Telegram `language_code`** (Italian
  Telegram → Italian instantly), fallback uk.
- I draft EN/IT/RU copy now; native review is a deferred follow-up.
- Bot welcome leads with a flag/RU switch row as the first inline-keyboard
  row, so a non-Ukrainian speaker changes language without reading anything.
- Language code set standardized on the site's `uk` (not `ua`).
- Language propagation priority in the wizard: `?lng=` (bot web_app button)
  > `start_param` (website `startapp=onboard-<lang>`) > Telegram
  `language_code` > uk. `User.uiLanguage` persists the choice server-side.

## What shipped (develop b5af40f3 → main 7d231a3f, Vercel + Railway)
- `backend/i18n.js` dicts + `t()` + `mapTgLang()` + `langButtonsRow()`
- `User.uiLanguage` field; bot welcome/switcher/`uilang:` callback;
  localized owner DMs, availability/status/unknown-command
- `frontend/src/onboarding/i18n.tsx` provider + `useOnbT`; every wizard
  string translated (steps, PickerSheet, TagPicker, validation, draft
  errors, submit/success)
- `AddMasterModal` deep link carries site language

Verification: tsc clean, build OK, 6 tests pass, backend syntax OK. Lint
0 errors / 9 warnings (all the known pre-existing react-refresh
fast-refresh category, issue #75 — not blocking).

## Open questions / deferred (need the user)
- Native EN/IT/RU copy review (drafts shipped)
- BotFather **Menu Button** URL still points at site root → "Launch app"
  shows the website; set it to `https://app.majstr.xyz/onboard`
- Real-device QA of the language switch + translated wizard end-to-end

## Next steps
- [ ] User: device-test language switch (bot first message) + wizard in
      it/en/ru; confirm website→bot handoff (open site in EN → bot in EN)
- [ ] User: update BotFather Menu Button to /onboard
- [ ] User/native speaker: review EN/IT/RU copy in backend/i18n.js and
      frontend/src/onboarding/i18n.tsx
- [ ] Reconcile board (gh) for the new i18n issues if desired
