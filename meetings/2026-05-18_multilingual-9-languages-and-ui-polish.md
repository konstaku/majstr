# Meeting: Multilingual (9 languages) + UI polish
Date: 2026-05-18

## What we discussed / built
Expanded the platform to **9 UI languages** (en, uk, ru, it, pt, de, fr,
tr, es) end-to-end, plus a series of UI corrections. Translation content
was produced by Content Creator agents and reviewed by Brand Guardian, per
the founder's instruction.

## Decisions made
- Canonical language set: `en, uk, ru, it, pt, de, fr, tr, es`. Single
  source: `frontend/src/i18n/lang.ts` (APP_LANGS) + `backend/lang.js`.
- `localizedName(entity, lang)` with fallback chain
  (requested→en→uk→any→id) for all reference data; never renders blank.
- Reference schemas gained it/pt/de/fr/tr/es name fields (additive).
- **RU is never a flag** — always the text label "RU", everywhere.
- Per-language "card" noun (locked, Brand-Guardian-reviewed): pt cartão ·
  de Profilkarte · fr fiche · tr profil kartı · es ficha. Formality: pt
  você, de du, fr vous, tr siz, es tú, ru/uk/it informal.
- Website language switcher = **only the active language shown; clicking
  it opens the full 9-language menu** (popover). Country selector hidden
  (Italy-only) via `COUNTRY_SELECTOR_ENABLED` flag.
- Telegram bot offers **only uk/en/ru**; "Add master" is the primary CTA
  (first, full-width, most prominent); other 6 languages live only in the
  Mini App/website.
- Header-nav "Add master" = a `.nav-item` (like HOW IT WORKS / FOR
  BUSINESS, uppercase) but active; the top-right `.cta-header` terra
  button restored (localized).
- `AddMasterModal` localized (JOIN_MODAL, 9 langs) + rebuilt with a tidy
  brutalist `.join-modal` layout.
- Brand Guardian asks: (1) es glossary approved as-is; (2) login.error
  rewritten to plain language in all 9 (no "token/jeton/токен"); (3)
  ru/tr punchy-slogan register kept as an intentional voice device.
- Reference-data flagged terms: only `uomini` (junk) deleted; the other 6
  (therapist=internist sense, lawyer≠attorney, pediatric_nurse id/name
  mismatch, eyebrows, handcraft_master, TR colloquialisms) kept as-is.
- Site OG: English copy + brand-typeface image (Archivo Black), exported
  from `design mockups/OG image/og-source.html` to
  `frontend/public/og-image.png` (2400×1260), meta synced.

## Ops scripts added (run against the IP-locked DB by the user)
- `seed-staging-reference.js` — copy reference collections to staging DB.
- `seed-staging-masters.js` — copy approved masters (staging had none →
  dev showed no masters; root cause of that bug).
- `export-reference.js` / `import-reference-translations.js` — worksheet
  round-trip for reference translations.
- `delete-location.js` — remove junk locations (used for `uomini`).
- `generate-site-og.js` — code fallback for the OG image.

## Open / deferred
- Native review pass of the agent-produced pt/de/fr/tr/es copy.
- Refresh social cache (FB debugger / @WebpageBot) after deploy.
- Pre-existing lint `--max-warnings 0` vs react-refresh warnings (#75).

## Next steps
- [ ] User: refresh OG cache on FB/Telegram after deploy.
- [ ] Optional: native-speaker review of new-language copy.
