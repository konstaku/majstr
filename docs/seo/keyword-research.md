# RU/UK Diaspora Keyword Research — Masters in Italy

Source: SEO Specialist agent, 2026-06-05. Drives `web/lib/seo-data.ts` & `web/lib/content.ts`.

## Strategic summary
- **Supply is invisible to search** — real masters live on Instagram/Facebook/forums with zero SEO.
- **barb.pro** is the only structured competitor: `/{country}-{lang}/{city}/{service}`, e.g.
  `/it-ru/milan/master`. **Russian-only, beauty-only, salon-level (no per-master pages), thin
  inventory.** Beatable on language (UK), verticals (trades/medical/tutoring), and entity depth.
- **ruprofi.com** validates the model but is country-level only & ~92 profiles globally.
- **Yandex is viable**: Italian region IDs exist (Milan 10448, Rome 10445).

## Query patterns
- Dominant typed form: **`{service} {city-nominative}`** ("маникюр милан") → use in `<title>`/URL.
- Strong secondary: **`{service} в {city-prepositional}`** ("маникюр в милане") → use in `<h1>`/body.
- High-intent qualifier: **`русский/русскоязычный`** (RU) / **`український/українською`** (UK) —
  the diaspora explicitly searches for language match. This is Majstr's wedge → dedicated `/uk/` tree.

## Profession slugs + H1 leads (implemented in `seo-data.ts`)
`{title}` uses nominative city; `{h1}` = lead + prepositional city.

| profession_id | ru_slug | uk_slug | ru lead | uk lead |
|---|---|---|---|---|
| manicurist | manikyur | manikyur | Маникюр | Манікюр |
| pedicurist | pedikyur | pedykyur | Педикюр | Педикюр |
| hairdresser | parikmaher | perukar | Парикмахер | Перукар |
| beautician | kosmetolog | kosmetolog | Косметолог | Косметолог |
| makeup_artist | vizazhist | vizazhyst | Визажист | Візажист |
| eyebrows | brovist | brovist | Мастер бровей | Майстер брів |
| massage | massazh | masazh | Массаж | Масаж |
| tattoo_artist | tatu | tatu | Тату-мастер | Тату-майстер |
| electrician | elektrik | elektryk | Электрик | Електрик |
| plumber | santehnik | santehnik | Сантехник | Сантехнік |
| dentist | stomatolog | stomatolog | Стоматолог | Стоматолог |
| doctor | vrach | likar | Русскоязычный врач | Україномовний лікар |
| photographer | fotograf | fotograf | Фотограф | Фотограф |
| translator | perevodchik | perekladach | Переводчик | Перекладач |
| tutor | repetitor | repetytor | Репетитор | Репетитор |
| … | | | | (full set in `seo-data.ts`, incl. carpenter, painter, mechanic, lawyer, nanny, mover, taxi, etc.) |

Identical ru/uk slugs are fine — disambiguated by the `/ru/` vs `/uk/` path prefix.

## City prepositional forms (implemented; data already carries `ru_alt`/`ua_alt`)
RU is always "в"/"во"; UK alternates "у"/"в". Indeclinable in RU: Брешиа, Бари, Лечче.

| city | ru | uk |
|---|---|---|
| milan | в Милане | у Мілані |
| rome | в Риме | в Римі |
| turin | в Турине | у Турині |
| naples | в Неаполе | у Неаполі |
| florence | во Флоренции | у Флоренції |
| genoa | в Генуе | у Генуї |
| bologna | в Болонье | в Болоньї |
| … | (full set in `seo-data.ts` `CITY_PREP`; others derived from API `ru_alt`/`ua_alt`) | |

## Priority (build/strengthen first)
Cities: **Milan, Rome** (Tier A) → Turin, Naples, Bologna, Florence, Genoa, Verona (Tier B).
Top combos: manicurist×Milan, manicurist×Rome, hairdresser×Milan/Rome, beautician×Milan,
manicurist×Turin, eyebrows×Milan, makeup×Milan, massage×Milan, electrician/plumber/dentist×Milan.

## Title/description/FAQ/intro
Templates implemented in `web/lib/content.ts`. Title brand suffix ` | Majstr`. Show counts only
when ≥5 ("— 24 мастера") to avoid "— 2 мастера" + agreement bugs. Plural rule (one/few/many) in
`web/lib/i18n.ts`.

## Cannibalization rule (enforced)
- City **landing** `/{lang}/{prof}/{city}` OWNS `{profession} {city}` — city in title/H1.
- **Profession hub** `/{lang}/{prof}` targets `{profession} Италия` — **no city** in title.
- **City hub** `/{lang}/{city}` targets `мастера {city}` — **no single profession** in title.

## Yandex actions
Webmaster verify + submit sitemaps; set site region (Milan 10448); create a Yandex Business card;
prioritize **behavioral factors** (fast LCP, rich scrollable grids, dwell) and **text originality**
(≥60% unique body); avoid keyword stuffing (Baden-Baden filter); drive brand/direct traffic.
Backlinks matter less on Yandex than Google.
