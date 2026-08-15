import { test as setup, expect } from "@playwright/test";

const adminEmail = "admin@rejoy.local";
const adminPassword = "admin123";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Login" }).click();
  await page.getByPlaceholder("Email").fill(adminEmail);
  await page.getByPlaceholder("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("button", { name: "Logout" })).toBeVisible({ timeout: 10000 });
  await page.context().storageState({ path: "playwright/.auth/admin.json" });
});
