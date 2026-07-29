import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ShellLayoutProvider,
  useShellLayout,
} from "../components/Layout/ShellLayoutController";

/**
 * Controllable `matchMedia` stub keyed off a single current width, returning a
 * setter that re-evaluates every registered `min-width` listener. Mirrors the
 * helper in `useViewportTier.test.tsx`.
 */
function installMatchMedia(initialWidth: number) {
  let width = initialWidth;
  const listeners: Array<() => void> = [];
  const parseMin = (query: string): number => {
    const match = query.match(/min-width:\s*(\d+)px/);
    return match ? Number(match[1]) : 0;
  };
  vi.stubGlobal(
    "matchMedia",
    (query: string) =>
      ({
        get matches() {
          return width >= parseMin(query);
        },
        media: query,
        addEventListener: (_: string, cb: () => void) => listeners.push(cb),
        removeEventListener: (_: string, cb: () => void) => {
          const i = listeners.indexOf(cb);
          if (i >= 0) listeners.splice(i, 1);
        },
      }) as unknown as MediaQueryList,
  );
  return (nextWidth: number) => {
    width = nextWidth;
    act(() => {
      listeners.forEach((cb) => cb());
    });
  };
}

describe("ShellLayoutProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens both sidebars by default on desktop", () => {
    installMatchMedia(1280);
    const { result } = renderHook(() => useShellLayout(), {
      wrapper: ShellLayoutProvider,
    });
    expect(result.current.tier).toBe("desktop");
    expect(result.current.leftOpen).toBe(true);
    expect(result.current.rightOpen).toBe(true);
  });

  it("docks the tree and closes metadata by default on tablet", () => {
    installMatchMedia(900);
    const { result } = renderHook(() => useShellLayout(), {
      wrapper: ShellLayoutProvider,
    });
    expect(result.current.tier).toBe("tablet");
    expect(result.current.leftOpen).toBe(true);
    expect(result.current.rightOpen).toBe(false);
  });

  it("starts with both drawers closed on phone", () => {
    installMatchMedia(375);
    const { result } = renderHook(() => useShellLayout(), {
      wrapper: ShellLayoutProvider,
    });
    expect(result.current.tier).toBe("phone");
    expect(result.current.leftOpen).toBe(false);
    expect(result.current.rightOpen).toBe(false);
  });

  it("enforces one drawer at a time on phone", () => {
    installMatchMedia(375);
    const { result } = renderHook(() => useShellLayout(), {
      wrapper: ShellLayoutProvider,
    });

    act(() => result.current.setLeftOpen(true));
    expect(result.current.leftOpen).toBe(true);
    expect(result.current.rightOpen).toBe(false);

    // Opening the right drawer closes the left one.
    act(() => result.current.setRightOpen(true));
    expect(result.current.rightOpen).toBe(true);
    expect(result.current.leftOpen).toBe(false);
  });

  it("allows both sidebars open together on desktop (no mutual exclusion)", () => {
    installMatchMedia(1280);
    const { result } = renderHook(() => useShellLayout(), {
      wrapper: ShellLayoutProvider,
    });
    act(() => result.current.setLeftOpen(true));
    act(() => result.current.setRightOpen(true));
    expect(result.current.leftOpen).toBe(true);
    expect(result.current.rightOpen).toBe(true);
  });

  it("reapplies tier defaults when crossing breakpoints", () => {
    const setWidth = installMatchMedia(1280);
    const { result } = renderHook(() => useShellLayout(), {
      wrapper: ShellLayoutProvider,
    });
    expect(result.current.rightOpen).toBe(true);

    setWidth(375);
    expect(result.current.tier).toBe("phone");
    expect(result.current.leftOpen).toBe(false);
    expect(result.current.rightOpen).toBe(false);
  });
});
