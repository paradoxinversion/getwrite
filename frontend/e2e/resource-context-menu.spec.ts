import { test, expect } from "@playwright/test";

test("resource context menu closes on outside click (storybook)", async ({
    page,
}) => {
    // navigate directly to the story iframe for the Interactive story
    await page.goto("/iframe.html?id=tree-resourcecontextmenu--interactive");

    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    const outside = page.locator('[data-testid="outside"]');
    await expect(outside).toBeVisible();

    // click outside and assert the menu is removed
    await outside.click();
    await expect(menu).toHaveCount(0);
});

test("resource context menu closes on Escape key", async ({ page }) => {
    await page.goto("/iframe.html?id=tree-resourcecontextmenu--interactive");
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    // Press Escape and expect the menu to be removed
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
});

test("keyboard navigation and activation fires action and closes", async ({
    page,
}) => {
    // listen for the next console event after activation

    await page.goto("/iframe.html?id=tree-resourcecontextmenu--interactive");
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    // Focus is given to first item; press ArrowDown until we reach Delete (4th item)
    // Items: Create, Copy, Duplicate, Delete, Export
    await page.keyboard.press("ArrowDown"); // to Copy
    await page.keyboard.press("ArrowDown"); // to Duplicate
    await page.keyboard.press("ArrowDown"); // to Delete

    // Activate with Enter and assert the story probe shows the action
    await page.keyboard.press("Enter");
    const lastAction = page.locator('[data-testid="last-action"]');
    await expect(lastAction).toHaveText(/delete/i);

    // menu should close after activation
    await expect(menu).toHaveCount(0);
});

test("clicking Delete button triggers action and closes (mouse)", async ({
    page,
}) => {
    await page.goto("/iframe.html?id=tree-resourcecontextmenu--interactive");
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    const deleteBtn = page.getByRole("menuitem", { name: "Delete" });
    await deleteBtn.click();
    const lastAction = page.locator('[data-testid="last-action"]');
    await expect(lastAction).toHaveText(/delete/i);

    await expect(menu).toHaveCount(0);
});

test("menu position reflects x/y args", async ({ page }) => {
    await page.goto("/iframe.html?id=tree-resourcecontextmenu--interactive");
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    const left = await menu.evaluate((el) => (el as HTMLElement).style.left);
    const top = await menu.evaluate((el) => (el as HTMLElement).style.top);
    expect(left).toMatch(/\d+px/);
    expect(top).toMatch(/\d+px/);
});
