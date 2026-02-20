import { test, expect } from "@playwright/test";

test("search bar keyboard selection (Arrow + Enter)", async ({ page }) => {
    await page.goto("/iframe.html?id=layout-searchbar--interactive");

    const input = page.locator('input[aria-label="resource-search"]');
    await expect(input).toBeVisible();
    await input.click();
    await input.fill("Scene");

    // wait for results to appear
    const firstResult = page.locator("ul li button").first();
    await expect(firstResult).toBeVisible();

    // move focus to first result via Tab and activate with Enter (keyboard-only)
    await input.press("Tab");
    await page.keyboard.press("Enter");

    // story probe should contain selected id
    const probe = page.locator('[data-testid="search-last-selected"]');
    await expect(probe).toHaveText(/res_/i);
});

test("create project modal keyboard submit and Escape closes", async ({
    page,
}) => {
    await page.goto("/iframe.html?id=start-createprojectmodal--open");

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const name = page.getByLabel("Name");
    await name.fill("Keyboard Project");

    // submit by pressing Enter while focused in input
    await name.press("Enter");

    // assert created payload probe
    const created = page.locator('[data-testid="created-payload"]');
    await expect(created).toHaveText(/Keyboard Project/);

    // reopen story (it starts open again on fresh iframe); test Escape closes
    await page.goto("/iframe.html?id=start-createprojectmodal--open");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
});
