import { test, expect } from "@playwright/test";
import { stubApi } from "./stubApi";
import { masters } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await expect(page.locator(".master-card")).toHaveCount(masters.length);
});

// web/spa uses a custom SelectField (not react-select): `.sf-field` is the
// trigger, `.sf-opt` are the options (portaled to <body>).
const citySelect = ".hero-filter-row .filter-toggle-wrap:nth-of-type(1) .sf-field";
const tradeSelect = ".hero-filter-row .filter-toggle-wrap:nth-of-type(2) .sf-field";

test("filtering by city narrows the grid", async ({ page }) => {
  await page.locator(citySelect).click();
  await page.locator(".sf-opt", { hasText: "Мілан" }).click();
  await page.locator(".filter-search-btn").click();

  // milan fixture masters: Олена (seamstress) + Петро (electrician)
  await expect(page.locator(".master-card")).toHaveCount(2);
  await expect(page.locator(".master-card__name", { hasText: "Іван Сантехнік" })).toHaveCount(0);
});

test("filtering by city + trade narrows to a single master", async ({ page }) => {
  await page.locator(citySelect).click();
  await page.locator(".sf-opt", { hasText: "Мілан" }).click();

  await page.locator(tradeSelect).click();
  await page.locator(".sf-opt", { hasText: "Будівництво" }).click();

  await page.locator(".filter-search-btn").click();

  await expect(page.locator(".master-card")).toHaveCount(1);
  await expect(page.locator(".master-card__name", { hasText: "Петро Електрик" })).toBeVisible();
});

// TODO(web): rework for web/spa's URL-driven filtering. In the Vite SPA the
// filter was pure client state; in web/ the search button navigates to
// /{lang}/{city}/{category} routes, so "clear the trade and bring everyone
// back" is a route change, not an in-place state reset — the all-trades reset
// path needs re-expressing against the new navigation model.
test.skip("clearing the trade filter brings all masters back", async ({ page }) => {
  await page.locator(tradeSelect).click();
  await page.locator(".sf-opt", { hasText: "Краса" }).click();
  await page.locator(".filter-search-btn").click();
  await expect(page.locator(".master-card")).toHaveCount(1); // only Олена

  // First option of the trade select = "all trades"
  await page.locator(tradeSelect).click();
  await page.locator(".sf-opt").first().click();
  await page.locator(".filter-search-btn").click();
  await expect(page.locator(".master-card")).toHaveCount(masters.length);
});
