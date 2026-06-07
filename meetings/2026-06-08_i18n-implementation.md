# Meeting: URL-driven i18n implementation (uk/ru/en live)
Date: 2026-06-08

## What we did
Executed the full URL-driven i18n migration from the architect's plan
(`web/docs/i18n-url-driven-migration.md`), all the way to English fully active
and indexed. Per owner decision: locales = uk, ru, en; en is indexed (not gated).

## Changes (web/)
**Step 0 — URL is the single source of truth for language**
- Deleted client lang machinery: `getInitialLang`, the localStorage restore
  layout-effect, `SET_LANGUAGE` action + reducer case, `setLang`, `urlLang()`.
- `context.tsx`: `lang` seeded once from the URL, never mutated client-side.
- Language switcher (`Root.tsx`) is now `<Link>`-based — switching language is a
  navigation to the same path in the target locale (segment swap; city/category/
  master ids are language-independent).
- `Main.tsx` search nav, `Modal.tsx` pushState, `MasterCard.tsx` href, footer
  privacy link all use the real URL locale (no clamp).

**Step 1 — en locale + gate**
- `LANGS = ["uk","ru","en"]`. Added `EN_INDEXED` flag + `INDEXED_LANGS` +
  `isIndexable()`. Sitemap + hreflang iterate `INDEXED_LANGS`; per-page `robots`
  honors the gate. en master pages gated in `generateStaticParams`.
- Added en to `NAME_KEY`/`PREP_KEY`/`HTML_LANG`/`OG_LOCALE`, English plural rule,
  and `T.en`.

**Step 2 — per-locale `<html lang>`**
- Moved `<html>`/`<body>` + fonts + GTM into `app/[lang]/layout.tsx`
  (`HTML_LANG[lang]`); root `app/layout.tsx` is now a pass-through (global CSS +
  base metadata). Added `app/not-found.tsx` rendering its own document (the root
  no longer wraps top-level 404s). Verified: /uk→uk, /ru→ru, /en→en. This also
  fixed a pre-existing bug where ru served `lang="uk"`.

**Step 3 — English content**
- `lib/content.ts`: en branch for all 12 copy builders.
- `lib/seo-data.ts`: en authored for PROFESSION_SEO (slug/lead/sub), TIPS,
  CITY_PREP, CITY_REGION (all 37 professions / 17 cities).
- `lib/data.ts`: `cityPrep` en fallback ("in <City>").
- Page titles/descriptions: en branches (home, city, category, city×category).
- Fixed `Main.tsx` hero stat: added the missing ru branch (ru was showing English).

**Step 4 — activate**
- `EN_INDEXED = true`: en in sitemap + hreflang, pages indexable.

## Verification
- `npm run build` green: 1403 static pages (3 locales).
- `<html lang>` correct per locale; `_not-found` has html/body.
- en pages render real English titles/descriptions/master pages; uk titles
  unchanged (URLs/slugs byte-identical → no SEO regression).
- hreflang includes uk/ru/en; en pages not noindexed.

## Known limitation (data, not code)
Master *data* (names, bios, tags) is Ukrainian/Russian. en pages have English
chrome (titles, h1, intro, UI, FAQ — the indexable text) but card names are
transliterated and bios stay Cyrillic. Future: store `about_en` / English tags.

## Next steps
- [ ] Deploy to main (Vercel prod). Submit updated sitemap in Search Console.
- [ ] Monitor Search Console for thin/duplicate flags on /en; `EN_INDEXED=false`
      is the one-line rollback if needed.
- [ ] (Optional cleanup) prune unused 9-lang tables in `spa/i18n/lang.ts` +
      `translations.ts` (it/pt/de/fr/tr/es) — dead but harmless.
