import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import useViewportTier, {
  tierForWidth,
  TABLET_MIN_WIDTH,
  DESKTOP_MIN_WIDTH,
} from "../../src/lib/hooks/useViewportTier";

describe("tierForWidth", () => {
  it("classifies widths below the tablet breakpoint as phone", () => {
    expect(tierForWidth(0)).toBe("phone");
    expect(tierForWidth(360)).toBe("phone");
    expect(tierForWidth(TABLET_MIN_WIDTH - 1)).toBe("phone");
  });

  it("classifies the tablet band inclusively at its lower bound", () => {
    expect(tierForWidth(TABLET_MIN_WIDTH)).toBe("tablet");
    expect(tierForWidth(900)).toBe("tablet");
    expect(tierForWidth(DESKTOP_MIN_WIDTH - 1)).toBe("tablet");
  });

  it("classifies the desktop breakpoint and above as desktop", () => {
    expect(tierForWidth(DESKTOP_MIN_WIDTH)).toBe("desktop");
    expect(tierForWidth(1440)).toBe("desktop");
  });
});

/**
 * Installs a controllable `matchMedia` stub keyed off a single current width,
 * returning a setter that re-evaluates every registered query listener.
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

describe("useViewportTier", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves the initial tier from matchMedia on mount", () => {
    installMatchMedia(375);
    const { result } = renderHook(() => useViewportTier());
    expect(result.current).toBe("phone");
  });

  it("updates when the viewport crosses breakpoints", () => {
    const setWidth = installMatchMedia(1280);
    const { result } = renderHook(() => useViewportTier());
    expect(result.current).toBe("desktop");

    setWidth(800);
    expect(result.current).toBe("tablet");

    setWidth(500);
    expect(result.current).toBe("phone");
  });
});
