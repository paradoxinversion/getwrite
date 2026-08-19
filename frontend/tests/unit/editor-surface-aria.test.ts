import { describe, it, expect } from "vitest";
import { EDITOR_SURFACE_ATTRIBUTES } from "../../components/TipTapEditor";

/**
 * The editing surface is the single most important control in the app, and it
 * was invisible to the accessibility tree: `.ProseMirror` is a bare
 * `contenteditable="true"` div, which carries no implicit role. Screen readers
 * could not announce it as an editable field, and role-based automation had to
 * fall back to a CSS selector.
 *
 * TipTap hands these attributes straight to the ProseMirror view, and the
 * component renders a simplified mock under test (so the real view never
 * mounts here) — asserting the contract is therefore asserting the rendered
 * attributes.
 */
describe("TipTap editing surface accessibility attributes", () => {
  it("exposes the editing surface as a multiline textbox", () => {
    expect(EDITOR_SURFACE_ATTRIBUTES.role).toBe("textbox");
    expect(EDITOR_SURFACE_ATTRIBUTES["aria-multiline"]).toBe("true");
  });

  it("gives the surface an accessible name", () => {
    // Without a name, a role-based query can find the field but nothing can
    // distinguish it from any other textbox on the page.
    expect(EDITOR_SURFACE_ATTRIBUTES["aria-label"]).toBeTruthy();
  });

  it("keeps the styling classes the editor layout depends on", () => {
    // The attributes object is also where the surface's sizing lives; adding
    // the role must not have displaced it.
    expect(EDITOR_SURFACE_ATTRIBUTES.class).toContain("h-full");
    expect(EDITOR_SURFACE_ATTRIBUTES.class).toContain("focus:outline-none");
  });
});
