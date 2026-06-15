# Meeting: My Cards (Мої картки) edit-screen polish
Date: 2026-06-15

## What we discussed
Polished the TMA card-management screen (`frontend/src/pages/MyCards.tsx`) per
five user-reported issues: collapse the two-step action menu, declutter the edit
screen, drop the unimplemented availability feature, stop Enter from submitting
the form, and kill a beige stripe at the top of the editing screen.

## Decisions made
- Action row is now exactly **Редагувати** (primary) + **Видалити** (compact danger).
  Removed **Приховати** and all visibility code (`handleVisibility`, `visLoading`,
  `/visibility` PATCH). Status BADGE kept (`status` is now read-only from props).
- Edit opens the form directly; the action row is hidden while editing. Leaving
  edit mode is via a quiet "← Назад" affordance at the top + a low-key "Скасувати"
  under Save — no prominent button row.
- Removed the **Доступність** field, `availability` from `EditState`/`buildEdit`,
  the `AVAILABILITY_OPTIONS` constant, and from the PATCH body.
- Enter inside an `<input>` is now `preventDefault()`-ed via a form `onKeyDown`;
  `<textarea>` (Про себе) still takes newlines. Save button stays `type="submit"`.

## Root cause of the beige stripe
`styles.css` (bundled app-wide via `Main.tsx`) has a mobile rule
`@media (max-width:640px) { body { padding-top: var(--bar-h) /*56px*/ } }` to
offset the fixed website header. The standalone wizard routes (`/my-cards`,
`/onboard`, `/claim`) have no header, but the rule still applies — and since
`body { background: var(--cream) }` is beige, that 56px of padding rendered as a
beige band above the white `.wizard`. Confirmed via a headless harness: `.wizard`
started at y=56 on a 390px viewport. Fixed in `wizard.css` with
`body:has(> #root > .wizard) { padding-top: 0; background: var(--app-bg); }`
(`:has()` is already used elsewhere in wizard.css). Post-fix the wizard sits at
y=0 and body bg is the app/theme bg.

## Verification (all from a real 390px webview run)
- `npx tsc --noEmit` — clean
- `npx eslint src/pages/MyCards.tsx` — clean
- `npx vitest run src/pages/routeSmoke.test.tsx` — 4/4 pass (updated the Приховати
  assertion to assert its absence; Edit→form and profession-picker still pass)
- full `npx vitest run` — 38/38 pass
- `npx playwright test claim.spec.ts` — 2/2 pass (dev server did start)

## Next steps
- [ ] Consider extracting the body-padding/background reset into a shared
      "standalone surface" wrapper if more headerless routes appear.
