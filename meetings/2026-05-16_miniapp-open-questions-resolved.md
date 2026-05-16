# Meeting: Mini App Open Questions — Final Decisions
Date: 2026-05-16

## What we discussed
Resolved the 5 open questions from the 2026-05-15 miniapp-backend-plan before starting Spike 2.

## Decisions made
- **TMA hostname:** `app.majstr.xyz` (subdomain) — already deployed and running.
- **Bot token rotation:** Short overlap period — keep both old and new tokens valid briefly during rotation. Implementation: store the current token + one previous token in env; middleware tries both. Exact overlap window TBD (suggest 24h).
- **Admin claim auto-approve:** Admin's own claims always queue for paper trail — no auto-approve exception.
- **Non-phone-match claims:** Queue to admin (pending state + Telegram notification). Claimant sees "under review." Hard-fail path not used.
- **Phone normalization audit:** Deferred to later.

## Open questions
- Exact overlap window for dual-token rotation (suggest 24h; needs env var design)

## Next steps
- [ ] Start Spike 2: Backend B1 (#34) — GET/PATCH/DELETE /api/masters/draft
- [ ] Note: initData middleware needs to support dual bot-token verification for rotation overlap
- [ ] Note: CORS allowlist must include `app.majstr.xyz` as the TMA origin
