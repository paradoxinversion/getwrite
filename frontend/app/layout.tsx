import "./globals.css";
import React from "react";

/** Page metadata for Next.js layout — basic title for dev/storybook. */
export const metadata = {
    title: "GetWrite — UI (placeholder)",
};

/** Application root layout wrapping `children` with global background and font color; imports global CSS. */
export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body>
                <div className="min-h-screen bg-gray-50 text-slate-900">
                    {children}
                </div>
            </body>
        </html>
    );
}
