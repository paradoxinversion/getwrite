"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import useViewportTier, {
  type ViewportTier,
} from "../../src/lib/hooks/useViewportTier";

/**
 * `useLayoutEffect` on the client, `useEffect` on the server. Lets the
 * tier-default correction run before the browser paints (avoiding a drawer
 * flash) without emitting the server-side `useLayoutEffect` warning during the
 * static-export prerender.
 */
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface ShellLayoutRenderState {
  /** Active responsive tier — drives docked-vs-drawer rendering in AppShell. */
  tier: ViewportTier;
  leftWidth: number;
  rightWidth: number;
  leftOpen: boolean;
  rightOpen: boolean;
  setLeftOpen: (open: boolean) => void;
  setRightOpen: (open: boolean) => void;
  startLeftResize: (event: React.MouseEvent<HTMLDivElement>) => void;
  startRightResize: (event: React.MouseEvent<HTMLDivElement>) => void;
}

const ShellLayoutContext = createContext<ShellLayoutRenderState | null>(null);

/**
 * Reads the shared shell-layout state (sidebar open/close, widths, resize
 * handlers, active viewport tier). Must be called under {@link ShellLayoutProvider}.
 */
export function useShellLayout(): ShellLayoutRenderState {
  const value = useContext(ShellLayoutContext);
  if (!value) {
    throw new Error("useShellLayout must be used within a ShellLayoutProvider");
  }
  return value;
}

const MIN_SIDEBAR_WIDTH = 160;
const COLLAPSE_THRESHOLD = 120;

/** Default open state for each tier — see ADR-021 Phase 3 mobile UX plan. */
function defaultsForTier(tier: ViewportTier): {
  left: boolean;
  right: boolean;
} {
  switch (tier) {
    case "desktop":
      return { left: true, right: true };
    case "tablet":
      // Left resource tree docked/open; metadata is an on-demand drawer.
      return { left: true, right: false };
    case "phone":
      // Single pane: both sidebars start closed and open as overlay drawers.
      return { left: false, right: false };
  }
}

export interface ShellLayoutProviderProps {
  children: React.ReactNode;
}

/**
 * Owns the shell's layout state and shares it via context so both the top bar
 * (`ShellSettingsMenu`) and the body (`AppShell`) can drive the sidebars.
 *
 * Responsive behavior (ADR-021 Phase 3):
 * - Applies tier-appropriate open defaults whenever the tier changes.
 * - Enforces one-drawer-at-a-time on phones: opening one sidebar closes the
 *   other. Enforced in the setters so every caller (top bar, close buttons,
 *   scrim) benefits.
 *
 * The desktop drag-to-resize / drag-to-collapse behavior is unchanged from the
 * previous render-prop controller.
 */
export function ShellLayoutProvider({
  children,
}: ShellLayoutProviderProps): JSX.Element {
  const tier = useViewportTier();

  const [leftWidth, setLeftWidth] = useState<number>(280);
  const [rightWidth, setRightWidth] = useState<number>(320);
  // Initial open state mirrors the SSR/static-export default tier ("desktop")
  // so hydration matches; the tier effect below corrects it after mount.
  const [isLeftOpen, setLeftOpenRaw] = useState<boolean>(true);
  const [isRightOpen, setRightOpenRaw] = useState<boolean>(true);

  // Read the live tier inside stable callbacks without re-creating them.
  const tierRef = useRef<ViewportTier>(tier);
  tierRef.current = tier;

  // Reapply tier defaults only when the tier actually changes (not on every
  // render), so user toggles within a tier are preserved. Runs as a layout
  // effect so the corrected open-state is committed before paint — otherwise a
  // mobile cold-load (tier flips desktop→phone/tablet after mount, while the
  // open-state is still the desktop default `true`) would paint one frame with
  // the overlay drawer(s) sliding open before this closes them.
  const prevTierRef = useRef<ViewportTier>(tier);
  useIsomorphicLayoutEffect(() => {
    if (prevTierRef.current === tier) return;
    prevTierRef.current = tier;
    const next = defaultsForTier(tier);
    setLeftOpenRaw(next.left);
    setRightOpenRaw(next.right);
  }, [tier]);

  const setLeftOpen = useCallback((open: boolean) => {
    setLeftOpenRaw(open);
    // One drawer at a time on phones.
    if (open && tierRef.current === "phone") setRightOpenRaw(false);
  }, []);

  const setRightOpen = useCallback((open: boolean) => {
    setRightOpenRaw(open);
    if (open && tierRef.current === "phone") setLeftOpenRaw(false);
  }, []);

  const draggingRef = useRef<null | {
    side: "left" | "right";
    startX: number;
    startWidth: number;
  }>(null);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const dragState = draggingRef.current;
      if (!dragState) {
        return;
      }

      const deltaX = event.clientX - dragState.startX;
      const maxWidth = 800;

      if (dragState.side === "left") {
        const next = dragState.startWidth + deltaX;
        if (next < COLLAPSE_THRESHOLD) {
          setLeftOpenRaw(false);
        } else {
          setLeftOpenRaw(true);
          setLeftWidth(Math.min(maxWidth, Math.max(MIN_SIDEBAR_WIDTH, next)));
        }
      } else {
        const next = dragState.startWidth - deltaX;
        if (next < COLLAPSE_THRESHOLD) {
          setRightOpenRaw(false);
        } else {
          setRightOpenRaw(true);
          setRightWidth(Math.min(maxWidth, Math.max(MIN_SIDEBAR_WIDTH, next)));
        }
      }

      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
    };

    const onMouseUp = () => {
      draggingRef.current = null;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, []);

  const startLeftResize = (event: React.MouseEvent<HTMLDivElement>): void => {
    draggingRef.current = {
      side: "left",
      startX: event.clientX,
      startWidth: leftWidth,
    };
  };

  const startRightResize = (event: React.MouseEvent<HTMLDivElement>): void => {
    draggingRef.current = {
      side: "right",
      startX: event.clientX,
      startWidth: rightWidth,
    };
  };

  const value: ShellLayoutRenderState = {
    tier,
    leftWidth,
    rightWidth,
    leftOpen: isLeftOpen,
    rightOpen: isRightOpen,
    setLeftOpen,
    setRightOpen,
    startLeftResize,
    startRightResize,
  };

  return (
    <ShellLayoutContext.Provider value={value}>
      {children}
    </ShellLayoutContext.Provider>
  );
}

export interface ShellLayoutControllerProps {
  children: (state: ShellLayoutRenderState) => React.ReactNode;
}

/**
 * Thin render-prop bridge over {@link useShellLayout}, kept so `AppShell`'s
 * large body JSX can continue to consume `layout` unchanged.
 */
export default function ShellLayoutController({
  children,
}: ShellLayoutControllerProps): JSX.Element {
  const layout = useShellLayout();
  return <>{children(layout)}</>;
}
