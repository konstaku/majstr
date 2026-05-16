# Meeting: UI Copy Updates & QuoteCard Layout
Date: 2026-05-14

## What we discussed
Reduced Ukrainian-only framing across the site, reworked the featured review block, and rebuilt the QuoteCard grid placement from scratch to work correctly across all breakpoints.

## Options considered
- Typewriter animation for footer nationality word → rejected, replaced with hover/overscroll fade
- Conditional show/hide classes for QuoteCard → replaced with pure CSS grid placement (`grid-column: -2/-1`)
- Hero testimonial at 1440px → moved to 1540px (≈4 master-grid columns)

## Decisions made
- Footer nationality cycles: UKRAINIAN → GEORGIAN → BELORUSSIAN → RUSSIAN (no TURKISH)
- Trigger: desktop = mouse hover; mobile = overscroll past page bottom
- Hero testimonial shows only at ≥1540px (4+ master-grid columns); QuoteCard in grid hides there
- QuoteCard always uses `grid-column: -2/-1; grid-row: span 2; grid-auto-flow: dense` — CSS grid handles all breakpoints automatically
- QuoteCard position: 1-col rows 3–4 | 2-col last-col rows 2–3 | 3-col last-col rows 1–2
- Real review from Konstantin K. (Sanremo→Lecco move with Maxim) used as testimonial in all 4 languages
- "Ukrainian craftsmen" → "Ukrainian-speaking craftsmen" in hero stat
- EST. 2024 → EST. 2023, removed "UA → IT / PT" from header meta strip
- Color variant formula for cards after QuoteCard: i<2 → i%3; i=2,3 → (i+1)%3; i≥4 → (i+2)%3

## Open questions
- None

## Next steps
- [ ] Monitor dev for visual regressions across breakpoints
