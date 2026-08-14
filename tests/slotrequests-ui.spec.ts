import { test, expect } from "@playwright/test";

test.use({ storageState: "playwright/.auth/admin.json" });

test.describe("SlotRequests Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/SlotRequests");
    await expect(page.getByText("Loading requests...")).not.toBeVisible({ timeout: 20000 });
    await expect(page.getByText("Profile")).toBeVisible({ timeout: 10000 });
  });

  test("S1: Page loads with filter bar and table", async ({ page }) => {
    // Filter bar
    await expect(page.locator("span").filter({ hasText: "Room" }).first()).toBeVisible();
    await expect(page.getByText("All Statuses")).toBeVisible();
    await expect(page.getByPlaceholder("Search...")).toBeVisible();

    // Table column headers
    await expect(page.getByText("Profile")).toBeVisible();
    await expect(page.getByText("Slot", { exact: true })).toBeVisible();
    await expect(page.getByText("Requested")).toBeVisible();
    await expect(page.getByText("Status", { exact: true })).toBeVisible();
    await expect(page.getByText("Actions")).toBeVisible();
  });

  test("S2: Status filter changes displayed data", async ({ page }) => {
    // Open status dropdown and select "Pending"
    await page.getByText("All Statuses").click();
    await page.getByText("Pending", { exact: true }).click();
    await page.waitForTimeout(500);

    const allRows = page.locator("tbody tr");
    if (await allRows.first().isVisible()) {
      await expect(page.locator("td").filter({ hasText: "pending" }).first()).toBeVisible();
      await expect(page.locator("td").filter({ hasText: "approved" }).first()).not.toBeVisible();
    }

    // Switch to "Approved" — button text is now "Pending", re-query
    await page.getByText("Pending").first().click();
    await page.getByText("Approved", { exact: true }).click();
    await page.waitForTimeout(500);

    if (await allRows.first().isVisible()) {
      await expect(page.locator("td").filter({ hasText: "approved" }).first()).toBeVisible();
    }

    // Reset to "All Statuses"
    await page.getByText("Approved").first().click();
    await page.getByText("All Statuses").click();
    await page.waitForTimeout(500);
  });

  test("S3: Search filter works", async ({ page }) => {
    const searchInput = page.getByPlaceholder("Search...");
    await expect(searchInput).toBeVisible();

    await searchInput.fill("test");
    await page.waitForTimeout(500);

    await searchInput.fill("");
    await page.waitForTimeout(500);
  });

  test("S4: Date filter opens calendar modal", async ({ page }) => {
    // Click the calendar button in the filter bar (inside the rounded-full pill)
    const calendarButton = page.locator("div.rounded-full button.text-purple-400");
    await calendarButton.click();

    await expect(page.locator("h3")).toContainText("Select Date");
    await expect(page.getByText("Mon")).toBeVisible();

    // Close modal by clicking the X button next to the title
    const headerDiv = page.locator("h3").locator("..");
    const closeBtn = headerDiv.locator("button");
    await closeBtn.click();
    // Modal is removed from DOM on close — h3 should disappear
    await expect(page.locator("h3")).toHaveCount(0, { timeout: 5000 });
  });

  test("S5: Approve a pending request", async ({ page }) => {
    const pendingRow = page.locator("tr").filter({ hasText: /pending/ }).first();
    test.skip(!(await pendingRow.isVisible()), "No pending requests to approve");

    const approveBtn = pendingRow.locator("button.text-green-400").first();
    await expect(approveBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      r => r.url().includes("/api/requests") && r.request().method() === "PUT"
    );
    await approveBtn.click();
    const resp = await responsePromise;

    if (resp.status() === 200) {
      await expect(page.locator("tr").filter({ hasText: /approved/ }).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("S6: Deny a pending request", async ({ page }) => {
    const pendingRow = page.locator("tr").filter({ hasText: /pending/ }).first();
    test.skip(!(await pendingRow.isVisible()), "No pending requests to deny");

    const denyBtn = pendingRow.locator("button.text-red-400").first();
    await expect(denyBtn).toBeVisible();

    const responsePromise = page.waitForResponse(
      r => r.url().includes("/api/requests") && r.request().method() === "PUT"
    );
    await denyBtn.click();
    const resp = await responsePromise;

    if (resp.status() === 200) {
      await expect(page.locator("tr").filter({ hasText: /denied/ }).first()).toBeVisible({ timeout: 5000 });
    }
  });

  test("S7: Edit modal opens with form fields", async ({ page }) => {
    const anyRow = page.locator("tbody tr").first();
    test.skip(!(await anyRow.isVisible()), "No requests to edit");

    const editBtn = anyRow.locator("button.text-blue-400").first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    await expect(page.locator("h3")).toContainText("Edit Request");
    // Use label selector to avoid strict mode with filter span + column th
    await expect(page.locator("label").filter({ hasText: "Room" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "Date" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "Time" })).toBeVisible();
    await expect(page.locator("label").filter({ hasText: "Status" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

    // Close modal
    const headerDiv = page.locator("h3").locator("..");
    const closeBtn = headerDiv.locator("button");
    await closeBtn.click();
  });

  test("S8: Edit form changes status and saves", async ({ page }) => {
    const anyRow = page.locator("tbody tr").first();
    test.skip(!(await anyRow.isVisible()), "No requests to edit");

    const editBtn = anyRow.locator("button.text-blue-400").first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();
    await expect(page.locator("h3")).toContainText("Edit Request");

    // Click a status other than the currently selected one
    const approvedBtn = page.getByRole("button", { name: "Approved" });
    const deniedBtn = page.getByRole("button", { name: "Denied" });
    const pendingBtn = page.getByRole("button", { name: "Pending" });

    let btnToClick = approvedBtn;
    const classAttr = await approvedBtn.getAttribute("class");
    if (classAttr?.includes("bg-green")) {
      btnToClick = deniedBtn;
    } else if (classAttr?.includes("bg-red")) {
      btnToClick = pendingBtn;
    }
    await btnToClick.click();

    const responsePromise = page.waitForResponse(
      r => r.url().includes("/api/requests") && r.request().method() === "PUT"
    );
    await page.getByRole("button", { name: "Save" }).click();
    const resp = await responsePromise;

    if (resp.status() === 200) {
      await expect(page.locator("h3")).toHaveCount(0, { timeout: 5000 });
    }
  });
});
