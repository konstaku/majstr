# Meeting: Owner photo/edit not propagating to modal + OG
Date: 2026-06-15

## What we discussed
Owner edits a claimed card (e.g. adds a photo) in the TMA. The public site's
card GRID showed the new photo, but the card MODAL still showed the sigil, and
the social OG image never changed. Traced the cross-system data flow and fixed.

## Root cause
- `web/` (Next.js) server-renders a slim **seed** for the grid, but the modal
  **client-fetches `/api/master/[id]`**, a separately-cached route
  (`s-maxage=3600`). Grid and modal could therefore disagree.
- The owner-edit backend path (`editOwnedMaster`) **never pinged the web ISR
  revalidate webhook** — only the approval/mining paths did. So an edit sat in
  stale Next caches for up to an hour.
- OG never changed because the S3 key is stable (`user-og/<id>.png`): a
  regenerated image keeps the same URL, so social/CDN caches serve the old one.

## Fixes
- `backend/helpers/revalidateWeb.js` (new) — shared `triggerWebRevalidate`, env
  read at call time, no-ops without `REVALIDATE_SECRET`.
- `backend/routes/ownedMaster.js` — ping it after `editOwnedMaster`,
  `setVisibility`, `deleteOwnedMaster`. + regression test asserting the edit
  pings the webhook.
- `backend/helpers/generateOpenGraph.js` — append `?v=<timestamp>` to the OG URL
  on every regeneration so the URL changes and caches refresh (S3 ignores the
  unknown query param). Tests bypass this via the `og.impl` seam.
- `web/app/api/master/[id]/route.ts` — modal detail TTL cut 3600s → 60s so it
  converges within ~a minute even if a tag purge misses the URL's CDN entry.

## Verification
- backend full suite 162/162; web typecheck clean.

## Notes / next steps
- Backend (Northflank) and web/ (Vercel) deploy separately — both need to ship
  for the full fix to take effect in prod.
- Edit-screen UX polish (points 1–5) covered in
  [2026-06-15_my-cards-edit-polish.md]; done by a UI agent, verified green.
