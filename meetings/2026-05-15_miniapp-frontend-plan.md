# Meeting: Telegram Mini App — Frontend Codebase Plan
Date: 2026-05-15

## What this is
Build-ready frontend plan for the TMA onboarding spike. Sits beside the Backend Architect's API plan and the UX Architect's screen spec. Scope: code structure, build/dev tooling, SDK choice, shared-component strategy, state management, deployment. Opinionated on every pick.

---

## 1. Repo structure decision

**Stay single-app.** No monorepo. The current `frontend/` Vite project keeps one entry point (`index.html` → `src/main.tsx`) and grows a TMA branch internally. A pnpm workspace / Turborepo split would buy nothing for one dev and one shipping wizard, and would double the lint/build/CI surface.

The wizard is *the* shared artifact. Web and TMA both render it inside different shells.

```
frontend/
├─ index.html                       # single entry, served at majstr.xyz AND app.majstr.xyz
├─ vite.config.ts
├─ src/
│  ├─ main.tsx                      # bootstraps either shell based on surface detection
│  ├─ router.tsx                    # web routes (unchanged) + /onboard, /claim/:id
│  ├─ surface/                      # NEW — surface abstraction layer
│  │  ├─ detect.ts                  # isTMA(), getSurface()
│  │  ├─ useTelegramContext.ts      # the central hook (see §3)
│  │  ├─ telegram-sdk.ts            # init/SDK wiring, single import surface
│  │  └─ mockTelegram.ts            # dev/test stub for window.Telegram.WebApp
│  ├─ wizard/                       # NEW — the shared component tree
│  │  ├─ OnboardingWizard.tsx       # orchestrator (step machine + draft sync)
│  │  ├─ ClaimWizard.tsx            # reuses 80% of steps + components
│  │  ├─ steps/
│  │  │  ├─ StepIdentity.tsx
│  │  │  ├─ StepProfession.tsx
│  │  │  ├─ StepLocation.tsx
│  │  │  ├─ StepMedia.tsx
│  │  │  └─ StepContact.tsx
│  │  ├─ schema.ts                  # zod schemas per step + composite
│  │  ├─ useDraft.ts                # debounced PATCH + optimistic state
│  │  └─ useWizardMachine.ts        # step index, validation gate, nav
│  ├─ ui/                           # NEW — surface-agnostic primitives
│  │  ├─ PrimaryCTA.tsx             # MainButton OR <button>
│  │  ├─ BackAffordance.tsx         # BackButton OR header arrow
│  │  ├─ Popup.tsx + usePopup.ts    # showPopup OR custom modal
│  │  ├─ useHaptic.ts               # haptic OR no-op
│  │  └─ tokens.css                 # CSS vars → --tg-theme-* OR brand
│  ├─ api/                          # NEW — fetch wrapper with per-surface auth
│  │  ├─ client.ts                  # apiFetch() — sets right header
│  │  └─ endpoints.ts               # typed wrappers (getDraft, patchDraft, …)
│  ├─ pages/AddNewRecord.tsx        # kept short-term, redirects to /onboard
│  └─ …existing files unchanged
```

Web-specific glue lives nowhere special — web is the "no shell" case. TMA-specific glue lives in `surface/telegram-sdk.ts` and the `isTMA` branches inside `ui/*`. That's it.

---

## 2. TMA SDK choice

**Pick: `@telegram-apps/sdk` v3 + `@telegram-apps/sdk-react`** (the package family at `docs.telegram-mini-apps.com`). Drop `@twa-dev/sdk`.

Justification:
- Maintenance: official-adjacent, weekly releases through 2025–26; `@twa-dev/sdk` is a thin re-export of an older `tma.js`, lagging on `safeAreaInset`, `requestFullscreen`, and the 2024 viewport API revisions.
- Type quality: `@telegram-apps/sdk` is TS-native, narrow types per API, no `any`. `@twa-dev/sdk` types are looser.
- Bundle: `@telegram-apps/sdk` is tree-shakable scoped components — `import { mainButton } from '@telegram-apps/sdk'` pulls ~3 KB gz. `@twa-dev/sdk` is monolithic.
- React integration: `@telegram-apps/sdk-react` ships `useSignal`-based hooks (`useLaunchParams`, `useViewport`, `useMainButton`) that mirror the SDK's signal model cleanly.

