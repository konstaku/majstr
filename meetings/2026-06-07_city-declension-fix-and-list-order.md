# Meeting: City declension fix + city list order
Date: 2026-06-07

## What we discussed
Ukrainian city names were showing in prepositional/locative case ("Мілані", "Вероні") in two SPA
places — the city dropdown labels and the document title set when a modal opens. This was a holdover
from old website logic that no longer exists. We also identified that Bergamo and Palermo were missing
from the city list despite being significant cities for the Ukrainian diaspora.

## Options considered
- Fix at the data layer (remove ua_alt from DB): rejected — ua_alt is still needed for prepositional
  phrases in Next.js SEO page copy ("майстри у Мілані")
- Fix at the display layer (stop reading ua_alt in the wrong places): chosen — surgical, correct

## Decisions made
- `web/spa/pages/Main.tsx`: replaced `loc?.name.ua_alt ?? localizedName(...)` with plain
  `localizedName(loc?.name, lang)` in two places (dropdown labels + modal document.title)
- Added **Bergamo** (Lombardy — large Ukrainian community) and **Palermo** (Sicily's capital,
  largest Sicilian city) to the city list:
  - `backend/scripts/add-italy-cities.js` — idempotent migration script
  - `backend/data/backup/locations.json` — backup updated
  - `web/lib/seo-data.ts` — CITY_REGION and CITY_PREP entries added for both

## Open questions
- Should Messina stay (3 Sicily cities vs Palermo + Catania)? Kept for now since masters may be there
- Other possible additions: Trieste, Bergamo satellite towns?

## Next steps
- [ ] Run `cd backend && node scripts/add-italy-cities.js` to add the cities to MongoDB
