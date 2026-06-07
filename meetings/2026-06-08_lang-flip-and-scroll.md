# Meeting: UI language flip + scroll jump on search (non-uk/ru)
Date: 2026-06-08

## What we discussed
Follow-up to the 2026-06-07 404 fix. With the lang clamped to uk/ru, searching
in Italian ("all Italy" + "medicine") now loads instead of 404ing — but the page
briefly shows Italian results, then flips to Ukrainian, and the scroll jumps.

## Root cause
1. **Language flip** — every route page seeds `lang` from its URL locale
   (`buildSeed` → uk/ru). Navigating remounts `MasterContextProvider`, whose
   initial state takes the seed's lang. There was no localStorage restore, so an
   Italian visitor got snapped back to uk on every navigation (search, master
   card clicks, etc.).
2. **Scroll jump** — `router.push` defaults to `scroll: true`, yanking the
   remounted page to the top. The old scroll-to-results `setTimeout` also held a
   stale `resultsRef` (nulled by the remount), so it no-op'd.

## Decisions made
- `spa/context.tsx`: restore the user's saved language from localStorage on
  provider mount via an isomorphic layout effect (`useLayoutEffect` on client →
  runs before paint, so the seeded uk locale never visibly flashes). Fixes the
  flip across ALL navigations, not just search.
- `spa/pages/Main.tsx` search handler: `router.push(url, { scroll: false })` +
  scroll-to-results via `document.querySelector(".results-section")` instead of
  the stale ref.
- URL locale (uk/ru) stays the SEO/SSR source of truth; display language is now
  a persistent user choice layered on top.

## Trade-offs
- On a HARD load of /uk by an Italian user there may be a one-frame uk paint
  before the layout effect restores it. Acceptable + SEO-correct (crawlers get
  uk; they don't run effects). Soft navigations (the reported case) have no
  flash because the layout effect fires pre-paint.

## Next steps
- [ ] Deploy to main and verify: Italian + "all Italy" + "medicine" stays
      Italian, no scroll jump, master-card clicks keep Italian too.
- [ ] Re-check back/forward language behavior.
