import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests for the web/ app (catalogue + ported app surfaces). happy-dom for
// the DOM-touching modules (surface detection, components); the `@` alias mirrors
// tsconfig so test imports match app imports. Per-file `// @vitest-environment
// node` overrides the env where DOM globals aren't wanted (e.g. middleware).
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
