# Meeting: Onboarding ignored France when entered from fr.majstr.xyz
Date: 2026-06-26

## What we discussed
A master arriving from fr.majstr.xyz and starting onboarding in the Telegram
Mini App couldn't be filed under France — the wizard's country was hardcoded to
Italy and the FR host context was lost crossing from the public site (Safari)
into the Mini App (a separate webview on app.majstr.xyz that can't see the
originating host or its localStorage).

## Root cause
- `StepLocation` showed a read-only "🇮🇹 Italy" + "works only in Italy" hint and
  the city picker listed all cities regardless of country.
- The deep link that launches the bot (`AddMasterModal`) encoded only lang +
  referral token in the start_param — never the country.
- The draft `countryID` therefore stayed at its `IT` default.

## Decision — carry country across the webview boundary
Mirror the existing referral-token mechanism (host → start_param):
- `AddMasterModal` reads the country from the host (`countryForHost`) and appends
  it as `-co-<iso>` to the start_param (and `?country=` on the web `/add`
  fallback). Only non-default (FR) is carried, so IT links stay byte-identical.
- New JSX-free `web/spa/onboarding/country.ts` → `resolveOnbCountry(search,
  startParam)` parses it (query > start_param > IT). Regex `-co[-_]([a-z]{2})`
  does not collide with the referral `-c-<token>` parser.
- `OnboardingWizard` seeds `useForm` `countryID` from it; a returning user's
  saved draft still wins (useDraft's `form.reset` runs after).
- `StepLocation` filters cities by `countryID` (legacy IT rows lacking
  `countryID` treated as IT) and shows the right country label; the misleading
  "only Italy" hint became country-neutral.

## Verified
- FR country + 9 FR cities exist in prod; `/api/reference/locations` returns
  `countryID`; backend `patchDraft` already validates FR via `isKnownCountry`.
- Web: typecheck clean, 32/32 unit tests pass (added `country.test.ts` +
  referral start_param cases).

## Open questions
- Country is still a read-only field set by the entry host — no in-wizard country
  switch. Fine while the host is the single source of truth; revisit if we ever
  want users to change country mid-onboarding.

## Next steps
- [ ] Ship (branch → PR → main); Vercel auto-deploys web/ from main.
- [ ] Smoke-test: open fr.majstr.xyz → "add card" → confirm wizard shows France
      and FR cities, and the submitted master lands in the FR catalogue.
