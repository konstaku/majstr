# Meeting: Telegram Mini App — Product/Strategic Assessment
Date: 2026-05-15

## What we discussed
The founder is weighing whether to invest engineering time into a Telegram Mini App (TMA) for Majstr — covering some combination of onboarding, claims, reviews, and profile management — or stay web-first with Telegram used only for auth. This note is the product/strategic view, intended to sit alongside a UX Architect's design view.

---

## 1. Strategic fit — does a Mini App help us win?

**Two-sided audience, asymmetric platform fit:**

| Side | Where they live today | TMA fit |
|---|---|---|
| Craftsmen (supply, ~46 listings, 8 owners) | Telegram-heavy — Ukrainian diaspora skews Telegram-native (Telegram = #1 news source in Ukraine, ~51% in 2025, up from 47% in 2024) | **Strong.** Already in Telegram for diaspora chats, help groups, news. |
| Clients (demand, unknown) | Mixed — Italian residents (Ukrainian or otherwise) doing one-off Google searches like "elettricista ucraino Milano" | **Weak-to-medium.** Italians use WhatsApp dominantly; Telegram is a notable but secondary messenger in Italy. |

**Key data points:**
- Telegram crossed 1B MAU globally in March 2025; Mini Apps are now used by ~50% of Telegram users.
- Ukraine has unusually deep Telegram penetration (top European country by downloads; 62% of Ukrainians follow public channels there).
- Italy is a strong-but-not-dominant Telegram market — WhatsApp owns the messenger layer for native Italians.

**Friction profile of current onboarding:**
Today a master clicks a `t.me/majstr_bot` button → bot DMs them a login link → opens browser → fills a multi-field form. That's 3–4 context switches and a desktop-feeling form on a phone. A TMA collapses this to one in-Telegram flow, reuses the auth identity for free, and works natively on mobile where this audience lives.

**SEO counter-argument is real and important:**
Mini Apps don't rank on Google. For Majstr the *demand-side* discovery is plausibly going to be "Google in Italian/Ukrainian for a tradesperson in $city." That demand-side traffic must stay on the indexable web. So this isn't a TMA vs. web debate — it's a TMA *in addition to* web for the supply side and authenticated client actions.

**Verdict:** Mini App fits the *supply side and authenticated client actions* well. It does not fit *demand-side discovery*. The web app must remain the public, indexable front door.

---

## 2. Build cost — concrete estimates

Assumptions: single dev, existing React+TS frontend, existing Telegram bot, no new infra.

| Item | Estimate | Notes |
|---|---|---|
| Spike: minimal TMA wrapper of the existing onboarding form | **3–5 dev-days** | BotFather config, `@twa-dev/sdk` (or `@telegram-apps/sdk`) integration, theme tokens, viewport handling, init-data verification on backend |
| Replace cookie/JWT auth with TMA initData verification | **1–2 days** | We already have user identity from `/start` — just need server-side HMAC validation of `initData` |
| Polish, iOS/Android QA, BotFather menu button, share targets | **2–3 days** | TMA quirks: keyboard handling, back-button, theme color sync |
| **Total v0 (onboarding only inside TMA)** | **~1.5–2 weeks** | One-flow only, reusing existing React components |

**Ongoing costs:**
- **Hosting/infra:** zero delta. Same React build, same API. TMA is just an iframe-like webview pointed at a URL.
- **Two codebases?** No — keep one codebase. Use a `useTelegramContext()` hook that branches UI/auth where needed. Most components stay shared.
- **Release cycle:** marginally heavier. BotFather config changes are quick. Real cost is QA on iOS Telegram + Android Telegram + macOS/Windows Telegram desktop, which all render the webview slightly differently.
- **Hidden cost:** every new feature needs "does this work in TMA viewport / does it work in desktop browser" double-checks. Real but bounded if you keep TMA scope small.

---

## 3. What to ship first (phasing)

**Recommended order, with one-line rationale:**

| # | Flow | Verdict | Why |
|---|---|---|---|
| 1 | **Claim flow for scraped masters** | **SHIP FIRST** | Highest-leverage: 38/46 listings have no owner. Each claim turns dead data into a live, monetizable profile. TMA reduces "prove you're you" friction by piggybacking on Telegram identity. |
| 2 | Profile/availability management for approved masters | Next | Already partially in bot commands — natural TMA upgrade. Keeps approved masters re-engaged. |
| 3 | Onboarding (self-submission) | After #1 succeeds | Lower volume than claims right now (8 vs. 38 candidates). Bigger form, higher build cost. Validate TMA value on the smaller claim flow first. |
| 4 | Review/rating by clients | Later | Demand side may not be on Telegram. Risk of losing client conversions. Consider hybrid (web review form with optional Telegram identity). |
| 5 | Browse/search | **DO NOT MOVE** | SEO matters here. Keep web-first. |
| 6 | Admin tools | **DO NOT BUILD** | Already in bot inline keyboards. Solved problem. Don't gold-plate. |

**The one to ship first: Claim flow.**

Justification: 38 unclaimed listings is your biggest single growth lever. Each claim = a real master, a real profile photo, a real phone number, a real owner who can be asked for reviews later. The TMA win here is psychological as much as UX: "open Telegram, prove it's you, you own this page" feels native and trustworthy in a way "click link, fill form, wait for approval" does not. It's also the smallest scoped flow (claim = identity verification + a handful of fields + admin approval), so it's the cleanest learning bet.

---

## 4. Risks & strategic concerns (Majstr-specific)

- **Scraped master may not even use Telegram.** 38 listings were imported from external sources. If the underlying tradesperson isn't on Telegram, forcing them through a TMA to claim their profile *blocks* them. **Mitigation:** keep a web-based claim path with email/phone verification. TMA is the *fast path*, not the *only path*.
- **Client-side Telegram fit is weaker in Italy.** A potential client (Italian or even Ukrainian resident in Italy) finding Majstr via Google may bounce if a CTA forces them into Telegram. **Mitigation:** browse, view, and contact stay 100% web. TMA only enters once an *action requiring identity* happens.
- **Brand/discoverability dilution.** `majstr.xyz` is a Googleable, shareable, screenshotable domain. `t.me/majstr_bot` is not the same asset. Pushing too hard on TMA risks training users to look in the wrong place. **Mitigation:** majstr.xyz remains the canonical surface; TMA is an *action layer*.
- **Data sync / draft state.** If a master starts a profile in TMA and edits in web, both must read the same DB record. **Mitigation:** the API is already the single source of truth — just don't introduce TMA-local storage for drafts. Server-side draft state only.
- **Platform risk on Telegram.** Telegram has changed Mini App rules multiple times in 2024–25 (ad rules, payment rules, init-data format). Exposure for Majstr is bounded because we'd use TMA for non-payment, non-monetized auth + forms. Low platform-risk surface area.
- **Single-dev focus risk.** Two surfaces = two bug surfaces. If the TMA breaks at 11pm on a Sunday, that's the founder's Sunday. Scope discipline is the mitigation.

---

## 5. Alternative framings — ranked

| Rank | Option | Verdict |
|---|---|---|
| **1** | **(c) TMA only for creation/claim, web stays public** | **Recommended.** Maximum learning, minimum risk, preserves SEO. |
| 2 | (a) Richer bot inline keyboards, no TMA | Cheap, fast, but UX ceiling is low — forms in chat messages are painful past 3 fields. |
| 3 | (b) Mobile-web polish only | Solid alternative; closes most of the friction gap without any new surface. Boring but safe. |
| 4 | (e) Status quo, focus on content | Acceptable if dev capacity is the binding constraint. The honest "do nothing" answer. |
| 5 | (d) Full migration to TMA, deprecate web | **Reject.** Kills SEO, kills demand-side discovery, kills Italian non-Telegram clients. |

**Recommendation: option (c).** It is the option that learns the most about TMA value for Majstr with the least bet. Options (a) and (b) are good consolation prizes if (c) feels too speculative this quarter.

---

## 6. Success metrics — 6-month thresholds

Pick 3–4. Concrete.

| Metric | Baseline (today, rough) | Target post-TMA | Why |
|---|---|---|---|
| **Claim conversion rate**: of scraped masters who open the claim CTA, % who complete claim | Unknown, assume ~10–20% on web | **>40%** | If TMA can't double claim completion, the friction reduction thesis is wrong. |
| **Time-to-completion** for new master onboarding | Estimate 5–8 min on web | **<3 min in TMA** | Mobile-native form on top of existing Telegram identity should be materially faster. |
| **Active master ratio** (masters who updated profile or accepted a job in last 30 days) | Likely <20% of approved | **>40%** | TMA should make re-engagement frictionless. |
| **Web traffic to majstr.xyz** | Current baseline | **Flat or up** | Critical negative metric — if TMA cannibalizes web visits, demand discovery is being damaged. |

If after 6 months claim conversion isn't materially up *and* web traffic is flat, the TMA bet didn't pay back and should be sunset.

---

## 7. Comparable Mini Apps — what works

- **SmartMove Realty (Dubai real estate)** — TMA for listing search, favorites, viewing bookings. Worked because identity + booking action live in-app; discovery still came from external promotion. Same pattern Majstr should copy: *action layer, not discovery layer*.
- **CityBite (Eastern European restaurant chain)** — TMA for direct ordering to dodge third-party delivery commissions. Worked because customer base was already in Telegram. Lesson for Majstr: TMA wins when your audience is *already* there. Confirms the supply-side fit, not demand-side.
- **Pulse Events (ticketing)** — TMA sells tickets and scans QR at the door. Identity + transactional action both inside Telegram. Lesson: TMAs are excellent for "I am who I say I am, here is the proof" flows. Maps directly onto Majstr's *claim* flow.

What didn't work in the broader 2025 TMA landscape: pure-content directories with no identity action (browsing is better on web), and TMAs that tried to replace SEO-driven discovery (they bled traffic to competitors with normal websites).

---

## 8. Final recommendation

**Build it — narrowly.** Ship a Telegram Mini App for the *claim flow only* as a 2-week spike. Keep web as the public, indexable front door for browsing and contact. Reuse the existing React codebase with a `useTelegramContext()` branch. Measure claim conversion at 30/60/90 days. If claim conversion doubles and web traffic stays flat or grows, expand TMA to onboarding and profile management next quarter. If the claim metric doesn't move, sunset the TMA cleanly — the web app loses nothing because it was never deprecated. The risk-adjusted answer is *not* "TMA vs. web" — it's "web for discovery, TMA for identity-bound actions, starting with the highest-leverage one." Do not build TMA browsing. Do not build TMA admin tools. Do not migrate off the web.

---

## Options considered
- TMA-only migration — rejected (kills SEO and Italian demand-side).
- Richer bot inline keyboards — viable cheap fallback.
- Mobile-web optimization only — viable safe fallback.
- TMA for creation/claim only — **recommended**.
- Status quo, content focus — acceptable if no dev bandwidth.

## Decisions made
- Build a narrow TMA covering the **claim flow** as the first bet.
- Keep majstr.xyz as canonical, indexable, public surface.
- Single shared React codebase, branch on Telegram context.
- Maintain non-Telegram fallback path for scraped masters who aren't on Telegram.
- Sunset criteria: if claim conversion doesn't materially improve in 6 months, stop investing in TMA.

## Open questions
- What is current claim/onboarding completion rate? Need to instrument before TMA ships to have a real baseline.
- Are scraped masters reachable at all? (Phone? Email? Telegram username scraped?) Determines whether claim flow even has a top-of-funnel.
- Do we have any signal on client-side acquisition channels (Google vs. word-of-mouth vs. diaspora Telegram groups)? Drives whether SEO concern is hypothetical or load-bearing.

## Next steps
- [ ] Instrument current onboarding and (synthetic) claim funnel to capture baseline conversion before any TMA work
- [ ] Decide between option (c) TMA-narrow vs. option (b) mobile-web polish based on dev capacity this quarter
- [ ] If (c): scope a 2-week spike for claim flow only, define rollback (just remove BotFather menu button)
- [ ] Draft a one-pager PRD for the claim TMA: problem, success metric (claim conversion >40%), explicit non-goals (no browse, no admin, no reviews)
