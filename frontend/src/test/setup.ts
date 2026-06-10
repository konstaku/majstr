import "@testing-library/jest-dom/vitest";
import { vi, beforeAll, afterEach, afterAll } from "vitest";
import { server } from "./server";

// .env.development is not loaded under Vitest (mode=test) — pin the API base
// before any module captures it.
vi.stubEnv("VITE_API_URL", "http://localhost:5001");

// This happy-dom/vitest combination exposes neither globalThis.localStorage
// nor window.localStorage; app code (api/client.ts) uses the bare global, so
// provide a minimal in-memory implementation.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => void store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
