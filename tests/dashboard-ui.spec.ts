import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright/.auth/admin.json" });

test.describe("Dashboard Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/Dashboard");
    await expect(page.getByText("Slot Configuration")).toBeVisible({ timeout: 10000 });
  });

  test("D1: Page loads with table and controls", async ({ page }) => {
    // Table column headers via role to avoid strict-mode clashes with placeholders
    await expect(page.getByRole("columnheader", { name: "ID" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Start Time" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "End Time" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Actions" })).toBeVisible();

    // TimePicker placeholders (buttons containing "Start time" / "End time")
    await expect(page.locator("button").filter({ hasText: "Start time" })).toBeVisible();
    await expect(page.locator("button").filter({ hasText: "End time" })).toBeVisible();

    // Add Slot button
    await expect(page.getByRole("button", { name: "Add Slot" })).toBeVisible();
  });

  test("D2: Start time picker opens and selects a time", async ({ page }) => {
    await page.locator("button").filter({ hasText: "Start time" }).click();
    // Click the first option in the dropdown (<li>)
    await page.locator("li").first().click();
    // Picker button should now show the selected time ("6:00 AM" is the first option)
    await expect(page.locator("button").filter({ hasText: "6:00 AM" })).toBeVisible();
  });

  test("D3: End time picker opens and selects a time", async ({ page }) => {
    await page.locator("button").filter({ hasText: "End time" }).click();
    // Click the first option in the dropdown
    await page.locator("li").first().click();
    await expect(page.locator("button").filter({ hasText: "6:00 AM" })).toBeVisible();
  });

  test("D4: Add new slot config then delete it", async ({ page }) => {
    // Record current config IDs for reliable row identification
    const beforeRes = await page.request.get("/api/slotconfig");
    const beforeIds = new Set(((await beforeRes.json()) as { id: string }[]).map(c => c.id));

    const tbody = page.locator("table tbody tr");
    const initialCount = await tbody.count();

    // Open start time picker and select first option ("6:00 AM")
    await page.locator("button").filter({ hasText: "Start time" }).click();
    await page.locator("li").first().click();

    // Open end time picker and select second option ("6:30 AM")
    await page.locator("button").filter({ hasText: "End time" }).click();
    await page.locator("li").nth(1).click();

    // Click Add Slot
    await page.getByRole("button", { name: "Add Slot" }).click();
    await page.waitForTimeout(1500);

    // Verify a new row appeared
    expect(await tbody.count()).toBe(initialCount + 1);

    // Find the newly created config's UUID via API
    const afterRes = await page.request.get("/api/slotconfig");
    const afterConfigs = (await afterRes.json()) as { id: string }[];
    const created = afterConfigs.find(c => !beforeIds.has(c.id));
    expect(created).toBeTruthy();

    // Locate the row by its UUID and click the delete button
    const row = page.locator("tr").filter({ hasText: created!.id });
    const deleteBtn = row.locator("button.text-gray-400");
    await deleteBtn.click();
    await page.waitForTimeout(1500);

    // Row count should be back to initial
    expect(await tbody.count()).toBe(initialCount);
  });

  test("D5: Toggle enabled state on a config", async ({ page }) => {
    const tbody = page.locator("table tbody tr");
    const firstRow = tbody.first();

    test.skip(!(await firstRow.isVisible()), "No configs to toggle");

    // Read current status badge text
    const statusBadge = firstRow.locator("span.rounded-full");
    const currentStatus = await statusBadge.textContent();

    // Click the toggle button (FaTimes icon, text-red-400 class)
    const toggleBtn = firstRow.locator("button.text-red-400");
    await toggleBtn.click();
    await page.waitForTimeout(1000);

    // Status should have flipped
    const newStatus = await statusBadge.textContent();
    expect(newStatus).not.toBe(currentStatus);

    // Re-toggle to restore original
    await toggleBtn.click();
    await page.waitForTimeout(1000);
  });

  test("D6: Pagination works when many configs exist", async ({ page }) => {
    // Check total config count via API
    const res = await page.request.get("/api/slotconfig");
    const allConfigs = await res.json();

    test.skip(allConfigs.length <= 7, "Less than 8 configs — pagination not shown");

    const pagination = page.locator("div.mt-6.gap-2");
    const buttons = pagination.locator("button");
    const prevBtn = buttons.first();
    const nextBtn = buttons.last();

    // Navigate forward
    if (!(await nextBtn.isDisabled())) {
      await nextBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText("Slot Configuration")).toBeVisible();
    }

    // Navigate backward
    if (!(await prevBtn.isDisabled())) {
      await prevBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText("Slot Configuration")).toBeVisible();
    }
  });

  test("D7: Weekly Google Sheets settings card renders and skips export without credentials", async ({ page }) => {
    await expect(page.getByText("Weekly Google Sheets Grid")).toBeVisible();
    await expect(page.getByPlaceholder("Google Spreadsheet ID")).toBeVisible();
    await expect(page.getByPlaceholder("Tab prefix (optional, e.g. ACM Studio)")).toBeVisible();

    await page.getByRole("button", { name: "Run export now" }).click();
    await expect(
      page.getByText(/Skipped: (spreadsheet not configured|GOOGLE_SERVICE_ACCOUNT not configured)/),
    ).toBeVisible({ timeout: 10000 });
  });
});
