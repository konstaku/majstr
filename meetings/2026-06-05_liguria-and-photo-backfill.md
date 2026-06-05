# Meeting: Liguria Classification + Photo Backfill
Date: 2026-06-05

## What we discussed
Processed 4 new Liguria chat exports (Genova ×2, Sanremo ×2), ran classification,
reviewed all queues, and implemented Instagram photo fetching via Playwright.

## Decisions made
- Liguria chats imported, classified (Ollama), and reviewed — +54 masters live
- Photo priority: Telegram → Instagram → skip (Telegram works via og:image scrape; Instagram now works via Playwright headless browser calling internal API from within browser context to satisfy Sec-Fetch policy)
- Static HTML Instagram scraping is permanently disabled — it always returns the viewer's own photo
- Instagram session cookie (INSTAGRAM_SESSION_ID) in .env required for Playwright path
- Backfill script: `node scripts/backfill-photos.js` (--force to re-fetch, --dry-run to preview)
- 36 new photos set via backfill (Telegram + Instagram); 43 wrong photos cleared

## Key fix
Instagram's internal API (/api/v1/users/web_profile_info/) requires Sec-Fetch-Site:same-origin which server-side fetch can't set. Fix: load instagram.com in a Playwright page first, then call the API via page.evaluate() — browser sets correct headers automatically.

## Next steps
- [ ] Remaining open M3 issue: #96 (feedback loop — decline reasons → tuning)
- [ ] M4: fuzzy dedup (#99), merge UI (#100)
- [ ] Remaining review queues: Genova-1 (15 new), Genova-2 (71 new)
