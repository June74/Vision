import { expect, test } from "@playwright/test";

test("shows the Vision setup shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vision" })).toBeVisible();
  await expect(page.getByLabel("Setup signal")).toBeVisible();
});
