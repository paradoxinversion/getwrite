import { test, expect } from "@playwright/test";

test("revision control interactive renders revision list", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=editor-revisioncontrol-revisioncontrol--with-revisions",
  );

  const revisionCount = page.locator('[data-testid="revision-count"]');
  await expect(revisionCount).toHaveText("2");
});

test("revision control shows canonical revision probe", async ({ page }) => {
  await page.goto(
    "/iframe.html?id=editor-revisioncontrol-revisioncontrol--with-revisions",
  );

  const canonicalProbe = page.locator('[data-testid="canonical-revision"]');
  await expect(canonicalProbe).toHaveText("rev-2");
});

test("revision control allows revision selection and updates active state", async ({
  page,
}) => {
  await page.route("**/api/resource/revision/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ content: "Mock revision content" }),
    }),
  );

  await page.goto(
    "/iframe.html?id=editor-revisioncontrol-revisioncontrol--interactive",
  );

  // RevisionControl mounts collapsed — expand it first
  const expandBtn = page.getByRole("button", { name: /expand/i });
  await expect(expandBtn).toBeVisible();
  await expandBtn.click();

  // rev-1 is the non-canonical revision; its card has a "View Revision" button
  const viewBtn = page.getByRole("button", { name: /view revision/i });
  await expect(viewBtn).toBeVisible();
  await viewBtn.click();

  const activeProbe = page.locator('[data-testid="active-revision-id"]');
  await expect(activeProbe).toHaveText("rev-1", { timeout: 2000 });
});

/**
 * P1 guard: the "Save Explicit Revision" button was reported as unclickable at
 * narrower viewports — a click at its visual centre reached the canonical
 * revision card painted over it instead.
 *
 * Read this as a guard, not a reproduction. The overlap was measured in the
 * running app, where the panel sits inside the editor pane between two
 * sidebars; this story renders it full-bleed, and the two-column geometry here
 * is identical with and without the layout fix at every panel width tried
 * (400-760px, with the story root constrained). So this test would not have
 * caught the original defect. It is here to catch a future change that puts
 * something back on top of the button in a case Storybook *can* show.
 */
async function openRevisionPanel(
  page: import("@playwright/test").Page,
  panelWidth: number,
): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(
    "/iframe.html?id=editor-revisioncontrol-revisioncontrol--with-revisions",
  );
  // Constrained to approximate the editor pane's share of a 1280px window,
  // while keeping the viewport above `lg` so the two-column layout is active.
  await page.addStyleTag({
    content: `#storybook-root { width: ${panelWidth}px !important; max-width: ${panelWidth}px !important; }`,
  });
  await page.getByRole("button", { name: /expand/i }).click();
  // Save is disabled until the revision has a name, and a disabled button is
  // excluded from hit-testing — an unnamed revision would pass for the wrong
  // reason.
  await page.getByPlaceholder("Revision name").fill("Draft snapshot");
  await expect(page.getByRole("button", { name: /^save$/i })).toBeEnabled();
}

for (const panelWidth of [560, 760]) {
  test(`save-revision button is the topmost element at its own centre (${panelWidth}px panel)`, async ({
    page,
  }) => {
    await openRevisionPanel(page, panelWidth);

    const saveBtn = page.getByRole("button", { name: /^save$/i });
    const box = await saveBtn.boundingBox();
    expect(box).not.toBeNull();

    // Resolve the hit against *this* button, not "any button". Two traps here:
    // `elementFromPoint` returns null for a point outside the viewport, and
    // `null?.closest(...)` is `undefined` — so a `!== null` test passes
    // vacuously in precisely the case this is meant to catch. Comparing
    // against the button's own handle fails closed instead, and also rejects
    // an unrelated button painted over Save.
    const isButtonTopmost = await saveBtn.evaluate(
      (button, { x, y }) => {
        const hit = document.elementFromPoint(x, y);
        return hit !== null && hit.closest("button") === button;
      },
      { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 },
    );

    expect(isButtonTopmost).toBe(true);
  });
}
