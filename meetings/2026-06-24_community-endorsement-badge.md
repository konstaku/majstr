# Meeting: Community endorsement badge ("Рекомендовано спільнотою")
Date: 2026-06-24

## What we built
A master card/modal can carry an optional "Рекомендовано спільнотою «…»" band
(the design previewed earlier) linking to an endorsing community's Telegram chat.
First user: the @beautyforUkrainians group (УКРАЇНСЬКІ КРАСУНІ).

## Architecture (Phase 1 — SHIPPED in code, on branch TBD)
- **New `Community` collection** (reference data, like Country/Profession):
  `{ id, name, handle, url, countryID, inviteToken, active }`. Seeded:
  `beauty-ukrainians` → УКРАЇНСЬКІ КРАСУНІ → t.me/beautyforUkrainians (FR).
- **`Master.communityIds: [String]`** (default []). Empty = no badge; modal renders
  the first resolved community. Array (not single) so the mining path and the
  referral path can't clobber each other.
- **Reference API:** `/?q=communities` (public.js) + `/api/reference/communities`
  (app.js), refCache-backed. Web resolves `communityIds[0]` → `{name,url}` by id —
  same pattern as locations/professions (NOT the design's city→community map; we
  use explicit per-master references).
- **Mining auto-attach:** `mining/chatCommunities.js` (chatID→communityId);
  `acceptCandidate` stamps it. So future accepts from chat 1678212416 auto-badge.
- **Backfill:** `scripts/add-beauty-community.js` upserts the community + tags every
  master with `sourceMetadata.chatID==='1678212416'`. RAN on prod: 23/23 tagged.
- **Web rendering:** threaded `communities` through getDataset → buildSeed (slim
  master now keeps communityIds) → context/reducer/Root client-refetch; the
  `Modal.tsx` renders the band (inline brutalist styles + hover invert) when a
  community resolves. `getCommunities` is fault-tolerant (missing endpoint → [],
  no crash).

## Verify / deploy notes
- backend: 176 tests pass. web: typecheck + 19 tests pass. (No full `next build`
  run — it fetches the live API, and the communities endpoint isn't deployed yet.)
- **DEPLOY ORDER: backend (Railway) BEFORE web (Vercel).** getDataset now fetches
  /?q=communities at build/ISR; the tolerant wrapper means web won't break if it's
  missing, but the badge only appears once the backend ships.

## Phase 2 — share-link referral (DESIGNED, not built; user's constraints)
Goal: share a link in the group; whoever comes from it, makes a card, and gets
approved → gets the badge. User decisions:
- Link points to the **public catalogue main page** (`fr.majstr.xyz`), NOT a bot
  deep-link or onboarding page.
- **48-hour TTL** on the attribution so a stale link can't grant a badge months later.
- Auto-attach on **approval** (which is already the public-visibility gate).

Open design problem to solve in Phase 2: bridging an anonymous web visit on
`fr.majstr.xyz` → the later Telegram-authenticated onboarding on `app.majstr.xyz`
(different origin; Telegram opens its own webview/cookie jar). Likely approach:
capture `?via=<inviteToken>` on the catalogue landing (timestamped, 48h), thread it
into the "add your card" → bot hand-off (`t.me/<bot>?start=c_<token>`) so the bot
stamps `user.referredCommunity` (+ expiry); `submitDraft` seeds `communityIds`;
admin approval message surfaces "claims «…» via link" to keep/strip (anti-abuse).

## Next steps
- [ ] Commit Phase 1 (backend + web) on a branch; deploy backend then web.
- [ ] Visually QA the badge on a beauty-group master modal once deployed.
- [ ] Build Phase 2 referral (fr.majstr.xyz ?via= + 48h + bot hand-off).
