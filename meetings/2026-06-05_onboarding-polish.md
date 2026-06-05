# Meeting: Onboarding Polish — Admin Notification, Approval Link, Next.js OG Image
Date: 2026-06-05

## What we discussed
Three improvements to the master onboarding pipeline: richer admin moderation messages,
correct card URLs in owner approval notifications, and a Next.js-native OG image that
matches the desktop master modal design.

## Decisions made

### 1. Rich admin Telegram notification
- `routes/draft.js:submitDraft` now looks up profession + location names from DB
- Formats a full-detail message: name, profession, city, availability, languages, contacts (type+value), tags, bio snippet
- If the master has a photo: uses `bot.sendPhoto()` with caption + Approve/Decline keyboard
- Same fix applied to legacy `index.js:addMaster` (added keyboard + contact info)
- New helper `buildAdminNotificationText(draft)` in draft.js

### 2. Correct Next.js URL in owner approval message
- New helper `backend/helpers/masterUrl.js` — mirrors the slug logic from `web/lib/data.ts`
  - `slugify(str)` — Cyrillic→latin transliteration
  - `masterSlug(master)` — `{name}-{profId}-{locId}-{id6}`
  - `masterWebUrl(master, uiLang, siteUrl)` — `/{uk|ru}/m/{slug}` (other langs → uk fallback)
- Used in: `bot.js:handleMasterCallback`, `index.js:handleApproveMaster`
- Web admin panel decline path now also uses localized `i18n.t(oLang, 'owner.declined')`

### 3. Next.js OG image generation
- New route `web/app/api/og/route.tsx` — Node.js runtime, `ImageResponse` from `next/og`
- Renders a 1200×630 card matching the desktop modal design:
  - Header: MAJSTR. wordmark
  - Left column: grayscale photo (with css filter) or terra-colored ✦ sigil placeholder
  - Right: name (with dot), profession · city, language badges, tags, contacts
  - Footer strip: bio snippet (CREAM background)
- Fonts: Archivo Black (downloaded to `public/fonts/ArchivoBlack.ttf`)
- `generateMetadata` in `web/app/[lang]/m/[slug]/page.tsx` now points to `/api/og?id=<masterId>`
  instead of the backend-generated S3 canvas image

## Open questions
- Should the backend stop generating OGimages to S3 for new cards? (They're no longer used
  for meta tags, only for the legacy Telegram photo attachment in admin notifications)
- The old S3 OGimages on existing cards are still referenced in master.OGimage — safe to ignore

## Next steps
- [ ] Test the OG route locally: `cd web && npm run dev`, then open `/api/og?id=<some_master_id>`
- [ ] Deploy web/ to see the new meta tags in production
- [ ] Consider whether to deprecate backend canvas OG generation