**Drop down to `window.Telegram.WebApp` directly** for exactly one case: the very first synchronous boot in `main.tsx` — read `window.Telegram?.WebApp?.initData` to decide the surface *before* the SDK has initialised. After that, never touch `window.Telegram` again.

Install:
```
npm i @telegram-apps/sdk @telegram-apps/sdk-react
```

---

## 3. Detecting the surface

The signal: **`window.Telegram?.WebApp?.initData` non-empty**. `initDataUnsafe.user` can be present in some cached states without a valid signed payload — `initData` is the truth. Confirmed against the UX research note (§1: "Identity — `initData` / `initDataUnsafe`").

```ts
// src/surface/detect.ts
export const isTMA = (): boolean =>
  typeof window !== 'undefined' &&
  !!window.Telegram?.WebApp?.initData &&
  window.Telegram.WebApp.initData.length > 0;

// src/surface/useTelegramContext.ts
type Surface = 'tma' | 'web';

export interface TelegramContextValue {
  surface: Surface;
  isTMA: boolean;
  initData: string | null;            // raw signed string, for Authorization header
  user: TelegramUser | null;          // from initDataUnsafe.user
  theme: ThemeParams;                 // tg theme params, OR brand defaults on web
  colorScheme: 'light' | 'dark';
  viewport: { height: number; stable: number; isExpanded: boolean };
  startParam: string | null;          // for ?startapp=claim_<id> / resume_<draft>
  cloud: {                            // CloudStorage on TMA, localStorage shim on web
    get: (k: string) => Promise<string | null>;
    set: (k: string, v: string) => Promise<void>;
    remove: (k: string) => Promise<void>;
  };
}

export function useTelegramContext(): TelegramContextValue;
```

Provider mounts once in `main.tsx`, reads the surface synchronously, lazy-inits the SDK if TMA. The wizard never reads `isTMA` directly — it uses the `<PrimaryCTA>` / `<BackAffordance>` / `usePopup()` primitives, which branch internally. The *only* place the wizard sees `isTMA` is when it needs to call `requestContact` (TMA-only path, web shows manual phone input as fallback).

That's the abstraction line: **primitives branch, wizard doesn't.** The wizard component tree is surface-agnostic.

---

## 4. Auth handoff to backend

```ts
// src/api/client.ts
import { isTMA } from '../surface/detect';

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (isTMA()) {
    headers.set('X-Telegram-Init-Data', window.Telegram!.WebApp.initData);
  } else {
    const token = JSON.parse(localStorage.getItem('token') ?? 'null');
    if (token) headers.set('Authorization', token);
  }
  const res = await fetch(`${import.meta.env.VITE_API_URL}${path}`, {
    ...init, headers,
  });
  if (res.status === 401) handle401();
  return res;
}

function handle401() {
  if (isTMA()) {
    // initData can drift if user keeps Mini App open >1h
    window.Telegram!.WebApp.close();         // forces a fresh reopen with fresh initData
  } else {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
}
```

Lives in `src/api/client.ts`. Every API call goes through `apiFetch`. The hook `useAuthenticateUser` (see §11) becomes a thin wrapper that calls `apiFetch('/auth')` and trusts it.

`X-Telegram-Init-Data` header (raw query string as the value) is the backend's expectation per the Backend Architect's plan. Don't put it in the URL — query strings get logged.

---

## 5. State management for the wizard

**Keep `react-hook-form`.** It's already in the deps, validates well with zod, and its `watch()` + `getValues()` give us cheap field-level subscriptions for the debounced draft sync. The wizard is one `useForm` instance whose `defaultValues` are seeded from the server draft on mount.

Step-level zod schemas drive per-step validation:
```ts
// src/wizard/schema.ts
export const stepSchemas = {
  identity:    z.object({ name: z.string().min(2).max(25), languages: z.array(z.string()).min(1) }),
  profession:  z.object({ profCategoryID: z.string(), professionID: z.string(), tags: z.array(z.string()).max(5) }),
  location:    z.object({ locationID: z.string(), alsoServes: z.array(z.string()).optional() }),
  media:       z.object({ photoKey: z.string().nullable(), about: z.string().min(20).max(280) }),
  contact:     z.object({ phone: z.string().regex(/^\+/), allowBotDM: z.boolean().optional() }),
};
export const draftSchema = z.object({}).merge(/* all step shapes */);
```

