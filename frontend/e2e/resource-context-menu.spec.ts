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
    const messages: string[] = [];
    page.on("console", (msg) => {
        // capture console messages emitted by the story's onAction handler
        try {
            messages.push(msg.text());
        } catch {}
    });

    await page.goto("/iframe.html?id=tree-resourcecontextmenu--interactive");
    const menu = page.locator('[role="menu"]');
    await expect(menu).toBeVisible();

    // Focus is given to first item; press ArrowDown until we reach Delete (4th item)
    // Items: Create, Copy, Duplicate, Delete, Export
    await page.keyboard.press("ArrowDown"); // to Copy
    await page.keyboard.press("ArrowDown"); // to Duplicate
    await page.keyboard.press("ArrowDown"); // to Delete

    // Activate with Enter
    await page.keyboard.press("Enter");

    // Wait for console message that contains 'action' and 'delete'
    await page
        .waitForFunction(() => {
            // @ts-ignore
            return (
                window.__playwright_console_messages &&
                window.__playwright_console_messages.length > 0
            );
        })
        .catch(() => {});

    // alternatively assert that an expected console text was captured
    const hasAction = messages.some(
        (m) => /action/.test(m) && /delete/i.test(m),
    );
    expect(hasAction).toBeTruthy();

    // menu should close after activation
    await expect(menu).toHaveCount(0);
});
