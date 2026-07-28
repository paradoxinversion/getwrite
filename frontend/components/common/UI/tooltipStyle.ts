import type { CSSProperties } from "react";

/**
 * Shared inline style for `react-tooltip` surfaces across the app, so every
 * tooltip reads with the same branded treatment: dark chrome background, a
 * hairline secondary border, and uppercase mono text.
 *
 * Pass to a `<Tooltip>`'s `style` prop, e.g.
 * `<Tooltip id={id} place="top" style={TOOLTIP_STYLE} />`.
 */
export const TOOLTIP_STYLE: CSSProperties = {
  background: "var(--color-gw-chrome2, #161614)",
  border: "0.5px solid var(--color-gw-secondary, #6A6864)",
  color: "var(--color-gw-primary, #F5F4F0)",
  fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)",
  fontSize: "9px",
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  borderRadius: "1px",
  padding: "4px 8px",
  // Bound the width so long tooltips (e.g. the disabled-Timeline explanation)
  // wrap instead of rendering as one line that overflows the viewport — on a
  // phone an unbounded tooltip pushed the page's horizontal scroll into a void.
  maxWidth: "min(260px, calc(100vw - 24px))",
  whiteSpace: "normal",
  // break-word (not anywhere): wrap between words normally and only break a
  // single word when it alone can't fit — avoids splitting ordinary words mid
  // character in short tooltips.
  overflowWrap: "break-word",
};