**Draft sync (debounced PATCH):**
```ts
// src/wizard/useDraft.ts
const debouncedPatch = useMemo(
  () => debounce((partial) => apiFetch('/draft', {
    method: 'PATCH', body: JSON.stringify(partial),
    headers: { 'Content-Type': 'application/json' },
  }), 500),
  []
);
useEffect(() => {
  const sub = watch((values, { name }) => {
    if (name) debouncedPatch({ [name]: values[name] });
  });
  return () => sub.unsubscribe();
}, [watch]);
```

**Optimistic vs. server-truth:**
- On launch: fetch the draft, hydrate `useForm.reset(serverDraft)`. Server is truth at boot.
- After mount: local form state is truth. Patches go to the server fire-and-forget; failed PATCHes are queued and retried with exponential backoff (max 3) — same logic survives the inevitable spotty cell signal during onboarding.
- On step submit (Next): explicit `PUT /draft/step/:n` *with* the server's `updated_at` etag. If 409, show `usePopup({title: 'Edited elsewhere', message: 'Load latest?'})` per the UX note (§5, "Concurrent edits").

**Step-index state:** *both*, with clear roles.
- Server: source of truth for "user reached step N" (recorded on each Next). Set on draft document.
- CloudStorage (TMA only): a *write-through cache* of `currentStep` so reopening the Mini App snaps to the right screen in ~10ms before the draft GET resolves. Key: `wiz:step` (4 chars). 1 of 1024 keys used.
- localStorage on web: same purpose, same key.

**Validation timing:** per-step on Next (the gate that enables `MainButton`). *Not* inline-while-typing — too noisy in a wizard, especially with the keyboard pushing viewport around. Field-level errors appear only after a field has been blurred *and* the user tried to advance. Exception: phone format (TMA `requestContact` returns a valid phone; manual entry shows format hint as the user types).

Global state (`MasterContext`) is untouched. The wizard is self-contained.

---

## 6. Vite config + build for TMA

**No separate build.** Same `dist/`, same `index.html`. The TMA is loaded by Telegram from a URL we set in BotFather — it's just a web page. The runtime detects the surface and adapts.

**Env vars:**
- `VITE_API_URL` is identical for both surfaces (`https://api.majstr.xyz`).
- New: `VITE_TMA_BOT_USERNAME` (e.g. `majstr_bot`) — used to construct `t.me/<bot>/<app>` deep links from the web side ("Open in Telegram" button).
- New: `VITE_TMA_APP_SLUG` (e.g. `onboard`) — same purpose.

**Domain:** **subdomain `app.majstr.xyz`**, not the apex. Two reasons:
1. CSP / `frame-ancestors`: Telegram's webview is strict about `Permissions-Policy` and `Cross-Origin-Embedder-Policy`. Easier to ship a tuned response header set on a dedicated nginx server-block than fight CORS bleed with the main site.
2. Cookie hygiene: the main site sets various cookies (analytics etc.); the TMA should be cookie-free (it uses `initData`, not cookies). A subdomain isolates this cleanly.
3. Bonus: BotFather config and analytics filtering are dead-simple when the TMA traffic is a single domain.

Build artifact is identical — nginx just serves the same `dist/` from both vhosts. Or, if you want zero CSP risk on the main site, build twice with the same source but a `--base` flag (probably overkill).

**Vite plugins to add:**
```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [react(), mkcert()],            // mkcert gives local HTTPS — Telegram won't open HTTP
  server: { host: true, https: true, port: 5173 },
  build: { target: 'es2020', sourcemap: true },
});
```

`vite-plugin-mkcert` is the smaller of the two options and doesn't require a separate `mkcert` install on macOS if `homebrew` is around. ngrok is for the *integration* test (BotFather points to an ngrok URL); mkcert is for the *isolated* `npm run dev` page-load test in a desktop browser.

