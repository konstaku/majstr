/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import mkcert from "vite-plugin-mkcert";

// mkcert installs a local CA (needs sudo) — only useful for the real dev
// server, and it breaks non-interactive test/CI runs. Skip it under Vitest
// and under the Playwright E2E runner (which drives a plain-http dev server).
const isTest = process.env.VITEST === "true" || process.env.E2E === "1";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: isTest ? [react()] : [react(), mkcert()],
    server: {
        host: true,
        https: !isTest,
        port: 5173,
    },
    test: {
        environment: "happy-dom",
        globals: true,
        setupFiles: "./src/test/setup.ts",
    },
});
