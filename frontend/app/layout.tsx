import "./globals.css";
import "react-tooltip/dist/react-tooltip.css";
import type { Metadata, Viewport } from "next";
import React from "react";
import ClientProvider from "../src/store/ClientProvider";
import AppToaster from "../components/notifications/Toaster";
import AppearanceRuntime from "../components/preferences/AppearanceRuntime";
import NativeBootstrap from "../components/native/NativeBootstrap";

/** Page metadata for Next.js layout — basic title for dev/storybook. */
export const metadata: Metadata = { title: `GetWrite` };

/**
 * Viewport config. `width=device-width` is essential on phones/native WebView:
 * without it the page renders at a ~980px virtual width and is scaled down,
 * making the whole UI tiny and cramped. `initialScale: 1` starts unzoomed.
 * Deliberately no `maximumScale`/`userScalable: false` — writers need to be
 * able to pinch-zoom, and disabling it is an accessibility regression.
 */
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Application root layout wrapping `children` with global background and font color; imports global CSS. */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Domine:wght@400..700&display=swap"
        />
      </head>
      <body>
        <ClientProvider>
          {/* ADR-021 Phase 2 (FR6): binds the native StorageContext exactly
              once at hydration time on the native runtime; a no-op render
              (and its own effect is a no-op) on web/desktop. See
              components/native/NativeBootstrap.tsx's module doc. */}
          {process.env.NEXT_PUBLIC_GETWRITE_RUNTIME === "native" ? (
            <NativeBootstrap />
          ) : null}
          <AppearanceRuntime />
          <div className="min-h-screen bg-gw-chrome text-gw-primary">
            {children}
            <AppToaster />
          </div>
        </ClientProvider>
      </body>
    </html>
  );
}
