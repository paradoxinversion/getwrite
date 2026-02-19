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
