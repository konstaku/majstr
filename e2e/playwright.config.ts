import { defineConfig } from "@playwright/test";

// Smoke E2E for the Next app (web/). No real backend: the SSR catalogue fetch
// hits an in-memory fixtures server (global-setup.ts), and per-spec client
// behaviour is stubbed via page.route() — no Mongo, no bot token, no network.
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  globalSetup: "./global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "npm --prefix ../web run dev -- --port 3000",
    // Probe a STATIC asset for readiness — not a page that would SSR-fetch the
    // API before global-setup's fixtures server is up (that deadlocks).
    url: "http://localhost:3000/favicon.png",
    // SSR fetch → 127.0.0.1 (the fixtures server binds there); client fetch →
    // localhost, where the specs' page.route() intercepts it.
    env: {
      API_BASE: "http://127.0.0.1:5001",
      NEXT_PUBLIC_API_URL: "http://localhost:5001",
      E2E: "1",
    },
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
