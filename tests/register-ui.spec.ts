import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright/.auth/admin.json" });

test.describe("Register Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Register");
    // Use heading role to avoid strict-mode clash with "No users found" cell text
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 10000 });
  });

  test("R1: Page loads with tables and controls", async ({ page }) => {
    // Section headings
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Profiles" })).toBeVisible();

    // Add buttons
    await expect(page.getByRole("button", { name: "Add User" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add Profile" })).toBeVisible();

    // Both tables rendered
    await expect(page.locator("table").first()).toBeVisible();
    await expect(page.locator("table").nth(1)).toBeVisible();
  });

  test("R2: Add Profile modal opens and closes", async ({ page }) => {
    await page.getByRole("button", { name: "Add Profile" }).click();
    await expect(page.getByText("Register Profile")).toBeVisible();
    await expect(page.getByPlaceholder("Profile Name")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

    // Close via the modal X button
    const modalHeader = page.getByText("Register Profile").locator("..");
    await modalHeader.locator("button").click();
    await expect(page.getByText("Register Profile")).not.toBeVisible();
  });

  test("R3: ColorPicker hex input updates the colour", async ({ page }) => {
    const testHex = "#ff8800";

    await page.getByRole("button", { name: "Add Profile" }).click();
    await expect(page.getByText("Register Profile")).toBeVisible();

    // Open the ColorPicker — target the button to avoid table-column matches
    await page.locator("button").filter({ hasText: "#ffffff" }).click();

    // Type a hex value into the input
    const hexInput = page.locator("input[maxlength='7']");
    await hexInput.fill(testHex);
    await hexInput.blur();

    // Close the ColorPicker dropdown by clicking the modal title
    await page.getByText("Register Profile").click();
    await page.waitForTimeout(300);

    // The ColorPicker trigger button should show the new colour
    await expect(page.locator("button").filter({ hasText: testHex })).toBeVisible();
  });

  test("R4: Add User modal with BandMultiSelect", async ({ page }) => {
    await page.getByRole("button", { name: "Add User" }).click();
    await expect(page.getByText("Register User")).toBeVisible();

    // Form fields
    await expect(page.getByPlaceholder("Name")).toBeVisible();
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toHaveCount(0);
    await expect(page.getByText("Select profiles")).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

    // Open BandMultiSelect dropdown
    await page.getByText("Select profiles").click();
    const bandOptions = page.locator("li");
    const count = await bandOptions.count();
    if (count > 0) {
      await bandOptions.first().click();
      await expect(page.getByText("Select profiles")).not.toBeVisible();
    }

    // Close modal
    const modalHeader = page.getByText("Register User").locator("..");
    await modalHeader.locator("button").click();
    await expect(page.getByText("Register User")).not.toBeVisible();
  });

  test("R5: Create and delete a profile (full cycle)", async ({ page }) => {
    const ts = Date.now();
    const uniqueName = `[TEST] Profile ${ts}`;

    // Get initial band IDs via API
    const beforeRes = await page.request.get("/api/bands");
    const beforeIds = new Set(((await beforeRes.json()) as { id: string }[]).map(b => b.id));

    // Open Add Profile modal
    await page.getByRole("button", { name: "Add Profile" }).click();
    await expect(page.getByText("Register Profile")).toBeVisible();

    // Fill in name
    await page.getByPlaceholder("Profile Name").fill(uniqueName);

    // Open ColorPicker (target button to avoid table-column matches)
    await page.locator("button").filter({ hasText: "#ffffff" }).click();

    // Set colour via hex input
    const hexInput = page.locator("input[maxlength='7']");
    await hexInput.fill("#00cc88");
    await hexInput.blur();
    // Close the ColorPicker dropdown
    await page.getByText("Register Profile").click();
    await page.waitForTimeout(300);

    // Click Save
    await page.getByRole("button", { name: "Save" }).click();
    await page.waitForTimeout(1500);

    // Verify the new band exists via API
    const afterRes = await page.request.get("/api/bands");
    const afterBands = (await afterRes.json()) as { id: string; name: string }[];
    const createdBand = afterBands.find(b => !beforeIds.has(b.id));
    expect(createdBand).toBeTruthy();
    expect(createdBand!.name).toBe(uniqueName);

    // Find the row by unique name and click delete
    const profilesTable = page.locator("table").nth(1);
    const row = profilesTable.locator("tr").filter({ hasText: uniqueName });
    await expect(row).toBeVisible();
    await row.locator("button.text-gray-400").click();
    await page.waitForTimeout(500);

    // Confirm delete
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForTimeout(1500);

    // Verify the band was deleted
    const finalBands = (await (await page.request.get("/api/bands")).json()) as { id: string }[];
    expect(finalBands.find(b => b.id === createdBand!.id)).toBeFalsy();
  });

  test("R6: Create and delete a user (full cycle)", async ({ page }) => {
    // Need at least one band for the user form
    const bandsRes = await page.request.get("/api/bands");
    const bands = await bandsRes.json();
    test.skip(bands.length === 0, "No bands available — cannot create user without band selection");

    const ts = Date.now();
    const uniqueEmail = `testuser-${ts}@test.com`;

    // Get initial user IDs via API
    const beforeRes = await page.request.get("/api/users");
    const beforeIds = new Set(((await beforeRes.json()) as { id: string }[]).map(u => u.id));

    // Open Add User modal
    await page.getByRole("button", { name: "Add User" }).click();
    await expect(page.getByText("Register User")).toBeVisible();

    // Fill form fields
    await page.getByPlaceholder("Name").fill(`Test User ${ts}`);
    await page.getByPlaceholder("Email").fill(uniqueEmail);
    await expect(page.getByPlaceholder("Password")).toHaveCount(0);

    // Select the first band in BandMultiSelect
    await page.getByText("Select profiles").click();
    await page.locator("li").first().click();

    // Close the BandMultiSelect dropdown before clicking Save
    await page.getByText("Register User").click();
    await page.waitForTimeout(300);

    // Click Save
    await page.getByRole("button", { name: "Save" }).click();

    // Wait for modal to close (indicates success)
    await expect(page.getByText("Register User")).not.toBeVisible({ timeout: 10000 });

    // Verify the new user exists via API
    const afterRes = await page.request.get("/api/users");
    const afterUsers = (await afterRes.json()) as { id: string; email: string }[];
    const createdUser = afterUsers.find(u => !beforeIds.has(u.id));
    expect(createdUser).toBeTruthy();
    expect(createdUser!.email).toBe(uniqueEmail);

    // Find the row by email and click delete
    const usersTable = page.locator("table").first();
    const row = usersTable.locator("tr").filter({ hasText: uniqueEmail });
    await expect(row).toBeVisible();
    await row.locator("button.text-gray-400").click();
    await page.waitForTimeout(500);

    // Confirm delete
    await page.getByRole("button", { name: "Delete" }).click();
    await page.waitForTimeout(1500);

    // Verify the user was deleted
    const finalUsers = (await (await page.request.get("/api/users")).json()) as { id: string }[];
    expect(finalUsers.find(u => u.id === createdUser!.id)).toBeFalsy();
  });
});
