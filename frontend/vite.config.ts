/// <reference types="vitest" />
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import mkcert from "vite-plugin-mkcert";

// mkcert installs a local CA (needs sudo) — only useful for the real dev
// server, and it breaks non-interactive test/CI runs. Skip it under Vitest.
const isTest = process.env.VITEST === "true";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: isTest ? [react()] : [react(), mkcert()],
    server: {
        host: true,
        https: true,
        port: 5173,
    },
    test: {
        environment: "happy-dom",
        globals: true,
        setupFiles: "./src/test/setup.ts",
    },
});