---

## 7. Local dev story

**Day-zero, from `git pull` to "wizard inside Telegram on phone":**

1. `cd frontend && npm install` — pulls `@telegram-apps/sdk`, `@telegram-apps/sdk-react`, `vite-plugin-mkcert`.
2. Backend running locally: `cd backend && npm run devStart` (HTTP on 5000; backend is fine HTTP locally because the *frontend* is what Telegram loads).
3. Frontend running locally: `npm run dev` — `vite-plugin-mkcert` issues a local cert; Vite serves at `https://localhost:5173`. Open that in desktop browser — wizard runs in web mode (no `window.Telegram`).
4. Start an ngrok tunnel: `ngrok http https://localhost:5173`. Take the `https://xxxx.ngrok.app` URL.
5. **BotFather, once:**
   - `/mybots` → `majstr_bot` → `Bot Settings` → `Menu Button` → set URL to the ngrok URL.
   - `/newapp` → pick the bot → slug `onboard-dev` → set URL to ngrok URL. This creates a Direct Link Mini App at `t.me/majstr_bot/onboard-dev`.
6. Open Telegram on your phone, tap the menu button on the bot — the wizard loads inside Telegram with real `initData`.
7. Backend `.env` needs `TELEGRAM_BOT_TOKEN` (already present) for `initData` HMAC verification.

**Env vars the dev needs locally** (`frontend/.env.development`):
```
VITE_API_URL=http://localhost:5000
VITE_TMA_BOT_USERNAME=majstr_bot
VITE_TMA_APP_SLUG=onboard-dev
```

For the day-to-day inner loop, the dev mostly works in desktop browser using a `?mock=tma` query-string flag that activates `mockTelegram.ts` (see §10). Only open Telegram on the phone for the actual TMA-specific checks (BackButton, keyboard, haptics, real `requestContact`).

---

## 8. Shared component strategy

Pattern for every primitive: **one component name, one import, branches internally on `isTMA`.** Surface-agnostic call sites — the wizard never knows.

| Primitive | Strategy | Sketch |
|---|---|---|
| **Sticky CTA** | Shared `<PrimaryCTA>`, branches | TMA: imperatively drives `mainButton` via SDK (`mainButton.setParams({ text, isEnabled, isLoaderVisible }).onClick(...)`). Web: renders an actual `<button>` fixed to viewport bottom with `padding-bottom: env(safe-area-inset-bottom)`. |
| **Back affordance** | Shared `<BackAffordance>`, branches | TMA: wires `backButton.show()` + `onClick`. Web: renders a top-left chevron in the header. Same `onBack` prop both ways. |
| **Native popup** | `usePopup()` hook, branches | TMA: `popup.open({ title, message, buttons })` returns the chosen button id. Web: renders a portal-based modal with the same API surface. Hook because most usages are imperative (`const id = await popup(...)`). |
| **Haptics** | `useHaptic()` hook, branches | TMA: `hapticFeedback.impactOccurred('light')` / `selectionChanged()` / `notificationOccurred('success')`. Web: returns no-op functions. Same shape both sides. |
| **Theme** | Single CSS-vars layer | `src/ui/tokens.css` defines `--app-bg`, `--app-fg`, `--app-accent` etc. On TMA, an effect maps `themeParams` → these vars (`--app-bg: var(--tg-theme-bg-color)`). On web, the brutalist palette (per memory) hard-codes them. Components never read `--tg-theme-*` directly — they read `--app-*`. |
| **Phone share** | **One component, branches** | `<PhoneCapture>` with two paths: TMA shows a "Share via Telegram" button → `requestContact()` → on success, fills the form. Web shows the existing `react-phone-input-2`. Both write to the same `react-hook-form` field. |

Example signature for the CTA:
```tsx
// src/ui/PrimaryCTA.tsx
type Props = {
  label: string;
  onPress: () => void | Promise<void>;
  isLoading?: boolean;
  isEnabled?: boolean;
};
export function PrimaryCTA(props: Props) {
  return isTMA() ? <TMAMainButton {...props} /> : <WebButton {...props} />;
}
```

