# Migration Plan: URL-Driven, Fixed-Locale i18n (uk / ru / en)

Status: IMPLEMENTED 2026-06-08 (uk/ru/en live, EN_INDEXED=true). See
`meetings/2026-06-08_i18n-implementation.md` for the as-built summary.
Date: 2026-06-08
Scope: `web/` (Next.js App Router). Legacy Vite SPA and `backend/` are out of scope except as data sources.

---

## 0. TL;DR

The product decision is locked: **the URL is the single source of truth for language.** We
support exactly three locales — **uk, ru, en** — and every one is a real, indexed
`/[lang]/...` route. The language switcher becomes navigation (a `<Link>` to the same page
in the target locale), not a client state toggle. All client-side language machinery
(localStorage `lang`, the restore layout-effect in `context.tsx`, `urlLang()` clamp,
seed-vs-display divergence, `APP_LANGS`' 9-language surface) is deleted.

`state.lang` is **kept as a read-only mirror of the URL locale**, seeded once per page from
the server. It is never mutated on the client. There is nothing to "sync" because there is
only one source.

The work is sequenced so the site stays shippable on every commit (Vercel deploys prod from
`main`; no staging). `en` ships behind a content gate (`noindex` until authored) so we don't
publish thin/duplicate pages.

---

## 1. Target-State Architecture

### 1.1 How language flows, end to end

```
URL  /[lang]/...            ← single source of truth (uk | ru | en)
  │
  ├─ app/[lang]/layout.tsx  validates lang via isLang(); 404 otherwise
  │        └─ sets <html lang> for THIS subtree (see §2 html-lang fix)
  │
  ├─ page.tsx (RSC)         awaits params.lang → Lang
  │        ├─ generateStaticParams → one entry per LANGS value
  │        ├─ generateMetadata    → localized title/desc + hreflang + canonical
  │        └─ default export      → buildSeed(lang, ds, sp) carries lang into the seed
  │
  ▼
AppShell seed={...}         (client boundary)
  └─ MasterContextProvider initial={seed}
        state.lang = seed.lang   ← set ONCE, never changed on the client
        └─ Root / Main / Modal / MasterCard
              useTranslation() reads state.lang (read-only)
              language switcher = <Link> to the same page in target locale
```

The crucial property: **a route remount re-seeds `state.lang` from the URL, and that is now
correct, not a bug.** Today the remount fights with localStorage (the flip + scroll jump).
After this change there is no competing client preference, so the remount is the intended
behavior — the URL changed, so the language changed.

### 1.2 `state.lang`: keep as read-only mirror (do not remove)

Recommendation: **keep `state.lang`**, but make it write-once.

Why keep it rather than rip it out:
- `useTranslation`, `MasterCard` (`spa/components/MasterCard.tsx:37,43,48-49`), `Main`
  (label/locale logic), `Modal`, `Root`, and `localizedName(name, lang)` all read
  `state.lang` pervasively. Removing it forces a large, risky refactor to thread `lang`
  through props or a separate context — pure churn with no behavior change.
- The seed already carries `lang` (`lib/seed.ts:62`), so the provider already has it.

What changes about it:
- It is seeded from `initial.lang` only. Delete the `getInitialLang()` localStorage/navigator
  fallback (`spa/context.tsx:23-34`) and the restore layout-effect (`spa/context.tsx:94-106`).
- `ACTIONS.SET_LANGUAGE` and the reducer case become dead. **Delete both** (see §2) so no code
  path can mutate `lang` after seed. This is what guarantees "nothing to sync."

Acceptable alternative (more invasive, not recommended for v1): drop `state.lang` and read the
locale from `usePathname().split("/")[1]` via a tiny `useLocale()` hook. Cleaner in theory but
touches every consumer and loses the single seeded value the server already computed. Defer.

### 1.3 How `useTranslation` gets its lang

`useTranslation` keeps reading `state.lang` from context (`spa/custom-hooks/useTranslation.ts:8`).
The only change: **remove `setLang`** (lines 26-29) — there is no client language mutation. The
returned shape becomes `{ t, lang }`.

Because `state.lang` is seeded server-side and the server render uses the same value, the first
client render matches the server HTML — no hydration mismatch (today `getInitialLang()` +
the restore effect are a latent hydration/flash hazard).

---

## 2. File-by-File Change List

Legend: ✏️ edit · 🗑️ delete · ➕ add

### `lib/i18n.ts` ✏️ (the keystone change)
- **`LANGS = ["uk","ru"]` → `["uk","ru","en"]`.** This one line ripples through
  `generateStaticParams`, `sitemap`, every `languageAlternates`/`langAlt`, and hreflang. Verify
  each consumer below builds an `en` variant after this.
- 🗑️ **Delete `urlLang()`** (lines 16-18). It only exists to clamp 9 UI langs → uk/ru; with
  fixed locales there is nothing to clamp. (5 call sites — see below.)
- Extend `NAME_KEY` / `PREP_KEY` (lines 24-25) for `en`. The API `LocName` has `.en`; map
  `en → "en"` for nominative. There is no `en_alt` prepositional, so `prepName` will fall back
  to `nomName` for `en` (English has no case system — correct).
- Extend `HTML_LANG` (line 34) `{ uk:"uk", ru:"ru", en:"en" }` and `OG_LOCALE` (line 35)
  `{ ..., en:"en_US" }`.
- `plural()` / `MASTER_FORMS` (lines 38-54): add an English branch. English pluralization is
  trivial (`n === 1 ? "master" : "masters"`). Add `en: ["master","masters","masters"]` to
  `MASTER_FORMS` and special-case `plural` for `en`, OR gate `mastersCount` to only emit a count
  word for uk/ru and a plain "N masters" for en. Either is fine; pick the simpler.
- `T` dict (lines 58-95): **add a full `en` block** (every key present in uk/ru). This is server
  UI strings used by SSR copy. (See §4 content gap.)

### `lib/urls.ts` ✏️
- `languageAlternates` (lines 14-21) already iterates `LANGS`, so it picks up `en`
  automatically. Keep `x-default → uk` (line 19) — uk is `DEFAULT_LANG` and the apex target.
  No code change needed, but **verify** after the LANGS edit.

### `app/page.tsx` (apex) ✏️ minimal
- Still `permanentRedirect("/" + DEFAULT_LANG)` = `/uk`. No change to default. Keep the `?card=`
  legacy branch (lines 16-27) — it redirects to `masterPath(DEFAULT_LANG, slug)` = `/uk/m/...`,
  which is still valid. (See §6 for the `?card=` discussion.)

### `app/[lang]/layout.tsx` ✏️ (html-lang fix — important)
- Currently validates lang (good). **Add** `<html lang>` ownership here. Today
  `app/layout.tsx:83` hardcodes `<html lang="uk">`, so ru and en pages serve `lang="uk"` —
  an SEO/a11y defect that this migration should fix while we're here.
  - Option A (recommended): move the `<html>`/`<body>` shell out of the root layout into a
    locale-aware spot. The clean App Router pattern is to keep `<html>` in the root layout but
    the root layout **cannot** read `[lang]` (it's above the segment). So instead: keep `<html>`
    in root with a neutral default, and **override the lang attribute** — Next does not let a
    nested layout re-emit `<html>`. Therefore use the metadata/script approach below.
  - Option B (pragmatic, no structural move): in each page's `generateMetadata` we already set
    `OG_LOCALE`; additionally Next sets `<html lang>` from the root only. To get a correct
    per-locale `lang` attribute, set it from `[lang]/layout.tsx` by rendering a tiny client
    effect OR (cleanest) by reading `params.lang` in the **root layout via the route** — not
    possible. **Decision:** restructure so the `<html>` tag lives in `app/[lang]/layout.tsx`
    and the root `app/layout.tsx` becomes a pass-through that only carries fonts/`<head>`
    globals. Concretely: move the `<html lang=...>` + `<body>` JSX into `app/[lang]/layout.tsx`
    using `HTML_LANG[lang]`, and have `app/layout.tsx` return `children` (App Router allows the
    `<html>`/`<body>` to be emitted by the closest layout that owns them; verify with a build).
  - Net required outcome: **`/ru/...` serves `<html lang="ru">`, `/en/...` serves
    `<html lang="en">`.** Whichever mechanism, this must be true and is testable via
    `curl -s https://dev.majstr.xyz/ru | grep '<html'`.

### `app/[lang]/page.tsx` (home) ✏️
- `homeTitle(lang)` (lines 19-23): add `en` branch (English title/desc).
- `generateStaticParams` (lines 15-17): unchanged (maps `LANGS`), now emits `en`.
- JSON-LD `inLanguage` (line 82): `lang === "ru" ? "ru" : "uk"` → make it `HTML_LANG[lang]` (or
  the lang directly) so `en` reports `en`.
- `OG_LOCALE[lang]` (line 46): works once `OG_LOCALE.en` exists.

### `app/[lang]/[city]/page.tsx` (city OR category) ✏️
- `generateMetadata` (lines 56-78): the title strings are hard-branched `ru ? ... : uk-default`.
  **Add an explicit `en` branch** for both the `city` and `cat` kinds; do not let `en` fall into
  the uk template (that's the "thin/wrong-language" trap).
- `langAlt` (lines 46-47) iterates `LANGS` → emits `en` automatically. Note this builds
  `/${l}/${seg}` using the **raw city/category id** (ids are language-independent), so no slug
  ripple here. ✅
- `resolve()` (lines 33-44) uses `isLang` → already gates en correctly.

### `app/[lang]/[city]/[category]/page.tsx` ✏️
- `generateMetadata` (lines 60-69): same — add `en` branch for title AND description.
- `langAlt` (lines 50-51) iterates LANGS (raw ids) → ✅ auto.

### `app/[lang]/m/[slug]/page.tsx` (master detail) ✏️
- `generateStaticParams` (lines 25-28) flat-maps `LANGS` → now pre-renders `en` master pages.
  This ~triples master page count (2→3 locales). Confirm build time is acceptable (see §6 ISR).
- `generateMetadata` uses `masterTitle`/`masterDescription` (`lib/content.ts`) which branch
  `ru ? ... : uk`. **Add `en` branches in content.ts** (see below).
- JSON-LD `knowsLanguage: ["uk","ru"]` (line 103) — leave as the masters' actual spoken
  languages; this is data, not UI locale. Fine for `en`.
- The canonical-slug redirect (line 73) is locale-agnostic (slug is language-independent) — ✅.

### `lib/content.ts` ✏️ (large — all builders branch `ru ? : uk`)
Every function here is a two-way `lang === "ru" ? <ru> : <uk>`:
`landingTitle`, `landingDescription`, `regionSentence`, `landingIntro`, `landingBody`,
`landingFaq`, `masterTitle`, `masterDescription`, `cityHubTitle`, `cityHubDescription`,
`professionHubTitle`, `professionHubDescription`.
- Convert each to handle `en` explicitly (a `switch(lang)` or a per-lang lookup table is
  cleaner than nested ternaries at this point). Until `en` copy is authored, these may
  temporarily return English placeholders — but **do not index `en` while placeholder copy is
  live** (see §4 gating).
- `mastersCount(count, lang)` (from `lib/i18n.ts`) is called here — ensure the `en` plural
  branch from the i18n change is in place.

### `lib/seo-data.ts` ✏️ (content authoring — see §4)
- `PROFESSION_SEO: Record<string, Record<Lang, ProfSeo>>` — `Lang` now includes `en`, so
  **TypeScript will flag every entry that lacks an `en` key** the moment `LANGS` changes. This
  is the compiler doing our gap analysis for us. Same for `PROFESSION_TIPS`, `CITY_PREP`,
  `CITY_REGION` (all typed `Record<Lang, ...>`).
- Mitigation to avoid a giant red build before content exists: temporarily relax these to
  `Partial<Record<Lang, ...>>` and let the existing fallbacks fire (`professionSlug` already
  falls back to `profId` — `lib/data.ts:69`; `professionLead` falls back to `nomName` — line 72;
  `cityPrep` has a computed fallback — lines 80-88). Then fill `en` incrementally and flip back
  to the strict `Record<Lang,...>` once complete. **Document this Partial as a temporary gate.**

### `lib/data.ts` ✏️ (mostly automatic)
- `professionSlug` (lines 68-70): for `en`, `PROFESSION_SEO[id].en?.slug` — if not authored,
  falls back to `profId`. **This means en landing slugs default to the raw profession id**
  until authored. Acceptable for a gated/`noindex` en; must be authored before indexing en.
- `resolveProfessionBySlug` (lines 102-111) already tries the per-lang slug then the raw id, so
  it resolves both during the transition. ✅
- `cityPrep` / `cityNom` / `professionLead` (lines 71-88): fallbacks cover `en` minimally.

### `app/sitemap.ts` ✏️ (automatic + gating)
- All loops iterate `LANGS` → `en` entries appear automatically once LANGS changes.
- **Gating:** while `en` is `noindex`, **exclude `en` URLs from the sitemap** (don't invite
  crawling of pages we're telling robots not to index). Simplest: define
  `INDEXED_LANGS = LANGS.filter(l => l !== "en")` during the gate and iterate that for sitemap
  *entries*, while still listing `en` in `alternates.languages` hreflang. When `en` content is
  ready, drop the filter. (See §4/§5.)

### `app/robots.ts` ✏️ (optional, gating)
- If using a path-based noindex for en (alternative to per-page metadata), add `/en` patterns
  here during the gate. Prefer per-page `robots: { index:false }` in metadata over robots.txt
  disallow (disallow blocks crawl entirely and breaks hreflang reciprocity). See §4.

### `app/layout.tsx` (root) ✏️
- Resolve the hardcoded `<html lang="uk">` (line 83) per the §2 layout fix.

### `app/opengraph-image.tsx` / `app/api/og` ✏️ (verify)
- These don't currently branch on locale (grep shows no lang usage). If OG image text is
  uk-only, that's acceptable for v1 (image text is not indexed). Note as a polish item; no
  blocking change.

### `spa/context.tsx` 🗑️/✏️ (delete the client lang machinery)
- 🗑️ Delete `getInitialLang()` (lines 23-34).
- 🗑️ Delete `useIsoLayoutEffect` import/const + the restore layout-effect (lines 3-19 partial,
  94-106). Remove now-unused `useEffect`/`useLayoutEffect` imports.
- ✏️ `seeded.lang` becomes `initial?.lang ?? "uk"` (no localStorage). The seed always provides
  `lang` from the server, so the fallback is only a defensive default.

### `spa/reducer.tsx` 🗑️
- 🗑️ Delete the `ACTIONS.SET_LANGUAGE` case (lines 90-95). No path mutates lang anymore.

### `spa/data/actions.ts` 🗑️
- 🗑️ Remove `SET_LANGUAGE` (line 14).

### `spa/custom-hooks/useTranslation.ts` ✏️
- 🗑️ Delete `setLang` (lines 26-29) and the `dispatch`/`ACTIONS` imports it needs. Return
  `{ t, lang }`. `dict` fallback (line 9) → fall back to `translations.uk` instead of
  `translations.en` once en is real, or keep `en` — either works since all three exist.

### `spa/components/Root.tsx` ✏️ (switcher rewrite — see §3) + cleanups
- 🗑️ Replace the entire `LanguageSwitcher` (lines 270-343) with the URL-link version (§3).
- 🗑️ Remove imports: `urlLang` (line 20), `APP_LANGS`/`LANG_ENDONYM`/`AppLang` (lines 22-26) if
  unused after the switcher rewrite (the new switcher uses only the 3 locales).
- ✏️ Footer privacy link (line 416): `/${urlLang(lang)}/privacy` → `/${lang}/privacy` (lang is
  now always a valid locale, no clamp needed).
- The data-fetch fallback effect (lines 57-78) and auth effect are unrelated — leave them.

### `spa/pages/Main.tsx` ✏️ (kill the clamp + the workaround)
- ✏️ Search button nav (lines 296-305): `const segs = [urlLang(lang)]` → `[lang]`. `lang` is now
  always a real locale, so `/en/medicine` is a real route — the original 404 cause is gone.
- ✏️ Remove the `urlLang` import (line 9).
- The `scroll:false` + manual scroll (lines 305-316) can **stay** — it's still desirable UX
  (avoid scroll-to-top on the in-page filter nav). It is no longer load-bearing for the language
  bug, but it's not harmful. Optional: simplify later.
- The hero stat copy (lines 247-249) branches `uk ? <uk> : <english>`. Add a `ru` branch so ru
  doesn't render English; add proper `en`. (This is a content correctness item surfaced by the
  audit — today ru users see the English fallback sentence here.)

### `spa/components/Modal.tsx` ✏️
- ✏️ Line 146: `/${urlLang(lang)}/m/${...}` → `/${lang}/m/${...}`. Remove `urlLang` import
  (line 11).

### `spa/components/MasterCard.tsx` ✏️ (now safe to use state.lang)
- Lines 52-54 currently derive locale from `usePathname()` *specifically to avoid* the
  state-vs-url divergence. After this migration `state.lang` === URL locale, so this can be
  simplified to `masterPath(lang, ...)` using context `lang`. Low priority but removes a
  special case. Keep `usePathname` approach if you prefer belt-and-suspenders — both yield the
  same result now.

### `spa/i18n/lang.ts` ✏️ (prune the 9-lang surface)
- `APP_LANGS` (lines 4-14): reduce to `["uk","ru","en"]`. This drops it/pt/de/fr/tr/es from the
  switcher surface and from `AppLang`.
- `LANG_ENDONYM` / `LANG_OPTIONS` (lines 18-69): trim to the 3 locales.
- `contextualLang` / `primaryLangs` / `hiddenLangs` (lines 36-56): **delete** — they exist only
  to manage the "primary vs hidden 9-language disclosure," which the 3-locale switcher doesn't
  need. Verify no other importer (onboarding wizard note: this file says "shared with the
  onboarding wizard" — confirm the wizard in `backend/`/legacy isn't importing from `web/spa`;
  it isn't, these are separate packages, but grep to be safe before deleting).
- `localizedName` (lines 85-102): keep. Its fallback `chain` can be trimmed to
  `[lang,"en","uk","ru"]` but leaving the long chain is harmless (data may still carry it/pt
  name keys). Low priority.

### `spa/i18n/translations.ts` ✏️ (prune + ensure en/uk/ru complete)
- The `translations` object currently has full blocks for uk/en/it/pt and partial others; the
  `JOIN_MODAL` block has all 9. **Keep uk/ru/en, delete it/pt/de/fr/tr/es** blocks from
  `translations`, `JOIN_MODAL`, `LANG_FLAGS`, `LANG_LABELS`, `COUNTRY_TO_LANG`.
- **Critical:** confirm a complete **`ru`** block exists in `translations` (the top region
  showed uk/en/it/pt — ru must be present and complete, since ru is a launch locale). Audit
  every key against `LangTranslations`. If `ru` UI strings are missing, author them (they
  largely exist as server `T` in `lib/i18n.ts` — reuse).
- `MasterCard.tsx` has its own local `LANG_LABELS` (lines 25-28) for spoken-language chips —
  that's master *data* languages, not UI locale. Leave it.

---

## 3. Language Switcher Redesign — "same page, other locale"

### 3.1 The hard part
Most segments are language-independent ids: `[city]` and `[category]` are raw ids
(`app/[lang]/[city]/page.tsx` canonical uses `city.id`/`cat.id`), and the master `[slug]` is
language-independent by construction (`lib/data.ts:90-99`). So for **home, city, category,
city×category, master, privacy** the switch is a trivial segment swap:
`/uk/milan/beauty` → `/en/milan/beauty`.

The ONE place slugs differ per locale is the **profession landing** path that uses
`professionSlug(profId, lang)` = `PROFESSION_SEO[id][lang].slug` (`lib/data.ts:68-70`). The
slug `manikyur` (ru) vs a uk/en variant must be rebuilt for the target locale. **The switcher
cannot derive this from the URL string alone** — it needs the resolved profession id.

> Note: in the *current* routing, profession-specific landing pages
> (`/[lang]/[profSlug]/[citySlug]` via `lib/urls.ts:landingPath`) are defined as helpers but the
> live routes resolve `[city]` as city-or-category and `[city]/[category]`. Confirm whether
> per-profession slug landing routes are actually mounted. If they are NOT yet live, the
> switcher's hard case is currently theoretical and a pure segment-swap suffices for v1 — but
> design for it now so enabling profession landings later doesn't reintroduce a 404 class.

### 3.2 Where the mapping lives (recommended)
**Compute the per-locale alternates on the server, where the entity is already resolved, and
pass them down to the switcher via the seed/context.** Each `page.tsx` already resolves the
entity (city/cat/master) in `resolve()`/`findMasterBySlug`. It can cheaply build:

```ts
// in each page, after resolve():
const localePaths: Record<Lang, string> =
  Object.fromEntries(LANGS.map(l => [l, buildPathForThisPage(l)]));
// home:      homePath(l)
// city:      `/${l}/${city.id}`
// category:  `/${l}/${cat.id}`
// city×cat:  `/${l}/${city.id}/${cat.id}`
// master:    masterPath(l, canonical)
// landing:   landingPath(l, professionSlug(prof.id, l), city.id)  ← the slug-rebuild case
```

This is the **same object** already being computed for `alternates.languages` in
`generateMetadata` (e.g. `langAlt` in `[city]/page.tsx:46-47`). Extract that into a single
helper per page (or a `lib/alternates.ts`) and:
1. feed it to `generateMetadata` (hreflang), and
2. add it to the seed (`buildSeed` gains an optional `localePaths` field) so the client switcher
   reads `state.localePaths` and renders three `<Link href={localePaths[target]}>`.

Single source, computed once, server-side, by code that already knows the entity. The switcher
becomes dumb:

```tsx
function LanguageSwitcher() {
  const { state } = useContext(MasterContext);
  const { lang, localePaths } = state;            // localePaths seeded by server
  return (
    <nav className="lang-switcher" aria-label="Language">
      {(["uk","ru","en"] as const).map(l => (
        <Link key={l} href={localePaths?.[l] ?? `/${l}`}
              hrefLang={l} aria-current={l===lang ? "true" : undefined}>
          {LANG_LABELS[l]}
        </Link>
      ))}
    </nav>
  );
}
```

### 3.3 Fallback if you don't want to thread `localePaths` (simpler v1)
Since every *currently live* route uses language-independent segments, a **client-only path
rewrite** is correct for v1:

```ts
const pathname = usePathname();           // /uk/milan/beauty
const rest = pathname.replace(/^\/(uk|ru|en)/, "");  // /milan/beauty
const hrefFor = (l: Lang) => `/${l}${rest}` || `/${l}`;
```

This handles home/city/category/city×cat/master/privacy with zero server plumbing. Adopt this
for v1; upgrade to the seeded `localePaths` approach **before** enabling per-profession slug
landings (the only case the string rewrite gets wrong). Document this as the explicit upgrade
trigger.

Recommendation: **ship the string-rewrite switcher in v1** (simplest, correct for all live
routes), and add the `localePaths` seed in the same PR that introduces profession-slug landings.

---

## 4. Content Gap for `en`

`en` must be non-thin before it is indexed. Inventory of what to author, by file:

| Area | File / symbol | Gap | Fallback today |
|---|---|---|---|
| Profession slug + lead + sub | `lib/seo-data.ts` `PROFESSION_SEO[id].en` | Authored uk/ru only | `slug→profId`, `lead→nomName(en)` (`lib/data.ts:69,72`) |
| "How to choose" tip | `lib/seo-data.ts` `PROFESSION_TIPS[id].en` | uk/ru only | generic tip in `content.ts:86-90` |
| City prepositional | `lib/seo-data.ts` `CITY_PREP[id].en` | uk/ru only | computed in `cityPrep` (`data.ts:80-88`) — uk/ru logic, wrong for en |
| City region sentence | `lib/seo-data.ts` `CITY_REGION[id].en` | uk/ru only | empty string (region sentence skipped) |
| Page copy builders | `lib/content.ts` (12 fns) | All branch `ru?:uk` | en falls into uk template (WRONG language) |
| Server UI strings | `lib/i18n.ts` `T.en` | absent | none — would crash/blank |
| Client UI strings | `spa/i18n/translations.ts` `en` block | exists (good) | — |
| Home title/desc | `app/[lang]/page.tsx` `homeTitle` | ru/uk only | falls to uk |
| City/cat titles+desc | `[city]/page.tsx`, `[city]/[category]/page.tsx` | ru/uk only | falls to uk |
| Master title/desc | `lib/content.ts` `masterTitle/Description` | ru/uk only | falls to uk |
| Master data reality | masters' `name`, `about`, `tags`, `languages` | Cyrillic / uk-ru content | `transliterate(name)` for non-uk (`MasterCard.tsx:43`); bios stay Cyrillic |
| `<html lang>` | root/[lang] layout | hardcoded uk | wrong for en (and ru!) |

### 4.1 The deep risk: master data is not English
The directory's substance — master names, bios (`about`), tags — is authored in
Ukrainian/Russian. An `/en/...` page will have English chrome (titles, UI, intros) wrapped
around **Cyrillic master cards and bios**. Search engines may still judge en pages as
mixed-language / partially duplicate of uk/ru. `transliterate(name)` (`MasterCard.tsx:43`)
latinizes names but bios/tags remain Cyrillic.

Mitigations (in order of effort):
1. **Author all *template* English** (the table above except master data). This makes the
   indexable text (title, h1, intro, FAQ, UI) genuinely English — the part that ranks.
2. Accept Cyrillic in card meta/bios for v1; English-speaking diaspora searching in English
   still get an English-framed page. Tags could be mapped to English via `localizedName` if the
   data has `.en` tag keys (check the dataset).
3. (Later) translate `about` on demand or store `about_en`.

### 4.2 Thin/duplicate-content gating (the actual launch control)
Do **not** index `en` until §4.1 step 1 is complete. Mechanism:

- **Per-page `noindex` for en** while content is incomplete: in each `generateMetadata`, if
  `lang === "en" && !EN_CONTENT_READY`, set `robots: { index: false, follow: true }`. `follow`
  keeps link equity flowing; `index:false` keeps thin pages out of the index.
- **Keep `en` in hreflang `alternates.languages`** even while noindexed? No — hreflang should
  point only to indexable equivalents. While gated, **omit `en` from hreflang** and from the
  **sitemap** (§2 `INDEXED_LANGS`). The `en` routes still *exist and render* (users can switch
  to them), they're just not advertised to crawlers.
- A single const `EN_INDEXED = false` in `lib/i18n.ts` drives: sitemap inclusion, hreflang
  inclusion, and the per-page `robots` flag. Flip to `true` in one commit when content lands.

### 4.3 Phased rollout for en
Phase A: routes live, `EN_INDEXED=false`, switcher offers en, en pages render (English chrome
where authored, fallbacks elsewhere) — **shippable, no SEO risk** (noindex + not in sitemap).
Phase B: author template English (seo-data, content.ts, i18n `T`, page titles). Phase C: flip
`EN_INDEXED=true`; en enters sitemap + hreflang; submit sitemap. Monitor Search Console for
duplicate/thin flags on en; if flagged, revert the flag (cheap rollback).

---

## 5. Migration Sequencing (shippable at every step)

Constraints: prod deploys from `main`, no staging; `dev.majstr.xyz` exists (Root.tsx `IS_DEV`
banner) — use it as the verification surface via the `develop` branch before promoting to
`main`. Each step below is independently deployable and leaves the site working.

**Step 0 — Land the in-flight uk/ru fix cleanly (no en yet).**
The uncommitted stopgaps (`urlLang` clamp usage, restore effect, `scroll:false`) are on
`develop`; `urlLang` clamp commit is already on `main`. Before adding en, **remove the client
lang divergence for the existing uk/ru** so the architecture is clean:
- Delete the restore layout-effect + `getInitialLang` (`context.tsx`).
- Make the switcher a URL link (string-rewrite version, §3.3) limited to uk/ru.
- Remove `setLang`/`SET_LANGUAGE`.
- Replace `urlLang(lang)` call sites with `lang` (still uk/ru only at this point).
Result: identical uk/ru SEO, but URL-driven and flash-free. Ship to dev → main. This is the
safe, reversible core; it carries **zero SEO change** (same routes, same sitemap) and fixes the
404/flip bugs immediately.

**Step 1 — Add `en` as a non-indexed locale.**
- `LANGS = ["uk","ru","en"]`; add `EN_INDEXED=false`.
- Relax `seo-data.ts` records to `Partial<Record<Lang,...>>` (fallbacks fire).
- Add `en` branches to i18n maps (`HTML_LANG`, `OG_LOCALE`, `NAME_KEY`, plural) and a minimal
  `T.en` (can be English placeholders, but real English is cheap here — do it).
- Gate sitemap + hreflang to exclude en (`INDEXED_LANGS`); add per-page `noindex` for en.
- Switcher shows uk/ru/en.
Result: en pages render and are reachable, but invisible to crawlers. **No SEO regression** —
uk/ru sitemaps and hreflang are unchanged (en simply absent). Ship to dev → main.

**Step 2 — Fix `<html lang>` per-locale** (§2 layout fix). Independent, low-risk a11y/SEO win.

**Step 3 — Author English template content** (content.ts, seo-data en, page titles/desc, hero
copy fix incl. the ru branch). Behind `EN_INDEXED=false` still — author and verify on dev.

**Step 4 — Flip `EN_INDEXED=true`.** en enters sitemap + hreflang; per-page noindex lifts.
Re-tighten seo-data types to strict `Record<Lang,...>` (compiler proves completeness). Submit
updated sitemap. Monitor Search Console.

### 5.1 Protecting existing indexed /uk and /ru URLs
- **City/category/master slugs are language-independent ids** and **do not change** in this
  migration — `city.id`, `cat.id`, `masterSlug` are untouched. So **every currently indexed
  `/uk/...` and `/ru/...` URL stays byte-identical.** No redirects required for uk/ru. This is
  the single most important SEO safety property and it holds because we are *adding* a locale,
  not re-slugging.
- Canonicals for uk/ru are unchanged (`abs(/${lang}/${id})`).
- hreflang for existing uk/ru pages **gains an `en` alternate only after Step 4** — until then
  their hreflang set is unchanged.
- The master canonical-slug redirect (`m/[slug]/page.tsx:73`) is preserved.
- No URL is removed or moved → **no 301s needed**, which is the lowest-risk possible migration.

---

## 6. Risks & Open Questions

**Hydration.** Today's `getInitialLang()` + restore layout-effect is the real hydration hazard
(server renders seed lang; client effect can change it pre-paint → mismatch/flash). Deleting it
*removes* a risk. After migration, server and client both use `seed.lang` → matched. Verify the
switcher `<Link>` doesn't read `usePathname()` during SSR in a way that differs from the server
path (it won't — `usePathname` is stable for the rendered route). ✅ low risk.

**ISR / static generation scale.** Adding en triples `generateStaticParams` output for home,
city, category, city×cat, and master pages (`m/[slug]` flat-maps LANGS — the biggest set). With
`revalidate=3600` and `dynamicParams=true`, un-pre-rendered locales render on-demand then cache.
**Decision needed:** for `m/[slug]`, consider **not** pre-generating en at build (rely on
`dynamicParams` on-demand) while `EN_INDEXED=false`, to keep build time/cost flat. Concretely:
`generateStaticParams` for masters returns uk/ru always, plus en only when `EN_INDEXED`. Home /
city / cat sets are small — pre-generate all three locales freely.

**Caching.** Per-page `noindex` is set in `generateMetadata`, which runs per render and is
included in the cached HTML — fine with ISR. Flipping `EN_INDEXED` requires a redeploy/revalidate
to purge cached `noindex` headers from already-rendered en pages; the `app/api/revalidate` route
exists — use it (or a full deploy) at Step 4. Note it in the runbook.

**The `?card=` legacy redirect** (`app/page.tsx:16-27`). Unaffected — it redirects to
`/uk/m/<slug>`, still valid. The home `page.tsx` deliberately does NOT read `searchParams`
(comment lines 25-31) to stay static; preserve that. The Modal's `history.pushState` to
`/${lang}/m/...` (`Modal.tsx:146-150`) is now correct for all three locales after the `urlLang`
removal.

**Apex redirect** (`app/page.tsx:28`). Stays `/uk` (`DEFAULT_LANG`). No change. `x-default`
hreflang stays uk (`urls.ts:19`). Confirm this is the desired default for a diaspora audience —
arguably en or a geo/Accept-Language redirect could be considered later, but **out of scope**;
keep uk to avoid touching the consolidated apex behavior.

**`<html lang>` is currently wrong for ru too** (hardcoded uk, `layout.tsx:83`). This is a
pre-existing bug the migration must fix (Step 2). Flag: verify the App Router lets
`app/[lang]/layout.tsx` own `<html>`/`<body>` while `app/layout.tsx` passes through — test with
a build; if Next requires `<html>` in the root layout, fall back to a documented limitation or a
middleware/`generateMetadata`-driven approach. **Open question — verify mechanism during Step 2.**

**`spa/i18n/lang.ts` "shared with onboarding wizard."** The file comment claims sharing. Confirm
no live importer outside `web/` before pruning `APP_LANGS`/deleting `contextualLang` et al. (grep
showed consumers only in `web/spa`; the wizard lives in the separate legacy/backend package and
does not import from `web/spa`). Low risk, but verify before deletion.

**ru UI completeness.** Audit surfaced that `translations` has full uk/en/it/pt blocks at the
top; **ensure a complete `ru` block exists** (ru is a launch locale). Also the hero stat
sentence (`Main.tsx:247-249`) currently renders English for ru — fix when adding the ru branch.
This is a latent ru-quality bug independent of en; fold the fix into Step 0 or Step 3.

**Country toggle is disabled** (`Root.tsx:248 COUNTRY_SELECTOR_ENABLED=false`) — Italy only.
`countryID` stays `IT` in the seed. No interaction with the locale work. ✅

---

## 7. Definition of Done

- `LANGS = ["uk","ru","en"]`; `urlLang`, `SET_LANGUAGE`, `getInitialLang`, restore effect,
  localStorage `lang` all deleted; `APP_LANGS`/translations pruned to 3 locales.
- Switcher is `<Link>`-based; switching language navigates to the same page in the target locale
  with no flash and no scroll jump; `/en/<city>` etc. are real routes (no 404).
- Existing `/uk` and `/ru` URLs, canonicals, and slugs are byte-identical to pre-migration.
- `<html lang>` matches the URL locale for uk/ru/en.
- While gated: en absent from sitemap + hreflang, per-page `noindex`; en pages still render and
  are switch-reachable. After flip: en fully in sitemap + hreflang with authored English copy.
- `npm run build` (web) is green; `npm run lint` clean (no unused `urlLang`/`AppLang` imports).
