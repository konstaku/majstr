import type { Page } from "@playwright/test";
import { masters, professions, profCategories, locations, countries } from "./fixtures";

const API_ORIGIN = "http://localhost:5001";

// Intercepts every request to the API origin and answers from fixtures.
// The legacy /?q= dispatcher mirrors backend/routes/public.js.
export async function stubApi(page: Page): Promise<void> {
  // Pin the UI language: the fixtures' option labels and the un-transliterated
  // master names are asserted in Ukrainian (context.getInitialLang reads this).
  await page.addInitScript(() => localStorage.setItem("lang", "uk"));
  await page.route(
    (url) => url.origin === API_ORIGIN,
    async (route) => {
      const url = new URL(route.request().url());

      if (url.pathname === "/" && url.searchParams.has("q")) {
        const q = url.searchParams.get("q");
        const body =
          q === "masters"
            ? masters
            : q === "professions"
              ? professions
              : q === "prof-categories"
                ? profCategories
                : q === "locations"
                  ? locations
                  : q === "countries"
                    ? countries
                    : q === "reviews"
                      ? []
                      : null;
        if (body !== null) return route.fulfill({ json: body });
        return route.fulfill({ status: 404, body: "No such file!" });
      }

      // Auth probe and any owned-cards/claims lookups answer like a real
      // logged-out session; the smoke tests must not assert on those flows.
      return route.fulfill({ status: 401, json: { error: "no_token" } });
    }
  );
}
