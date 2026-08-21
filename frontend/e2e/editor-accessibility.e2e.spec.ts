import { test, expect } from "@playwright/test";
import { editorBodyByRole, waitForEditorReady } from "./helpers/editor";

const INTERACTIVE_STORY = "/iframe.html?id=workarea-editview--interactive";

/**
 * P3: `.ProseMirror` is a bare `contenteditable="true"` div, which carries no
 * implicit role — the app's primary editing surface did not appear in the
 * accessibility tree at all. Assistive technology could not announce it as an
 * editable field, and accessibility-tree-driven automation (including the QA
 * harness) had to fall back to the `.ProseMirror` CSS selector because there
 * was no role to query by.
 *
 * These assert against the accessibility tree specifically (`getByRole`), not
 * the DOM attribute — querying the attribute would pass even if the role were
 * somehow not exposed to AT.
 */
test.describe("editing surface accessibility", () => {
  test("the editor is discoverable as a textbox by role", async ({ page }) => {
    await page.goto(INTERACTIVE_STORY);
    await waitForEditorReady(page);

    const editor = editorBodyByRole(page);
    await expect(editor).toBeVisible();

    // Resolving by role must land on the ProseMirror surface itself, not some
    // other textbox that happens to be on the page.
    await expect(editor).toHaveClass(/ProseMirror/);
  });

  test("the editor is announced as multiline and has an accessible name", async ({
    page,
  }) => {
    await page.goto(INTERACTIVE_STORY);
    await waitForEditorReady(page);

    const editor = editorBodyByRole(page);
    await expect(editor).toHaveAttribute("aria-multiline", "true");

    const name = await editor.evaluate((el) => el.getAttribute("aria-label"));
    expect(name).toBeTruthy();
  });

  test("text typed into the role-resolved surface commits", async ({
    page,
  }) => {
    // A role that resolves but does not accept input would be worse than no
    // role: it would send AT and automation to the wrong element.
    await page.goto(INTERACTIVE_STORY);
    await waitForEditorReady(page);

    const editor = editorBodyByRole(page);
    await editor.click();
    await page.keyboard.type("Reachable by role");

    await expect(editor).toContainText("Reachable by role");
  });
});
