# Meeting: Sigil generator — algorithm + 3×3 variant
Date: 2026-05-25

## What we discussed
The Brand kit-2 spec defines a "master sigil" — a generative pattern that
substitutes for a portrait when a master has no photo. We needed to turn the
spec into a working, deterministic algorithm and add a 3×3 option alongside
the canonical 4×4. Output: a standalone HTML preview, not production code.

## Spec extracted from Brand kit-2.html
- Grid: 4 × 4 (canonical)
- Shapes: square · circle · triangle · bar · empty
- Colors: ink (#0E0A06) or terra (#C84B31) accent
- Fill rate: 6–10 of 16 cells
- Seeded & deterministic, one per master

## Algorithm chosen
1. **Hash**: FNV-1a 32-bit on `seed + '|' + size` — including the grid size in
   the hash means the same master gets *different* sigils at 4×4 and 3×3
   (intentional — they're different artifacts).
2. **PRNG**: Mulberry32 seeded with the hash. Good distribution, fast,
   3 lines of JS.
3. **Fill count**: pick uniformly from the valid range.
4. **Which cells**: partial Fisher–Yates → first K indices of a shuffle.
5. **Shape per filled cell**: uniform over `{square, circle, triangle, bar}`.
6. **Rotation**: 0–3 quarter-turns; bars use parity (h/v), triangles use full
   90° steps so two same-shape cells rarely look identical.
7. **Terra accent**: ~18–36% of filled cells, minimum 1. Picked by shuffling
   the filled set and taking the first N.

## 3×3 variant
- 9 cells total
- Fill rate 4–6 (44–67%) — matches the 4×4 density (37.5–62.5%) so the
  visual weight stays consistent across sizes.
- Same shapes, same colors, same algorithm — only `size` changes.
- Use case: avatar in search rows, favicons, OG thumbs. The cells are larger
  relative to the canvas, so it reads more as an icon than a pattern.

## Visual decisions
- **Squares fill the cell edge-to-edge** (no inset). Adjacent same-color
  squares merge into a chunky block — that's the brutalist look the Brand kit
  is going for.
- **Circles / triangles / bars** sit inside a 10% inset, so they read as
  discrete shapes against the paper background.
- **Bars** are 30% of cell thickness, full-cell length — chunky, not thin.
- **Background**: paper (#FFFAF0). The sigil container has a 2px ink border
  per the "2px ink borders, never softer" brand rule.

## Decisions made
- Use FNV-1a + Mulberry32 (not Math.random, not a crypto hash — overkill).
- Include grid size in the hash input → 4×4 and 3×3 of the same master are
  visually distinct (not zoomed versions of each other).
- Terra is an accent, not a coin flip — bounded 18–36% of filled cells.
- Squares fill edge-to-edge; other shapes inset.
- Preview lives at `design mockups/sigil-generator.html` — not wired into
  the app, not in `frontend/`. Standalone HTML, no build step.

## Open questions
- Should the seed be `master._id` (Mongo ObjectId), `master.telegramId`, or
  `master.handle` (e.g. `m12`)? The brand kit specimens use `m##` handles.
  Recommendation: stable display handle, since it survives DB migrations
  and is the same string used in the public URL (`majstr.com/m/m12`).
- Where does the sigil swap go in the React component tree?
  `Avatar.tsx` already handles photo-or-fallback — replacing the letter
  fallback with `<Sigil seed={master.id} size={...} />` is the smallest diff.
- 4×4 vs 3×3 per surface: my hunch is 4×4 in modal / OG / business card,
  3×3 in search-row avatars. Needs designer call.

## Next steps
- [ ] Open `design mockups/sigil-generator.html` in a browser, scan for the
      6 named specimens (Marko, Yuriy, Iryna, Kateryna, Sofia, Mariia) — do
      they feel right at 4×4? Toggle to 3×3 — does the icon read?
- [ ] Decide which seed field becomes canonical (`m##` handle vs. `_id`).
- [ ] If approved, port to a React component (`<Sigil seed size />`) and
      slot into `Avatar.tsx` as the photo fallback.
- [ ] Server-side render path: same algorithm in Node, write SVG to the
      OG image generator (`backend/helpers/generateOpenGraph.js`) for
      photoless masters.
