import { createServer, type Server } from "node:http";
import {
  masters,
  professions,
  profCategories,
  locations,
  countries,
} from "./tests/fixtures";

// Hermetic mock API for the Next SSR pass. page.route() only intercepts browser
// requests, but the Next dev server fetches the catalogue SERVER-SIDE (API_BASE),
// so that fetch needs a real HTTP endpoint. This serves the same fixtures the
// specs assert on; per-spec client behaviour is still tuned via page.route().
// Mirrors the /?q= dispatcher in backend/routes/public.js + /api/reference/*.
let server: Server | undefined;

export default async function globalSetup() {
  server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost:5001");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/json");

    const q = url.searchParams.get("q");
    let body: unknown = null;
    if (url.pathname === "/" && q) {
      body =
        q === "masters" ? masters
        : q === "professions" ? professions
        : q === "prof-categories" ? profCategories
        : q === "locations" ? locations
        : q === "countries" ? countries
        : q === "reviews" ? []
        : null;
    } else if (url.pathname === "/api/reference/professions") body = professions;
    else if (url.pathname === "/api/reference/prof-categories") body = profCategories;
    else if (url.pathname === "/api/reference/locations") body = locations;
    else if (url.pathname === "/api/reference/countries") body = countries;

    if (body === null) {
      res.statusCode = 404;
      res.end("[]");
      return;
    }
    res.end(JSON.stringify(body));
  });

  // Bind 127.0.0.1 explicitly so the Next dev server's SSR fetch (API_BASE
  // points at 127.0.0.1) reaches it — avoids the localhost IPv4/IPv6 mismatch.
  await new Promise<void>((resolve) => server!.listen(5001, "127.0.0.1", resolve));

  return async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
  };
}
