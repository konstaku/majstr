import { test, expect } from "@playwright/test";
import { stubApi } from "./stubApi";
import { masters } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await stubApi(page);
  await page.goto("/");
  await expect(page.locator(".master-card")).toHaveCount(masters.length);
});

const citySelect = ".hero-filter-row .filter-toggle-wrap:nth-of-type(1) .majstr-select__control";
const tradeSelect = ".hero-filter-row .filter-toggle-wrap:nth-of-type(2) .majstr-select__control";

test("filtering by city narrows the grid", async ({ page }) => {
  await page.locator(citySelect).click();
  await page.locator(".majstr-select__option", { hasText: "Мілан" }).click();
  await page.locator(".filter-search-btn").click();

  // milan fixture masters: Олена (seamstress) + Петро (electrician)
  await expect(page.locator(".master-card")).toHaveCount(2);
  await expect(page.locator(".master-card__name", { hasText: "Іван Сантехнік" })).toHaveCount(0);
});

test("filtering by city + trade narrows to a single master", async ({ page }) => {
  await page.locator(citySelect).click();
  await page.locator(".majstr-select__option", { hasText: "Мілан" }).click();

  await page.locator(tradeSelect).click();
  await page.locator(".majstr-select__option", { hasText: "Будівництво" }).click();

  await page.locator(".filter-search-btn").click();

  await expect(page.locator(".master-card")).toHaveCount(1);
  await expect(page.locator(".master-card__name", { hasText: "Петро Електрик" })).toBeVisible();
});

test("clearing the trade filter brings all masters back", async ({ page }) => {
  await page.locator(tradeSelect).click();
  await page.locator(".majstr-select__option", { hasText: "Краса" }).click();
  await page.locator(".filter-search-btn").click();
  await expect(page.locator(".master-card")).toHaveCount(1); // only Олена

  // First option of the trade select = "all trades"
  await page.locator(tradeSelect).click();
  await page.locator(".majstr-select__option").first().click();
  await page.locator(".filter-search-btn").click();
  await expect(page.locator(".master-card")).toHaveCount(masters.length);
});
