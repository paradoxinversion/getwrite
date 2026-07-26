import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, "package.json"), "utf8"),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // The app doesn't use next/image, so disable image optimization. This stops
  // Next from ever loading the native `sharp` binary at runtime — it's required
  // only lazily by the image optimizer, which is now never invoked. That matters
  // for the x64 desktop build: the standalone bundle still carries a single
  // arch-specific sharp binary (darwin-arm64, since it's built on Apple Silicon),
  // and disabling optimization guarantees that wrong-arch binary is never loaded
  // on Intel. (Next pulls sharp into its global server trace regardless of config,
  // so it can't be excluded from the bundle here — but it's now dead, unused weight.)
  images: { unoptimized: true },
  // Inlined into the client bundle at build time so the UI can display the
  // running version. Desktop and web builds share this synced version number.
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // ADR-021 Phase 0: search-transport.ts dynamically imports
  // native-search-backend.ts only when NEXT_PUBLIC_GETWRITE_RUNTIME ===
  // "native" (never true for hosted/desktop builds), but that guard is a
  // runtime env comparison, not a compile-time literal Turbopack can prove
  // false before resolving the import() target. Turbopack still traces (and
  // fails on) the real module's transitive node:fs/node:path/node:async_hooks
  // imports in the client/SSR chunking context regardless of reachability.
  // This alias substitutes a node:*-free stub with the same export shape at
  // the exact specifier the dynamic import uses, so the real native backend
  // never enters the web/desktop build's module graph — restoring the
  // dynamic-import discipline the transport-collapse spike established.
  // Tests and `tsc` are unaffected: this is a Turbopack-only resolution
  // rule, not a TypeScript path mapping.
  turbopack: {
    resolveAlias: {
      "./native-search-backend": "./src/store/transport/native-search-backend.web-stub",
      // revision-transport-service.ts lives in src/store/ (not
      // src/store/transport/, unlike search-transport.ts), so its dynamic
      // import's literal specifier is "./transport/native-revision-backend"
      // — the alias key below must match that exact request string.
      "./transport/native-revision-backend":
        "./src/store/transport/native-revision-backend.web-stub",
      // query-transport-service.ts lives in src/store/ as well, so its
      // dynamic import's literal specifier is
      // "./transport/native-query-backend" — same rule as above.
      "./transport/native-query-backend":
        "./src/store/transport/native-query-backend.web-stub",
    },
  },
};

export default nextConfig;
