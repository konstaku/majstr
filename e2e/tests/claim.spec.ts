import { test, expect, type Page } from "@playwright/test";
import { professions, profCategories, locations } from "./fixtures";

// End-to-end of the share-to-claim loop, fully stubbed (no backend). The claim
// screens are Telegram-Mini-App gated (isTMA() reads window.Telegram.WebApp.
// initData), so we inject a minimal Telegram bridge before the app boots.

const API_ORIGIN = "http://localhost:5001";
const MASTER_ID = "684700000000000000000abc";

const ownedMaster = {
  _id: MASTER_ID,
  name: "Іван Сантехнік",
  status: "approved",
  professionID: "plumber", // category derivable → profession picker enabled
  locationID: "milan",
  about: "Лагоджу труби у Мілані та околицях.",
  contacts: [{ contactType: "phone", value: "+39 333 1234567" }],
  photo: null,
  tags: { ua: [], en: [] },
  languages: ["uk"],
  availability: "available",
};

// Pretend we're inside Telegram: isTMA() only needs a non-empty initData; the
// SDK init path is fully guarded, so no-op ready/expand are enough. index.html
// loads the real telegram-web-app.js (which would install an EMPTY initData on
// the web), so we intercept that exact script and install our bridge in its
// place — same load order, so nothing overwrites it.
async function fakeTelegram(page: Page) {
  await page.addInitScript(() => localStorage.setItem("lang", "uk"));
  await page.route(/telegram-web-app\.js/, (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: `window.Telegram = { WebApp: {
        initData: "user=%7B%22id%22%3A1%7D&auth_date=1&hash=deadbeef",
        initDataUnsafe: { user: { id: 1, language_code: "uk" } },
        ready() {}, expand() {}, onEvent() {}, offEvent() {}, close() {}
      } };`,
    })
  );
}

// One dispatcher for every API call. `claimResponse` lets each test choose how
// the server answers POST /api/claims.
async function stubClaimApi(
  page: Page,
  claimResponse: { status: number; json: Record<string, unknown> }
) {
  await page.route(
    (url) => url.origin === API_ORIGIN,
    async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();

      if (url.pathname === "/api/claims" && method === "POST") {
        return route.fulfill(claimResponse);
      }
      if (url.pathname === "/api/masters/mine") {
        return route.fulfill({ json: { masters: [ownedMaster] } });
      }
      if (url.pathname === "/api/reference/professions") return route.fulfill({ json: professions });
      if (url.pathname === "/api/reference/prof-categories") return route.fulfill({ json: profCategories });
      if (url.pathname === "/api/reference/locations") return route.fulfill({ json: locations });

      // Anything else (auth probes, etc.) behaves like a logged-out session.
      return route.fulfill({ status: 401, json: { error: "no_token" } });
    }
  );
}

test("claim → success → manage card → open the profession picker", async ({ page }) => {
  await fakeTelegram(page);
  await stubClaimApi(page, { status: 201, json: { autoApproved: true } });

  await page.goto(`/claim/${MASTER_ID}`);

  // Auto-approved claim lands on the success screen.
  await expect(page.getByText("Картка тепер ваша")).toBeVisible();

  // Continue into card management.
  await page.getByRole("button", { name: "Редагувати картку" }).click();
  await expect(page).toHaveURL(/\/my-cards$/);
  await expect(page.getByText("Мої картки")).toBeVisible();

  // Open the edit form, then the profession picker. This is the path that used
  // to crash into the error page (PickerSheet → useOnbT without its provider).
  await page.getByRole("button", { name: "Редагувати" }).click();
  await page.getByRole("button", { name: /Сантехнік/ }).click();

  await expect(page.locator(".picker-sheet")).toBeVisible();
  await expect(page.getByText("Електрик")).toBeVisible(); // sibling profession listed
  await expect(page.getByText(/Щось пішло не так/)).toHaveCount(0);
});

test("re-opening an already-owned claim link routes to card management", async ({ page }) => {
  await fakeTelegram(page);
  // The card already has this owner → backend answers already_owner; the client
  // must route to /my-cards, not show the "вже має власника" dead-end.
  await stubClaimApi(page, { status: 409, json: { error: "already_owner" } });

  await page.goto(`/claim/${MASTER_ID}`);

  await expect(page).toHaveURL(/\/my-cards$/);
  await expect(page.getByText("Мої картки")).toBeVisible();
  await expect(page.getByText(/вже має власника/)).toHaveCount(0);
});