Why "branch internally" beats "two components": the wizard's JSX stays clean and grep-able. The diff between surfaces is contained in ~6 small files in `src/ui/`. New devs (read: future-you) don't have to hold both surfaces in their head when editing a step.

---

## 9. Photo upload UX

Server-mediated to S3 per the backend plan: frontend requests a presigned PUT URL, uploads directly to S3, then PATCHes the draft with the returned key.

Wiring:
- One `<input type="file" accept="image/*" capture="environment">` covers everything. Telegram's webview honours `capture` and opens the OS camera/picker chooser. No special TMA picker exists for Direct Link Mini Apps (UX note §1: "No first-class camera API").
- **Three buttons** in StepMedia (per UX note):
  1. "Use my Telegram photo" → just sets `photoKey = 'tg:photo_url'` server-side; no upload from the frontend. Zero-friction path, ~70% conversion.
  2. "Upload from gallery" → `<input type="file" accept="image/*">`.
  3. "Take a photo" → `<input type="file" accept="image/*" capture="environment">`.
- **Preview**: render a `URL.createObjectURL(file)` thumbnail immediately on selection. Replace with the S3 URL once upload completes (avoids one extra network roundtrip for the preview).
- **Progress**: use `XMLHttpRequest` (not `fetch`) for the S3 PUT — gives `progress` events. Render a thin determinate bar on the thumbnail.
- **Cancel mid-upload**: `xhr.abort()`. Keep an `AbortController` in a ref.
- **Error recovery**: retry button on the thumbnail with the same File ref. If the user navigates away mid-upload, kill the xhr in the cleanup function and clear the local state — the draft already has the previous photoKey if any.
- **Offline retry**: detect `navigator.onLine`; if false, show "Will retry when online" and listen for the `online` event to re-trigger the upload.
- On TMA, `setHeaderColor('bg_color')` while inside the photo step prevents a flash of Telegram blue behind the file picker dismissal animation on iOS.

---

## 10. Testing strategy

**Mock the Telegram bridge in dev/test.** `src/surface/mockTelegram.ts`:

```ts
// activated by ?mock=tma or VITEST=true
export function installTelegramMock() {
  (window as any).Telegram = {
    WebApp: {
      initData: 'mock_init_data_signed_locally',
      initDataUnsafe: { user: { id: 5950535, first_name: 'Dev', /*…*/ }},
      themeParams: { /* brutalist palette as mock */ },
      MainButton: makeMockMainButton(),
      BackButton: makeMockBackButton(),
      HapticFeedback: { impactOccurred: vi.fn(), /*…*/ },
      showPopup: vi.fn(async ({ buttons }) => buttons[0].id),
      requestContact: vi.fn(async () => ({ phone_number: '+390000000000' })),
      // …
    },
  };
}
```

