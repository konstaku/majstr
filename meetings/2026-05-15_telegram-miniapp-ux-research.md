# Meeting: Telegram Mini App UX research for Majstr
Date: 2026-05-15

## What we discussed
Should Majstr's user-facing flows (master onboarding, reviews, claim-card, profile management) move from the website into a Telegram Mini App? This note is the UX-side companion to the PM's strategic write-up — what feels right in-Telegram, what doesn't, and which flows belong where.

## 1. Mini App platform capabilities — what's actually available

Telegram Mini Apps (TMA) are full web views embedded in the Telegram client, with a JS bridge (`window.Telegram.WebApp`) exposing native primitives. Practically useful APIs for Majstr:

- **Identity — `initData` / `initDataUnsafe`.** A signed query string (HMAC-SHA-256 with `HMAC(bot_token, "WebAppData")`) containing `user` (id, first_name, last_name, username, language_code, photo_url, is_premium, allows_write_to_pm), `auth_date`, `hash`, and any `start_param`. The backend verifies the hash and trusts the user identity. **There is no separate login step** — this is the single most important UX win.
- **UI primitives.** `MainButton` (sticky bottom CTA — text, color, progress spinner, enable/disable), `SecondaryButton` (since 2024), `BackButton` (top-left, you wire the click), `SettingsButton`. `showPopup`, `showAlert`, `showConfirm` for native modals. `HapticFeedback` (`impactOccurred`, `notificationOccurred`, `selectionChanged`).
- **Viewport.** `viewportHeight` (live), `viewportStableHeight` (post-animation), `expand()`, `safeAreaInset`, `contentSafeAreaInset`. CSS vars `--tg-viewport-height`, `--tg-viewport-stable-height`. On mobile the app opens in a BottomSheet — viewport is "unstable" while the user drags.
- **Theme.** `themeParams` exposes Telegram's current palette (`bg_color`, `text_color`, `button_color`, `hint_color`, `link_color`, `secondary_bg_color`, `destructive_text_color`) as CSS variables `--tg-theme-*`. `colorScheme` is `'light' | 'dark'`. Setting `setHeaderColor`, `setBackgroundColor`, `setBottomBarColor`.
- **Storage.** `CloudStorage.setItem/getItem/removeItem/getKeys` — up to **1024 keys per user per bot**, keys 1-128 chars, values 0-4096 chars. Syncs across the user's devices.
- **Sharing / deep links.** Launch via `t.me/<bot>/<app>?startapp=<param>` — `start_param` arrives in `initData`. `switchInlineQuery` to drop a shareable card into any chat. `shareToStory(media_url)` for stories. `openLink` (external browser, keeps Mini App open) vs `openTelegramLink` (in-Telegram).
- **Media.** No first-class camera API. Standard HTML `<input type="file" accept="image/*" capture="environment">` works and opens the OS picker/camera. `requestFileDownload` for downloads. **No QR scanner API** for Direct Link Mini Apps (only attachment-menu apps get `showScanQrPopup`).
- **Native flows.** `requestContact` (native phone-number consent popup), `requestWriteAccess` (bot can DM the user without `/start`), `requestEmojiStatusAccess`, `BiometricManager` (`init`, `requestAccess`, `authenticate` — Touch/Face ID gate).
- **Payments.** `openInvoice(url, callback)` with Telegram Stars (`currency: "XTR"`). Empty `provider_token` for digital goods. Subscriptions added in 2025.
- **Limitations.** No background tasks. No push outside of bot messages. No deep filesystem. `localStorage` survives but `CloudStorage` is the durable cross-device option. No reliable browser back gesture on iOS — you *must* wire `BackButton`. No SEO (Telegram client only). `openLink` from inside a Mini App on iOS has known regressions (closes Mini App on back). Geolocation works but prompts the OS, not Telegram. No service workers, no push notifications native to the Mini App.

