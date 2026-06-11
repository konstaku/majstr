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

test("the owner-verified master carries the badge and sorts first", async ({ page }) => {
  const firstCard = page.locator(".master-card").first();
  await expect(firstCard.locator(".master-card__name")).toHaveText("Іван Сантехнік");
  await expect(firstCard.locator(".master-card__badge--verified")).toBeVisible();
  // Unverified cards must not carry the badge.
  await expect(page.locator(".master-card__badge--verified")).toHaveCount(1);
});
