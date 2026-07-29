"use client";

import { useEffect, useState } from "react";

/**
 * Responsive layout tier the app shell adapts to.
 *
 * - `phone`   — `< 768px`: single pane; both sidebars are mutually-exclusive
 *   overlay drawers.
 * - `tablet`  — `768px–1023px`: left resource tree docked; metadata is an
 *   overlay drawer.
 * - `desktop` — `>= 1024px`: the classic resizable three-pane layout.
 *
 * The `768`/`1024` thresholds match Tailwind's default `md`/`lg` breakpoints.
 */
export type ViewportTier = "phone" | "tablet" | "desktop";

/** Tailwind `md` breakpoint — phone/tablet boundary. */
export const TABLET_MIN_WIDTH = 768;
/** Tailwind `lg` breakpoint — tablet/desktop boundary. */
export const DESKTOP_MIN_WIDTH = 1024;

/**
 * Maps a viewport width (CSS px) to its {@link ViewportTier}. Pure and
 * exported so the boundary logic can be unit-tested without a DOM.
 *
 * @param width - Viewport width in CSS pixels.
 * @returns The tier the width falls into.
 */
export function tierForWidth(width: number): ViewportTier {
  if (width >= DESKTOP_MIN_WIDTH) return "desktop";
  if (width >= TABLET_MIN_WIDTH) return "tablet";
  return "phone";
}

/**
 * Reads the current viewport tier, kept in sync with viewport resizes via
 * `matchMedia`.
 *
 * SSR / static-export safety: the prerender has no `window`, so the hook
 * starts at `"desktop"` (the historical layout) and corrects to the real tier
 * in an effect on mount. Consumers that must avoid a first-paint flash should
 * pair this with a CSS-safe default (e.g. drawers rendered closed) — see
 * `AppShell`.
 *
 * @returns The active {@link ViewportTier}.
 */
export default function useViewportTier(): ViewportTier {
  const [tier, setTier] = useState<ViewportTier>("desktop");

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    )
      return;

    const tabletQuery = window.matchMedia(`(min-width: ${TABLET_MIN_WIDTH}px)`);
    const desktopQuery = window.matchMedia(
      `(min-width: ${DESKTOP_MIN_WIDTH}px)`,
    );

    const sync = () => {
      setTier(
        desktopQuery.matches
          ? "desktop"
          : tabletQuery.matches
            ? "tablet"
            : "phone",
      );
    };

    sync();
    tabletQuery.addEventListener("change", sync);
    desktopQuery.addEventListener("change", sync);

    return () => {
      tabletQuery.removeEventListener("change", sync);
      desktopQuery.removeEventListener("change", sync);
    };
  }, []);

  return tier;
}