Refs: [core.telegram.org/bots/webapps](https://core.telegram.org/bots/webapps), [docs.telegram-mini-apps.com](https://docs.telegram-mini-apps.com/), [core.telegram.org/bots/payments-stars](https://core.telegram.org/bots/payments-stars).

## 2. Onboarding flow inside a Mini App

The current web form has the user fill name, profession, city, description, contacts, photos. In a Mini App, auth disappears and several fields pre-fill for free — but the form is still long, so it must become a **wizard, not a single scroll**. BottomSheets on iOS are unforgiving of long scrolls (the drag-to-dismiss collides with scroll-up gestures), and a wizard lets `MainButton` carry a clear per-step verb.

**Recommended 5-step wizard:**

```
┌─ Step 1: Identity ────────────┐
│ Hi, Olena! [tg avatar]        │   pre-filled from initDataUnsafe.user
│ Display name: [Olena K.____]  │   editable, defaults to first_name + last_name initial
│ Languages: [UA] [IT] [+ EN]   │   chips, language_code seeds first one
│ [MainButton: Next]            │
└───────────────────────────────┘

┌─ Step 2: What you do ─────────┐
│ Profession (pick one):        │
│ ◯ Electrician  ◯ Plumber ...  │   native-styled radio list, search box on top
│ Specialties (up to 5):        │
│ [tile chips, multi-select]    │   uses --tg-theme-button-color
│ [Back ←]   [MainButton: Next] │
└───────────────────────────────┘

┌─ Step 3: Where ───────────────┐
│ Primary city: [Roma ▼]        │   bottom-sheet picker, autocomplete
│ Also serves: [Tivoli][Ostia]  │
│ [Back ←]   [MainButton: Next] │
└───────────────────────────────┘

┌─ Step 4: Photos & bio ────────┐
│ [+] Use my Telegram photo     │   one-tap: copies photo_url server-side
│ [+] Upload from device        │   <input type=file capture=environment>
│ [+] Take a photo              │   same input, accept=image/* capture
│ Bio: [textarea, 280 chars___] │
│ [Back ←]   [MainButton: Next] │
└───────────────────────────────┘

┌─ Step 5: Contact & review ────┐
│ Phone: [Share via Telegram]   │   requestContact() — native popup
│ Or type:  [+39 ___________ ]  │
│ Allow bot to DM clients?      │   requestWriteAccess()
│ [Back ←] [MainButton: Submit] │
└───────────────────────────────┘
```

**Decisions:**
- **Auth:** none. Backend trusts verified `initData`. No `/login` round-trip.
- **Pre-fill:** name and avatar from `initDataUnsafe.user` *without consent* (Telegram already disclosed this at launch). Phone requires `requestContact` — explicit, native, non-skippable. Photo via `photo_url` is fine as a default but user should be able to swap it.
- **MainButton:** always the forward verb ("Next", "Submit", "Done"). Disabled until step is valid. `showProgress()` on submit. Pair with `HapticFeedback.notificationOccurred('success')` on commit.
- **Photo upload:** three buttons rather than one chooser — "Use my Telegram photo" is the zero-friction path and probably converts ~70% of users. The other two use a plain `<input type=file>` with `capture` hints.
- **Tags:** no native Telegram picker. Build a styled chip grid using `--tg-theme-button-color`. Search box only kicks in past ~12 items.
- **Draft persistence:** **server-side in Mongo**, keyed by Telegram user id (the backend designer's call still holds, and it's the right one). Reason: cross-device, cross-surface (web ↔ Mini App), and the 4 KB-per-key CloudStorage limit is awkward once photos enter the picture. Use CloudStorage *only* for ephemeral wizard step index ("user was on step 3 last time") — fast read on launch, no server roundtrip.
- **Submit confirmation:** success haptic + `showPopup` with two buttons: "View my card" (deep link inside Mini App) and "Share to a chat" (`switchInlineQuery`). No redirect to website.

## 3. Review / rating flow inside a Mini App

**Entry points (in order of likely traffic):**
1. Bot DM after the user contacted a master via Telegram: "How did it go with Olena?" + inline button → opens Mini App at `?startapp=review_<master_id>`.
2. Inline button on the master's card in any chat ("Leave a review").
3. Direct deep link from the website's master page ("Rate on Telegram").

**Screen:**
```
┌─ Reviewing Olena K. ──────────┐
│ [avatar]  Electrician · Roma  │
│                               │
│       ★ ★ ★ ★ ☆               │   tap stars, HapticFeedback.selectionChanged on each
│       4 / 5                   │
│                               │
│ How was it?                   │
│ [ ] On time                   │   optional preset chips, multi-select
│ [ ] Fair price                │
│ [ ] Clean work                │
│                               │
│ Comment (optional)            │
│ [_________________________]   │
│                               │
│ [MainButton: Submit review]   │
└───────────────────────────────┘
```

**Decisions:**
- **Star tap, not slider.** Universally understood; sliders feel slot-machine-y. Light haptic per star.
- **Preset chips before free-text** — most users won't write prose. Chips also normalize signal for ranking.
- **Anti-abuse UX:** show "You're reviewing as @username" up top so reviews aren't anonymous-feeling; gate behind "did you actually message this person?" check server-side (look up whether the master's contact button was tapped from this Telegram id in the last 90 days). If not, soft-block with `showConfirm`: "We didn't see you contact this master — submit anyway?" Don't hard-block, just raise friction and flag for moderation.
- **Cooldown:** one review per (reviewer, master) per 6 months. Editable, not duplicable.
- **Post-submit:** haptic success → `showPopup` "Thanks!" with "View Olena's profile" CTA. Don't kick out of Mini App.

