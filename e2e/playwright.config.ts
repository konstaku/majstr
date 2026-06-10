import { defineConfig } from "@playwright/test";

// Smoke E2E for the Vite SPA. The backend is never started: every API call
// is stubbed in-page via page.route() (see tests/stubApi.ts), so the suite
// needs no Mongo, no bot token and no network.
export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "npm --prefix ../frontend run dev -- --port 5173 --strictPort",
    url: "http://localhost:5173",
    env: { E2E: "1" },
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
