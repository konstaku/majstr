import { test, expect } from "@playwright/test";
import { stubApi } from "./stubApi";
import { masters } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
});

test("home renders the masters grid from the API", async ({ page }) => {
  const grid = page.locator(".masters-grid");
  await expect(grid).toBeVisible();
  await expect(page.locator(".master-card")).toHaveCount(masters.length);
});

test("master names and the result counter are shown", async ({ page }) => {
  await expect(page.locator(".master-card__name", { hasText: "Олена Швачка" })).toBeVisible();
  await expect(page.locator(".master-card__name", { hasText: "Іван Сантехнік" })).toBeVisible();
  await expect(page.locator(".found-amount")).toHaveText(String(masters.length));
});
