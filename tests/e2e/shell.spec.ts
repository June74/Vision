import { expect, test } from "@playwright/test";

test("shows the Vision foundation shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vision" })).toBeVisible();
  await expect(page.getByText("Foundation status")).toBeVisible();
});
