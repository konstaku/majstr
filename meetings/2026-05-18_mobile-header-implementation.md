# Meeting: Mobile Header Redesign — Implementation
Date: 2026-05-18

## What we discussed
Implemented the build-ready mobile header / burger-fix spec
(`2026-05-18_mobile-header-ux.md`) against `Root.tsx`, `styles.css`, and
`translations.ts`, applying the four resolved founder decisions
(minimal-DOM CTA persistence, global arrow removal, MAJSTR. text logo,
new `nav.joinAsMaster` i18n key).

## Options considered
- CTA persistence: structural refactor vs minimal-DOM dual-render.
  Chose minimal-DOM (founder decision) — zero desktop regression.
- Shared JSX constant rendered twice vs render-function factory.
  Chose `renderAddMasterCta()` factory so each placement is an
  independent element; single shared modal preserved.
- Focus-restore ref read in cleanup vs captured local. Chose captured
  local (`toggleEl`) to satisfy `react-hooks/exhaustive-deps` and avoid
  introducing a new lint warning.

## Decisions made
- `nav.joinAsMaster` added to `LangTranslations` type + all 9 language
  blocks; `nav.addMaster` retained for burger/footer/nav-item.
- Trailing ` →` removed from the header CTA globally; `type="button"` +
  `aria-label` added.
- `.header-meta` repurposed as mobile sticky bar (z 200); `.header`
  static on mobile; wordmark band scrolls away.
- Mobile-only `.header-bar-actions` (burger + CTA) + compact logo Link,
  both CSS-gated to `@media (max-width: 640px)`; desktop untouched.
- Burger overlay → `position: fixed; top: var(--bar-h)`, full viewport,
  opaque paper, z 190, `overflow-y:auto`; `--bar-h: 56px` token added.
- Scroll-lock + Escape-close + focus in/out via one `useEffect`.
- Tap targets: burger 44×44, CTA min-height 44, logo min-height 44.

## Open questions
- None — all spec open questions were resolved by founder decisions.

## Next steps
- [ ] QA at 320 / 360 / 414px, landscape, iOS Safari, language-switch
      reflow, and a desktop no-regression diff.
- [x] tsc / build pass; lint introduces no new warnings (9 known remain).
