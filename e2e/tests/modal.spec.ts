import { test, expect } from "@playwright/test";
import { stubApi } from "./stubApi";

test.beforeEach(async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await expect(page.locator(".master-card").first()).toBeVisible();
});

test("clicking a card opens the master modal with details", async ({ page }) => {
  await page.locator(".master-card", { hasText: "Олена Швачка" }).click();

  await expect(page.locator(".modal-master__close")).toBeVisible();
  // The about text renders only inside the modal, never on the card.
  await expect(page.getByText("Шию та ремонтую одяг у Мілані.")).toBeVisible();
});

test("the modal closes again", async ({ page }) => {
  await page.locator(".master-card").first().click();
  const close = page.locator(".modal-master__close");
  await expect(close).toBeVisible();

  await close.click();
  await expect(close).toHaveCount(0);
});
