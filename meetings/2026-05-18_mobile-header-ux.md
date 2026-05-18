# Meeting: Mobile Header / Navigation UX Spec — Majstr
Date: 2026-05-18

## What we discussed
Reworked the mobile (≤640px) header for the brutalist Majstr site. The founder wants a compact, always-visible sticky bar (logo left, "Join as master" CTA right), the large MAJSTR. wordmark band to scroll away, and a fix for the broken burger overlay that currently opens off-screen at the top of the page after scrolling.

## Scope & guardrails
- **READ-ONLY analysis.** This document is the implementation contract; a Frontend Developer agent applies the changes to `frontend/src/components/Root.tsx` and `frontend/src/styles.css`.
- **Mobile primarily ≤640px.** Desktop (≥861px) and the existing 641–860px tier must remain visually unchanged except for the CTA relabel (item 1, which is global).
- Brutalist tokens are fixed: `--ink #0e0a06`, `--paper #fffaf0`, `--cream #f4ede0`, `--terra #c84b31`, `--border: 2px solid var(--ink)`, `--font-display` (Archivo Black), `--font-mono` (JetBrains Mono). No new colors, no radii, no shadows beyond existing brutalist offsets.

---

## 1. CTA relabel — "Join as master" (global, all 9 languages)

### Decision
The top-right `AddMasterCta` (`<button class="cta-header">`) and its sibling nav link must read **"Join as master"**, not the current `t("nav.addMaster")` + ` →`.

### Implementation
- **Do NOT hardcode English.** Add a new localized key `nav.joinAsMaster` to the `nav` object in `frontend/src/i18n/translations.ts`. The `LangTranslations` type (line 2) must be extended:
  ```ts
  nav: { search: string; addMaster: string; joinAsMaster: string; faq: string; howItWorks: string; forBusiness: string };
  ```
