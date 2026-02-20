import { test, expect } from "@playwright/test";

test("data view shows resources and counts are correct", async ({ page }) => {
    await page.goto("/iframe.html?id=workarea-dataview--with-resources");

    const header = page.getByRole("heading", { name: /Data/i });
    await expect(header).toBeVisible();

    // list should contain 'Scene A' from placeholder resources
    const item = page.getByText("Scene A");
    await expect(item).toBeVisible();

    // resources card should show a numeric count in the sibling div
    const resourcesParent = page.getByText("Resources").locator("..");
    const resourcesCountEl = resourcesParent.locator("div").nth(1);
    await expect(resourcesCountEl).toBeVisible();
    const countText = await resourcesCountEl.textContent();
    expect(countText && /\d+/.test(countText)).toBeTruthy();
});

test("create project modal can be filled and submitted", async ({ page }) => {
    await page.goto("/iframe.html?id=start-createprojectmodal--open");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const name = page.getByLabel("Name");
    await expect(name).toBeVisible();
    await name.fill("E2E Project");

    const select = dialog.locator("select");
    await select.selectOption("short");

    const create = dialog.getByRole("button", { name: /create/i });
    await create.click();

    // the story exposes a hidden probe with the created payload
    const created = page.locator('[data-testid="created-payload"]');
    await expect(created).toHaveText(/E2E Project/);
});

test("edit view editor accepts input and updates word count", async ({
    page,
}) => {
    await page.goto("/iframe.html?id=workarea-editview--interactive");

    const editor = page.locator("#editview-editor");
    await expect(editor).toBeVisible();
    await editor.click();
    await page.keyboard.type(" Hello Playwright typed text.");

    const words = page.locator('div:has-text("Words:") strong');
    await expect(words).toHaveText(/\d+/);
    const countText = await words.textContent();
    const count = Number((countText || "").trim());
    expect(count).toBeGreaterThan(0);
});
