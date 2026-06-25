# Meeting: Community endorsement — Phase 2 referral path
Date: 2026-06-25

## What we discussed
Built the Phase 2 referral loop for the community endorsement badge (Phase 1
shipped 2026-06-24: badge element + mining auto-attach + backfill). Goal: a link
shared in a community group should let anyone who comes through it, makes a card,
and gets approved receive the "Рекомендовано спільнотою" badge — automatically.

## Key design decisions
- **Entry = public site link**, not a bot deep link: `fr.majstr.xyz/?via=<token>`
  (per the user's earlier decision). The token lives on the Community doc
  (`inviteToken`), rotated per campaign.
- **48h, enforced server-side.** Two layers: a campaign cutoff
  (`Community.inviteExpiresAt`) set when the link is generated, and a per-visitor
  window `min(now+48h, cutoff)`. A stale link found months later is inert because
  the campaign has closed and/or the token was rotated. Client TTL is only a hint.
- **Token must cross the webview boundary.** The TG Mini App can't read the public
  site's localStorage, so the token rides in the Telegram `start_param`
  (`onboard-<lang>-c-<token>`), mirroring the existing claim deep-link pattern.
  Web `/add` fallback carries it as `?via=` + localStorage.
- **Register right before submit**, not on mount: at submit time auth is
  guaranteed and the stamp is consumed by the very next request (requireUser
  re-reads the user fresh from DB). Idempotent + best-effort; never blocks
  onboarding.
- **Consume-once:** submitDraft clears `user.referredCommunity` after use, so one
  link grants at most one badge.

## Decisions made
- Community schema += `inviteExpiresAt`; User schema += `referredCommunity
  { communityId, expiresAt }`.
- New `POST /api/referral` (auth) validates token → stamps user.
- `submitDraft` attaches `communityIds` when the stamp is live, then clears it.
- New `scripts/set-community-invite.js <community-id> [hours]` rotates the token,
  sets the cutoff, prints the share link.
- Web: `spa/referral/referral.ts` (capture/TTL/start_param parse/register);
  wired into Root, AddMasterModal, OnboardingWizard, useDraft.

## Verification
- backend: full suite 183 pass (incl. new referral.test.js, 7 cases).
- web: 25 pass (incl. referral.test.ts), typecheck clean.
- Committed on branch `feat/community-referral` (56724b6c). NOT yet deployed.

## Runbook — opening a campaign
1. `cd backend && node scripts/set-community-invite.js beauty-ukrainians 48`
2. Share the printed `fr.majstr.xyz/?via=<token>` link in the group.
3. After 48h the link is inert; re-run to open a new campaign (new token).

## Open questions / next steps
- [ ] Decide whether to merge to main + deploy now, or hold.
- [ ] Optional: admin keep/strip control for the badge on approval (currently
      auto-attached; existing master-edit can strip).
- [ ] Optional: render the badge in the OG image (currently modal-only).
- [ ] fr.majstr.xyz must be live for the FR campaign link to resolve.