- Provide a translation for **all 9 `APP_LANGS`** (`en, uk, ru, it, pt, de, fr, tr, es`) — each language block in `translations.ts` has its own `nav:` line; every one must get `joinAsMaster`. `addMaster` stays as-is (it's still used by the burger link, footer, and `AddMasterLink` nav item — do not remove it).
- Suggested baseline copy (founder to confirm/refine — see Open Questions):
  | lang | joinAsMaster |
  |---|---|
  | en | Join as master |
  | uk | Стати майстром |
  | ru | Стать мастером |
  | it | Unisciti come artigiano |
  | pt | Junte-se como artesão |
  | de | Als Fachkraft beitreten |
  | fr | Devenir artisan |
  | tr | Usta olarak katıl |
  | es | Únete como profesional |
- In `Root.tsx`, `AddMasterCta` becomes:
  ```tsx
  const AddMasterCta = (
    <button type="button" className="cta-header" onClick={openAddMasterModal}>
      {t("nav.joinAsMaster")}
    </button>
  );
  ```
  **Drop the trailing ` →` arrow** — it bloats width on mobile and the brutalist CTA reads strong without it. (If desktop must keep an arrow, gate it with a `<span aria-hidden> →</span>` hidden under 640px via CSS. Default recommendation: remove entirely for consistency.)
- Add `type="button"` (currently missing) so the CTA never submits an ancestor form. It is already a real `<button>` with an `onClick` opening the modal — keep it a button (accessibility item).
- The localized string can be long (German/Portuguese). The CTA must not wrap or overflow the bar — see §3 sizing rules.

---

## 2. Mobile header anatomy (≤640px) — shown vs hidden

The header keeps its two existing DOM bands (`.header-meta` then `.header-wordmark`) — no DOM restructure required for the bar itself. Visibility is redefined for mobile:

| Element | Desktop (≥861px) | Mobile (≤640px) | Notes |
|---|---|---|---|
| `.header` wrapper | sticky top:0 | **NOT sticky** (`position: static`) on mobile — see §3 | Override the base `position: sticky`. |
| `.header-meta` (bar) | full meta strip | **The sticky bar.** Becomes: logo (left) + burger + CTA (right) | Re-purposed as the compact bar. |
| `.header-meta-label` ("EST. 2023 · WEEK …") | shown | **hidden** (`display:none`) | Per founder; frees the left slot for the logo. |
| `.header-nav` | shown | hidden (already `display:none` ≤860px) | Unchanged. |
| `.header-controls` (country/lang + CTA) | shown | **partially shown:** the CTA is lifted out to stay visible; country/lang stay in burger | See §3 for the CTA placement approach. |
| `.burger-open` (≡ toggle) | hidden | **shown**, inside the sticky bar | Already `display:flex` ≤640px. |
| `.header-wordmark` (big MAJSTR.) | shown, sticky-attached | **shown but NOT sticky** — scrolls away with page | This is the key behavior change (§3, item 3). |
| Compact logo (in bar) | n/a | **shown** — small "MAJSTR." text Link, left of bar | New element; see §3. |

### Bar layout (≤640px), left → right
`[ MAJSTR. compact logo Link ] ……… flex spacer ……… [ ≡ burger ] [ Join as master CTA ]`

- Left: a **new compact wordmark Link** — `<Link to="/" className="header-logo-compact">MAJSTR<span class="wordmark-dot">.</span></Link>` with the same `RESET_SEARCH` dispatch on click as the big wordmark. `font-family: var(--font-display)`, `font-size: 20px`, `letter-spacing: -0.04em`, `text-transform: uppercase`, `color: var(--ink)`; dot stays `--terra`.
- Right cluster: burger (`.burger-open`, 36×36 ink square, existing) then the CTA. `gap: 8px`.
- The big `.header-wordmark` band stays in the DOM directly below the bar and is allowed to scroll up out of view.

---

## 3. Sticky / positioning model (the core change)

### What is sticky vs static vs fixed
- **The compact bar (`.header-meta`) is the only persistent element on mobile.** Make it `position: sticky; top: 0; z-index: 200;` **scoped to ≤640px**. Sticky (not fixed) is preferred: it keeps document flow intact, so no content jumps under it and no manual top-padding hack is needed.
- **`.header` wrapper:** override to `position: static` at ≤640px so the wrapper does not create a sticky context that drags the wordmark band along. The sticky behavior moves down to `.header-meta` specifically.
- **`.header-wordmark`:** explicitly `position: static` (it inherits nothing problematic, but assert it) so it scrolls away normally. Keep its existing mobile padding (`8px 16px`).
- **CTA persistence:** because the whole `.header-controls` is `display:none` at ≤640px, the CTA must be reachable on mobile. **Recommended approach (minimal DOM change):** render the CTA a second time *inside the bar* for mobile, OR restructure so the CTA lives in the bar for all breakpoints. Opinionated pick:
  - Add a mobile-only CTA element inside `.header-meta` (e.g. wrap burger + CTA in a `<div class="header-bar-actions">`), and keep the desktop CTA where it is inside `.header-controls`. Gate with media queries: `.header-bar-actions` is `display:none` ≥641px; the desktop `.header-controls` CTA is the one shown ≥641px. This avoids touching the desktop layout at all. Both buttons call the same `openAddMasterModal`.
  - Do **not** duplicate the `AddMasterModal` — only the trigger button is rendered twice; the modal stays single, controlled by `showAddMasterModal`.

### z-index layering (mobile)
| Layer | z-index | Element |
|---|---|---|
| Sticky bar | 200 | `.header-meta` (mobile) |
| Burger overlay | 190 | `.menu-burger.open` (sits *below* the bar so the bar/burger toggle stays tappable) |
| AddMaster modal | 500 | `.modal-overlay` (existing, unchanged — must stay above everything) |
| Lang popover | 50 | `.lang-popover` (inside burger; fine) |

Rationale: the bar must stay above the burger overlay so the user can always see the ≡/✕ toggle and the CTA while the menu is open. The existing modal at 500 already wins over both — keep it.

### Sizing / overflow rules for the bar
- Bar height target ~52–56px. `padding: 8px 16px` (existing mobile value is fine).
- `.header-meta` mobile: `display:flex; align-items:center; justify-content:space-between; gap:8px;`
- Compact logo: `flex: 0 0 auto; white-space:nowrap;`
- `.header-bar-actions`: `flex: 0 0 auto; display:flex; align-items:center; gap:8px;`
- CTA on mobile: keep `.cta-header` styling but tighten — `padding: 8px 12px; font-size: 12px; white-space:nowrap;` and `max-width` not needed if the arrow is removed and copy is the single localized string. If the longest translation (German "Als Fachkraft beitreten") still overflows on a 320px viewport, allow the compact logo to truncate before the CTA: give logo `min-width:0; overflow:hidden; text-overflow:clip;` — the CTA is the priority element and must never shrink or wrap.

---

## 4. Burger overlay bug fix

### Bug
`.menu-burger` is `position: relative` in normal flow, rendered as a sibling right after `</header>`. When the user has scrolled down and opens it, it appears at its in-flow position (top of document, off-screen above the viewport), so the menu looks like it "didn't open."

### Fix — viewport-fixed overlay anchored under the sticky bar
At ≤640px, when `.open`:
- `position: fixed;`
- `top: <bar height>` — anchor directly under the sticky bar. Use a CSS variable so it stays in sync: define `--bar-h: 56px;` on `:root` (or on `.header-meta`) and set `top: var(--bar-h)`. (Acceptable simpler alternative: `top: 56px;` hardcoded with a code comment that it must match the bar height.)
- `left: 0; right: 0; bottom: 0;` → covers the **entire remaining viewport** below the bar.
- `width: 100%;` `z-index: 190;` (below the bar's 200 so the toggle stays visible/tappable).
- `background: var(--paper);` (already set) — must be fully opaque to hide page content behind it. Keep `border-bottom: var(--border)` but it's now off-screen; not harmful. Add `border-top: var(--border)` so there's a crisp brutalist seam against the bar.
- `overflow-y: auto;` `-webkit-overflow-scrolling: touch;` so a long menu (links + country/lang controls) scrolls within the overlay itself.
- The inline `style={{ display: showBurgerMenu ? "block" : "none" }}` in `Root.tsx` stays as the show/hide mechanism (it already works); the CSS `.menu-burger.open { display:block }` at ≤640px is redundant with it but harmless — keep behavior identical, just change positioning. Recommended: keep the inline display toggle as the single source of truth and ensure the `.open` CSS only adds positioning, not `display`.

### Body scroll-lock
When the burger is open, lock background scroll so touch-drag doesn't move the page behind the overlay:
- In `Root.tsx`, add a `useEffect` keyed on `showBurgerMenu`:
  ```tsx
  useEffect(() => {
    if (!showBurgerMenu) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [showBurgerMenu]);
  ```
- This must also run when the menu closes via the existing `onClick={() => setShowBurgerMenu(false)}` on the overlay and via the link clicks (they already call `setShowBurgerMenu(false)`), so the cleanup restores scroll. No extra wiring needed beyond the effect.
- Edge: if the AddMaster modal opens *from* the burger ("Add master" burger link calls `setShowBurgerMenu(false)` then `openAddMasterModal()`), the burger's scroll-lock cleanup runs and the modal's own overlay (`.modal-overlay`, `position:fixed; overflow-y:auto`) takes over — acceptable, no double-lock conflict because the burger closes first. Verify order: `setShowBurgerMenu(false)` then `openAddMasterModal()` (current order is correct).

### Anchor point & close behavior
- Anchor: top edge flush under the sticky bar (`top: var(--bar-h)`), full-bleed to viewport bottom.
- Burger toggle (`.burger-open`) stays in the bar and is always visible above the overlay (z 200 > 190). It should toggle open/closed. **Recommended polish:** swap its glyph based on state — show `≡` when closed, `✕` when open — by passing state into the button content in `Root.tsx`:
  ```tsx
  <button className="burger-open" aria-expanded={showBurgerMenu}
    aria-controls="mobile-menu" aria-label={showBurgerMenu ? "Close menu" : "Open menu"}
    onClick={() => setShowBurgerMenu(v => !v)}>
    {showBurgerMenu ? "✕" : "≡"}
  </button>
  ```
- Close paths (all must work): (a) tap toggle again, (b) tap any link in the menu (already wired), (c) tap the overlay backdrop area outside the `<ul>` (already wired via overlay `onClick`), (d) press `Escape` (NEW — add a keydown listener in the scroll-lock effect or a small dedicated effect; on `Escape` call `setShowBurgerMenu(false)`).
- The `burger-controls` `<li>` already `stopPropagation` so interacting with country/lang doesn't close the menu — keep.

---

## 5. Interaction flow (mobile, ≤640px)

1. Page loads → compact bar visible at top (logo left, ≡ + "Join as master" right). Big MAJSTR. wordmark band sits below it.
2. User scrolls down → wordmark band scrolls away; **bar stays pinned** at top (sticky). CTA always reachable.
3. User taps **"Join as master"** → `AddMasterModal` opens (z 500, over everything). Bar can stay sticky behind the dark modal overlay; modal has its own scroll. Closing returns to scroll position.
4. User taps **≡** → burger overlay covers the viewport from just below the bar to the bottom; background scroll locked; toggle glyph becomes ✕.
5. In the menu: Search / Add master / FAQ links + country & language controls. Tapping a link navigates and closes the menu (scroll unlocks). Tapping ✕ or the backdrop or pressing Esc closes it.
6. "Add master" inside the burger closes the burger then opens the modal (single modal instance).

---

## 6. Accessibility

- **Tap targets ≥44×44px.** `.burger-open` is currently 36×36 — **bump to min 44×44** at ≤640px (`width:44px; height:44px;`). The CTA at `padding:8px 12px; font-size:12px` yields ~38–40px height — **enforce `min-height:44px`** on `.cta-header` at ≤640px. Compact logo Link: ensure tappable area `min-height:44px` (add vertical padding or `display:inline-flex; align-items:center`).
- **CTA is a real `<button>`** with `type="button"` and an accessible name = the visible localized text. Keep it a button (it triggers a modal, not navigation) — do not convert to a link.
- **Burger toggle:** `aria-expanded={showBurgerMenu}`, `aria-controls="mobile-menu"`, dynamic `aria-label` ("Open menu" / "Close menu"). Add `id="mobile-menu"` to the `.menu-burger` div.
- **Focus management:** on open, move focus to the first focusable element in the overlay (first `<li> <Link>`); on close, return focus to `.burger-open`. Implement with refs + the open effect. Trap is optional but recommended given full-screen overlay; at minimum ensure `Escape` closes and focus returns.
- **Reduced motion:** no new animations introduced; if any transition is added to the bar/overlay, wrap in `@media (prefers-reduced-motion: reduce)` to disable.
- Wordmark dot and burger glyph are decorative-adjacent; the logo Link's accessible name is "MAJSTR." (text content) — fine. Burger glyph `≡`/`✕` is decorative, the `aria-label` carries meaning.
- Color contrast: terra `#c84b31` on paper for the CTA text is paper-on-terra (white-ish on terra) — already used site-wide; unchanged.

---

## 7. Edge cases

- **Very narrow viewport (320px):** longest CTA label (de/pt) + logo must fit. Priority: CTA never shrinks/wraps; compact logo truncates first (`min-width:0; overflow:hidden`). Hide the `.header-meta-label` (already specified) frees space. Test "Als Fachkraft beitreten" at 320px.
- **Landscape phone / very short height:** burger overlay is `overflow-y:auto` so content scrolls; bar stays pinned. Fine.
- **iOS Safari URL bar resize / `100vh`:** use `top/left/right/bottom:0` anchoring (not `height:100vh`) so the overlay tracks the real viewport without `100vh` jump. (Spec already uses `bottom:0` — good; do not use `height:100vh`.)
- **Sticky + transformed ancestor:** none of `.header`/body have transforms; sticky on `.header-meta` is safe. Verify no parent gets `overflow:hidden` that would clip sticky (body has none).
- **Language switch while bar is rendered:** CTA text length changes live (uk→de). Layout must reflow gracefully (flex handles it); re-verify no overflow after switching to the longest language.
- **Modal opened from burger:** burger closes (scroll-unlock) → modal opens (own scroll-lock via its fixed overlay). No competing `body.overflow` writers because they don't overlap in time. If a future change opens them simultaneously, revisit.
- **Country selector currently disabled** (`COUNTRY_SELECTOR_ENABLED = false`) → `CountryToggle` renders `null`; burger controls row will show only the language switcher. Spec is unaffected; do not re-enable.
- **641–860px tier:** `.header-controls` is still visible there, `.burger-open` hidden, wordmark not sticky originally. Keep this tier as-is — scope all new sticky/bar rules to `@media (max-width: 640px)` only. Do not let the new sticky `.header-meta` rule leak above 640px.
- **Desktop regression check:** the only intended desktop change is the CTA label (and arrow removal). Diff desktop header before/after to confirm `.header-meta`, `.header-wordmark`, `.header-controls` positioning is byte-identical aside from button text.

---

## Decisions made
- New i18n key `nav.joinAsMaster` added to the `LangTranslations` type and all 9 language blocks; `nav.addMaster` retained for burger/footer/nav-item.
- Trailing ` →` removed from the header CTA.
- Mobile: `.header-meta` repurposed as the single sticky bar (logo left, ≡ + CTA right); `.header-meta-label` hidden; big wordmark band scrolls away (static).
- Sticky lives on `.header-meta` (z 200), `.header` wrapper made static at ≤640px.
- CTA rendered as a mobile-only trigger inside the bar (`.header-bar-actions`), desktop CTA untouched; one shared modal.
- Burger overlay → `position:fixed`, anchored `top:var(--bar-h)`, full-viewport, opaque paper, `overflow-y:auto`, z 190 (below bar), body scroll-lock via `useEffect`, Escape-to-close, focus management.
- Tap targets raised to ≥44px (burger 44×44, CTA min-height 44).
- All new CSS scoped strictly to `@media (max-width: 640px)`.

## Open questions (founder must confirm)
- [ ] **CTA copy per language** — approve/correct the 9 `joinAsMaster` translations in the table above (esp. uk "Стати майстром", de, pt). These are baseline suggestions.
- [ ] **Arrow** — confirm removing ` →` from the CTA globally (recommended) vs keeping it desktop-only.
- [ ] **Compact logo wording** — "MAJSTR." text (matches brand) vs an even shorter mark; confirm text is acceptable on smallest screens.

## Next steps
- [ ] Frontend Dev: add `nav.joinAsMaster` to `translations.ts` (type + 9 blocks) pending copy confirmation.
- [ ] Frontend Dev: implement bar restructure + sticky model in `Root.tsx` / `styles.css` (≤640px scoped).
- [ ] Frontend Dev: implement burger fixed-overlay fix + scroll-lock + Escape + focus return.
- [ ] Frontend Dev: enforce ≥44px tap targets; add `type="button"` + ARIA to CTA and burger toggle.
- [ ] QA: 320px / 360px / 414px widths, landscape, iOS Safari, language-switch reflow, desktop no-regression diff.
