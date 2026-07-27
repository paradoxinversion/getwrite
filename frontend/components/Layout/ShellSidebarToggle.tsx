"use client";

import { PanelLeft, PanelRight } from "lucide-react";
import Button from "../common/UI/Button/Button";
import { useShellLayout } from "./ShellLayoutController";

export interface ShellSidebarToggleProps {
  /** Which sidebar this button toggles. */
  side: "left" | "right";
}

/**
 * Top-bar toggle for a sidebar on the mobile tiers, where the sidebars are
 * overlay drawers rather than docked panes.
 *
 * Visibility is CSS-driven (`md:hidden` / `lg:hidden`) so the correct buttons
 * paint immediately at any width — before JS resolves the tier — matching the
 * docked-vs-drawer rendering in `AppShell`:
 * - left (resources): shown below `md` (phone), where the tree is a drawer.
 * - right (metadata): shown below `lg` (phone + tablet), where metadata is a
 *   drawer.
 *
 * Must render under {@link ShellLayoutProvider}.
 */
export default function ShellSidebarToggle({
  side,
}: ShellSidebarToggleProps): JSX.Element {
  const layout = useShellLayout();

  if (side === "left") {
    return (
      <Button
        variant="icon"
        className="md:hidden"
        aria-label={
          layout.leftOpen ? "Close resource sidebar" : "Open resource sidebar"
        }
        aria-expanded={layout.leftOpen}
        title="Resources"
        onClick={() => layout.setLeftOpen(!layout.leftOpen)}
      >
        <PanelLeft size={18} aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button
      variant="icon"
      className="lg:hidden"
      aria-label={
        layout.rightOpen ? "Close metadata sidebar" : "Open metadata sidebar"
      }
      aria-expanded={layout.rightOpen}
      title="Metadata"
      onClick={() => layout.setRightOpen(!layout.rightOpen)}
    >
      <PanelRight size={18} aria-hidden="true" />
    </Button>
  );
}