## 4. Claim flow for scraped cards

**Discovery is the hardest part.** A scraped master doesn't know their card exists. Three discovery surfaces:
- Bot DM if we ever get their Telegram username from the source chat ("Is this you?" + Mini App link).
- Search-in-Mini App, where the bot suggests "claim this card" if the searcher's `first_name + city` partially matches.
- Web page "Is this you? Claim it" button → opens Mini App via `t.me/<bot>/<app>?startapp=claim_<master_id>`.

**Flow:**
```
┌─ Claim "Olena K." ────────────┐
│ [scraped card preview]        │
│                               │
│ This card was created from    │
│ a public recommendation in    │
│ "Ukrainians in Roma" chat.    │
│                               │
│ To claim it, we need to       │
│ confirm it's you:             │
│                               │
│ [Share your phone number]     │   requestContact()
│   ↳ matches scraped phone?    │   silent server check
│ or                            │
│ [Submit a 10-sec voice note]  │   fallback if no phone match → admin queue
│                               │
│ [MainButton: Claim]           │
└───────────────────────────────┘
```

**Decisions:**
- **Primary path:** `requestContact` → server compares hashed phone to scraped phone → instant claim. No admin needed in the happy path.
- **Fallback:** voice note / selfie → admin review via existing Telegram approve/decline keyboard (same plumbing as the current approval flow — reuse, don't rebuild).
- **Pending state:** master sees a banner "Claim pending — usually approved within 24h", their `claimed_by` field is null but `claim_pending_for: <tg_id>` is set so it can't be double-claimed. Send a bot DM on approval with `requestWriteAccess` already granted (otherwise the message silently fails).

## 5. Identity continuity & web ↔ Mini App handoff

- **Web → Mini App.** Website "Open in Telegram" button → `t.me/<bot>/<app>?startapp=resume_<draft_id>`. Mini App reads `start_param`, fetches the draft from Mongo, drops user into the right wizard step. Feels seamless because identity is already known on both sides (same Telegram id).
- **Mini App → web.** Use `openLink` with the website URL plus a short-lived signed token in the query string. Web reads it, sets the same JWT, user is logged in. Caveat: iOS Telegram's `openLink` regressions — test the back-stack carefully, and *don't* rely on the user returning to the Mini App after.
- **Concurrent edits.** Last-write-wins on the server with an `updated_at` check. On Mini App launch, if `server.updated_at > local.draft_timestamp`, show `showConfirm`: "You edited this card on the website 5 min ago — load that version?" Don't auto-merge.
- **One form or two?** **One form, two surfaces, shared backend.** The wizard structure works on both; render the same React component tree, swap `MainButton` for an in-page CTA on the web build. Don't fork the UI.

## 6. What belongs where

| Action | Surface | Why |
|---|---|---|
| Browse masters (public, anon) | **Web** | SEO, link previews, no Telegram lock-in. |
| Browse masters (logged in) | **Both** | Same React app, deep link parity. |
| Onboard new master | **Mini App primary, web fallback** | Zero-friction identity, pre-fill, native phone capture. |
| Edit own card | **Mini App primary** | Same wizard, same identity. |
| Claim scraped card | **Mini App only** | Requires `requestContact` and bot identity proof. |
| Leave a review | **Mini App only** | Native identity is the anti-abuse story. |
| Read reviews | **Web + Mini App** | Read paths should be everywhere. |
| Login | **Bot (existing flow stays)** | Already works, don't break it. |
| Admin approval | **Bot inline keyboard** | Already works, no reason to move. |
| Profile / availability toggle | **Bot commands + Mini App** | Quick toggles in bot, structured edits in Mini App. |
| Payments / featured listings (future) | **Mini App (Stars)** | `openInvoice` with XTR is the cleanest revenue rail. |

## 7. UX risks and dealbreakers

- **No SEO inside the Mini App.** Anything you want Google to index must stay on majstr.xyz. Master profile pages especially — keep them web-canonical, Mini App is the *editor* surface.
- **iOS BottomSheet drag conflict.** Long scrolling forms feel broken when drag-to-dismiss intercepts scroll-up. Mitigation: short wizard steps, `expand()` immediately on launch, never put scrollable content above viewport-stable-height.
- **No browser back gesture on iOS.** The system swipe-from-edge does nothing. You *must* wire `BackButton.onClick` on every screen, and provide an in-page Back affordance for users who don't know to look at the top-left.
- **Keyboard pushes the viewport.** `viewportHeight` shrinks when the keyboard opens; `MainButton` can collide with the keyboard's accessory bar on iOS. Mitigation: pad the bottom with `--tg-viewport-stable-height` rather than `100vh`, and hide non-essential UI when an input is focused.
- **`openLink` regressions on iOS Telegram.** Opening an external page can break the back stack — user taps back, Mini App closes entirely. Avoid external links inside flows; keep everything in-app or in-Telegram (`openTelegramLink`).
- **Accessibility.** No screen-reader story comparable to web. VoiceOver does work but theme variables can produce low-contrast pairings (Telegram dark themes especially). Audit contrast against `--tg-theme-text-color` / `--tg-theme-bg-color` at build time.
- **Desktop Telegram.** Mini App opens in a fixed-size window — wizard works, but media uploads are clunkier. Test on macOS/Windows clients, not just mobile.
- **No offline.** No service workers. A spotty cell signal during onboarding kills the form. CloudStorage helps for wizard *position*, but in-flight photo uploads must be retryable on the server side.
- **Deep-link inconsistency.** `startapp` works reliably in 2026 but `mode=compact` is ignored on desktop and some older Android clients. Don't depend on compact mode.

## 8. Concrete examples worth learning from

- **Wallet (TON / `@wallet`)** — the gold standard for a Mini App that handles identity-sensitive flows. Wizard-style flows, `MainButton` discipline, native popups for confirmation, `BiometricManager` for sensitive actions. Take from it: never use a custom modal when `showPopup` does the job; the platform modals build trust.
- **Tribute (`@tribute`)** — creator monetization Mini App. Best-in-class subscription/Stars integration and a clean "claim your handle" onboarding that's structurally identical to our claim flow. Take from it: identity confirmation via `requestContact` + admin fallback, exactly the pattern we'd reuse.
- **Notcoin / Hamster Kombat** — anti-examples for *our* use case. They pioneered the tap-to-earn pattern, which is bad for trust/identity flows. But study their viewport handling — they nailed the fullscreen-immediately + custom haptic feedback combo. Cherry-pick the polish, ignore the gamification.
- **Durger King (Telegram's own demo)** — boring but instructive. Stripped-down example of `MainButton` + form + `sendData()` back to the bot. The simplest Majstr onboarding could ship as a Durger-King-shaped MVP in a week.

## Decisions made
- Move onboarding, claim, review, and edit flows into a Mini App as the *primary* surface.
- Keep public browsing and master profile pages canonical on the web (SEO).
- Keep the existing bot login + admin approval flows untouched.
- Drafts live server-side in Mongo (decision stands); CloudStorage only for wizard step index.
- Build a single React form rendered on both surfaces — no UI fork.
- Use `requestContact` as the primary claim-verification path with admin review as fallback.

## Open questions
- Do we ship a Direct Link Mini App (`t.me/<bot>/app`) or use the bot menu button? Direct link is shareable, menu button is discoverable — probably both, same code.
- Do we accept `is_premium` as a soft trust signal for review weighting?
- Telegram Stars for featured listings: in scope for v1 or a follow-up?

## Next steps
- [ ] PM to align on scope cut (claim flow + review flow in v1, full onboarding in v2?)
- [ ] Backend to expose `initData` verification middleware and draft endpoints
- [ ] Prototype the 5-step onboarding wizard against `--tg-theme-*` variables
- [ ] Test BottomSheet + keyboard behavior on iOS 17 / 18 and Android 14 before committing to wizard step lengths
- [ ] Decide on Direct Link Mini App slug (`/onboard`? `/app`?)