Backend has a `DEV_BYPASS_INITDATA_HMAC=true` flag (per the Backend Architect's plan) that accepts the mock string locally — same flag the dev uses for `curl` testing.

- **Unit tests: Vitest + React Testing Library.** Vitest because Vite already; happy-dom over jsdom for speed; co-locate `*.test.tsx` next to components. Coverage target: 70% for `wizard/*` and `ui/*`. Test the *branching* explicitly — every shared primitive has both an `isTMA: true` and `isTMA: false` test.
- **Integration tests: Vitest + msw.** Mock `apiFetch` calls with `msw`. Cover: draft hydration, 409 conflict path, 401 retry path, debounced PATCH coalescing.
- **E2E: skip Playwright for this spike.** Playwright can't emulate Telegram's webview faithfully (no real `initData`, no real `MainButton`). The cost/value isn't there for a 2-week spike. Instead, instrument a manual test checklist (below) that the dev runs on a real device before each ship.
- **Manual test checklist for ship-readiness:**
  - [ ] Wizard reaches step 5 and submits on iOS Telegram (latest)
  - [ ] Same on Android Telegram (latest)
  - [ ] Same on Telegram Desktop macOS
  - [ ] BackButton works on every step (no dead-ends)
  - [ ] Keyboard open → MainButton doesn't collide on iOS
  - [ ] `requestContact` flow completes end-to-end
  - [ ] Photo upload from camera + gallery + "use Telegram photo"
  - [ ] Theme matches when user switches Telegram between light/dark mid-flow
  - [ ] Reopening Mini App resumes at the correct step (CloudStorage cache)
  - [ ] Server draft is correctly persisted (check Mongo)
  - [ ] 401 / fresh initData retry works (let session age >1h in Telegram, then act)
  - [ ] Web build at majstr.xyz/onboard still renders the same wizard correctly

---

## 11. Migration impact on existing code

**Files added** (rough LOC):

| File | LOC |
|---|---|
| `src/surface/detect.ts` | 15 |
| `src/surface/useTelegramContext.ts` + provider | 120 |
| `src/surface/telegram-sdk.ts` | 60 |
| `src/surface/mockTelegram.ts` | 80 |
| `src/wizard/OnboardingWizard.tsx` | 180 |
| `src/wizard/ClaimWizard.tsx` | 90 (reuses) |
| `src/wizard/steps/*` (5 files) | 5 × ~100 = 500 |
| `src/wizard/schema.ts` | 60 |
| `src/wizard/useDraft.ts` | 100 |
| `src/wizard/useWizardMachine.ts` | 80 |
| `src/ui/PrimaryCTA.tsx` | 60 |
| `src/ui/BackAffordance.tsx` | 40 |
| `src/ui/Popup.tsx` + `usePopup.ts` | 90 |
| `src/ui/useHaptic.ts` | 30 |
| `src/ui/tokens.css` | 40 |
| `src/api/client.ts` + `endpoints.ts` | 120 |
| tests (co-located) | ~600 |
| **total added** | **~2 200 LOC** |

**Files edited:**
- `src/main.tsx` — wrap `<App />` with the new `<TelegramContextProvider>`. ~+15 LOC.
- `src/router.tsx` — add `/onboard` and `/claim/:masterId` routes. ~+10 LOC.
- `vite.config.ts` — add `mkcert` plugin, `server.https`, `server.host`. ~+8 LOC.
- `src/custom-hooks/useAuthenticateUser.ts` — **extend** (don't replace). The new shape: if `isTMA`, the hook hits `/auth` with `X-Telegram-Init-Data`; otherwise the existing JWT path. Returns the same `UseAuthenticateUserState` so call sites don't change. ~+25 LOC.
- `src/context.tsx` / `src/reducer.tsx` — leave alone. The wizard owns its own state. Maybe add a `WIZARD_SUBMITTED` action later if `Main` page needs to celebrate, but not for v1.
- `src/pages/AddNewRecord.tsx` — **keep for one release**, but make it redirect to `/onboard` on web (and obviously on TMA). Delete in the release after, once we've confirmed nothing links to `/add` externally. Net: ~+5 LOC now, -700 LOC later.
- `package.json` — add `@telegram-apps/sdk`, `@telegram-apps/sdk-react`, `vite-plugin-mkcert`, `vitest`, `@testing-library/react`, `happy-dom`, `msw`.

Claim flow (5 days after onboarding) adds `ClaimWizard.tsx` (~90 LOC, reuses StepIdentity/Contact + new StepClaimEvidence) and one new route. No other changes.

---

## 12. Phasing of frontend work

**Sub-phase A — Foundation (3 days)**
- [ ] A1. Add deps; configure `vite-plugin-mkcert`; verify HTTPS dev server (0.5d)
- [ ] A2. Build `surface/` layer: `detect`, `useTelegramContext`, `telegram-sdk` wiring (1d)
- [ ] A3. Build `api/client.ts` with per-surface auth; extend `useAuthenticateUser` (0.5d)
- [ ] A4. Build `ui/` primitives — PrimaryCTA, BackAffordance, usePopup, useHaptic, tokens.css (1d)

**Sub-phase B — Wizard (4 days)**
- [ ] B1. `useWizardMachine` + `OnboardingWizard` shell with step routing (0.5d)
- [ ] B2. `useDraft` — debounced PATCH, hydrate-from-server, conflict handling (1d)
- [ ] B3. Steps 1–3 (Identity, Profession, Location) — port existing inputs (1d)
- [ ] B4. Step 4 (Media) — photo upload with presigned PUT, progress, cancel (1d)
- [ ] B5. Step 5 (Contact) — PhoneCapture with `requestContact` branch (0.5d)

**Sub-phase C — Ship spike (2 days)**
- [ ] C1. Wire `/onboard` route + `AddNewRecord` redirect; deploy to `app.majstr.xyz` (0.5d)
- [ ] C2. BotFather configuration; ngrok dev loop documented in README (0.5d)
- [ ] C3. Manual test checklist run on iOS + Android + Desktop (0.5d)
- [ ] C4. Mock Telegram + Vitest setup; unit tests for ui/* and wizard machine (0.5d)

**Sub-phase D — Claim flow (3 days, ships ~5 days after onboarding lands)**
- [ ] D1. `ClaimWizard.tsx` + new step (StepClaimEvidence) (1d)
- [ ] D2. `/claim/:masterId` route + `?startapp=claim_<id>` handler (0.5d)
- [ ] D3. Pending state UI + `usePopup` confirmation (0.5d)
- [ ] D4. Manual test checklist for claim path (1d)

Each sub-phase ships independently: A is just refactoring with no user-visible change. B is dogfoodable behind a feature flag (`?wizard=1`). C goes live to TMA users. D extends to claim. Total: ~12 dev-days for both flows, matching the PM's 1.5–2-week spike estimate.

---

## 13. Open questions

1. **TMA app slug** — confirm `onboard` vs `app` vs something else for the Direct Link Mini App URL (`t.me/majstr_bot/<slug>`). UX note §8 lists this open. Picking it blocks BotFather setup.
2. **Subdomain DNS / nginx vhost** — do you want `app.majstr.xyz` provisioned now, or is the spike fine living at `majstr.xyz/onboard` initially and migrating later? The latter is a 1-day cost; the former is ~1 hour of nginx/DNS work but requires a fresh Let's Encrypt cert.
3. **Brand palette in TMA** — should the TMA respect Telegram's themeParams (current plan, native feel) or force the brutalist palette regardless (brand consistency)? The Mini App ecosystem strongly prefers themeParams; brutalist would feel jarring inside Telegram. I'd default to themeParams and only override accent colour. Confirm.
4. **Submit endpoint contract** — does the wizard call `PUT /draft/finalize` (server moves draft → master) or does it call the existing `POST /addmaster`? Affects the StepContact submit handler. Needs to match what the Backend Architect spec'd.
5. **Migration timeline for `AddNewRecord.tsx`** — keep it indefinitely as a fallback, or delete the moment `/onboard` is stable? I'd say delete in the release immediately after the spike's success metric (per-PM, 30-day claim conversion check) reads green.

---

## Decisions made
- Single Vite app, no monorepo.
- `@telegram-apps/sdk` + `@telegram-apps/sdk-react` over `@twa-dev/sdk`.
- Surface detection via `window.Telegram.WebApp.initData` non-empty.
- One `useTelegramContext()` provider; wizard never reads `isTMA`, primitives branch internally.
- `apiFetch` wrapper handles per-surface auth header and 401 differently per surface.
- `react-hook-form` + zod stays; debounced (500 ms) PATCH per field; server is truth at boot, local is truth after.
- Step index cached in CloudStorage (TMA) / localStorage (web) for instant resume.
- Same build, no Vite split. Deploy to `app.majstr.xyz` subdomain.
- `vite-plugin-mkcert` for local HTTPS; ngrok for in-Telegram dev loop.
- Vitest + RTL for unit tests; skip Playwright for the spike; manual checklist for ship-readiness.
- Extend (not replace) `useAuthenticateUser`. Keep `AddNewRecord.tsx` as a temporary redirect to `/onboard`.
- Onboarding ships in ~9 dev-days across phases A–C; claim adds ~3 dev-days in phase D.

## Next steps
- [ ] Founder to resolve the 5 open questions above (TMA slug, subdomain, palette, submit endpoint, AddNewRecord deletion timing).
- [ ] Frontend dev starts sub-phase A as soon as the Backend Architect's `/draft` endpoints are mergeable.
- [ ] BotFather config done in parallel with sub-phase B (no blocker).
- [ ] First manual-checklist run on real devices at end of sub-phase C.
