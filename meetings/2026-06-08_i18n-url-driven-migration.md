# Meeting: URL-Driven Fixed-Locale i18n Migration Plan
Date: 2026-06-08

## What we discussed
Designed a build-ready migration from the current dual-language-system mess (URL
locale uk/ru for SEO vs a 9-language client-state/localStorage UI switcher) to a
single URL-driven, fixed-locale architecture supporting uk/ru/en only. The
mismatch was causing 404s (client lang `it` leaking into nav URLs) and a
language-flip + scroll jump on route remount.

## Options considered
- Keep `state.lang` as a read-only mirror of the URL vs remove it entirely.
  Decision: keep it (write-once, seeded from server) — removing it is large
  pointless churn since useTranslation/MasterCard/Main/localizedName all read it.
- Switcher: seeded per-locale `localePaths` from server vs client string-rewrite
  of the path. Decision: ship string-rewrite in v1 (correct for all live routes
  since city/category/master segments are language-independent ids); upgrade to
  seeded localePaths only when per-profession slug landings go live.
- en content gating: robots.txt disallow vs per-page noindex. Decision: per-page
  `noindex` + omit en from sitemap/hreflang while gated (keeps link equity, keeps
  routes reachable), driven by one `EN_INDEXED` flag.

## Decisions made
- `LANGS = ["uk","ru","en"]`; delete urlLang(), getInitialLang(), the restore
  layout-effect, SET_LANGUAGE, localStorage lang, prune APP_LANGS/translations to 3.
- Existing /uk /ru URLs stay byte-identical (ids/slugs unchanged) → no redirects,
  no SEO regression. This is the core safety property.
- Fix the pre-existing `<html lang="uk">` hardcode (wrong for ru too) so it matches
  the URL locale.
- Sequencing: Step 0 clean uk/ru URL-driven fix (zero SEO change) → Step 1 add en
  as noindex locale → Step 2 html-lang fix → Step 3 author English template content
  → Step 4 flip EN_INDEXED=true.

## Open questions
- Does App Router allow `app/[lang]/layout.tsx` to own `<html>`/`<body>` while the
  root layout passes through? Verify with a build during Step 2.
- Confirm `translations` has a complete `ru` block (top blocks were uk/en/it/pt);
  hero stat sentence renders English for ru today — fix alongside.
- Whether to pre-generate en master pages at build or rely on dynamicParams while
  gated (build-time/cost tradeoff).

## Next steps
- [ ] Review/approve `web/docs/i18n-url-driven-migration.md`
- [ ] Execute Step 0 on `develop`, verify on dev.majstr.xyz, promote to main
- [ ] Author en template content (seo-data, content.ts, T, page titles)
- [ ] Audit/complete ru UI strings
