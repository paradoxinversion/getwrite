import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// React Compiler rules shipped with eslint-plugin-react-hooks@7 are enabled by
// eslint-config-next by default, but they only apply when the React Compiler is
// actually configured in next.config. This project does not use the compiler, so
// we disable them here to avoid false positives.
const REACT_COMPILER_RULES = {
  "react-hooks/static-components": "off",
  "react-hooks/use-memo": "off",
  "react-hooks/preserve-manual-memoization": "off",
  "react-hooks/incompatible-library": "off",
  "react-hooks/immutability": "off",
  "react-hooks/globals": "off",
  "react-hooks/refs": "off",
  "react-hooks/set-state-in-effect": "off",
  "react-hooks/error-boundaries": "off",
  "react-hooks/purity": "off",
  "react-hooks/set-state-in-render": "off",
  "react-hooks/unsupported-syntax": "off",
  "react-hooks/config": "off",
  "react-hooks/gating": "off",
};

// The naming-convention rule below uses a `types: ["boolean"]` selector to
// require an is/has/should/... prefix on booleans. That selector needs type
// information, so we enable type-aware linting via the TypeScript project
// service. Config/setup/script files that live outside tsconfig's program are
// parsed syntactically in a later override (see NON_PROJECT_FILES).
const TYPE_AWARE_LANGUAGE_OPTIONS = {
  parserOptions: {
    projectService: true,
    tsconfigRootDir: import.meta.dirname,
  },
};

// Files not covered by tsconfig.json's program: root config files, build
// scripts, and the .storybook setup (TypeScript's `**` include skips
// dot-directories). The type-aware parser can't resolve these, so we parse them
// without type info and disable the type-requiring naming rule for them.
const NON_PROJECT_FILES = ["**/*.mjs", "**/*.cjs", ".storybook/**/*.{ts,tsx}"];

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "storybook-static/**",
      "playwright-report/**",
      "stories/**",
      // ADR-021 Phase 2: build-native-static.mjs's generated shadow build
      // root and its static export output — neither is source, both are
      // gitignored, and the shadow root's own `.next/**` build artifacts
      // aren't valid lint targets.
      ".native-build/**",
      "out/**",
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    languageOptions: TYPE_AWARE_LANGUAGE_OPTIONS,
    rules: {
      ...REACT_COMPILER_RULES,
      // Naming conventions. Selectors are listed most-specific first.
      // Object/type *property* names are intentionally left unconstrained:
      // much of this codebase mirrors on-disk JSON shapes (metadata fields,
      // TipTap nodes, project-type specs) whose keys aren't camelCase.
      "@typescript-eslint/naming-convention": [
        "error",
        // Booleans must read as predicates (requires type info).
        {
          selector: "variable",
          types: ["boolean"],
          format: ["PascalCase"],
          prefix: ["is", "has", "should", "can", "did", "will"],
          leadingUnderscore: "allowSingleOrDouble",
        },
        // Variables: camelCase normally, UPPER_CASE for constants,
        // PascalCase for values holding components/factories.
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allowSingleOrDouble",
        },
        // Functions: camelCase, or PascalCase for component/factory functions.
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allowSingleOrDouble",
        },
        // Parameters: camelCase, with a leading underscore for unused args.
        {
          selector: "parameter",
          format: ["camelCase", "PascalCase"],
          leadingUnderscore: "allowSingleOrDouble",
        },
        // Interfaces: PascalCase, and never an `I`-prefix (IFoo -> Foo).
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: { regex: "^I[A-Z]", match: false },
        },
        // Classes, type aliases, enums, type parameters.
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        // Enum members.
        {
          selector: "enumMember",
          format: ["PascalCase"],
        },
      ],
      // Extensive pre-existing any usage; warn rather than error until
      // addressed systematically per docs/standards/typescript-implementation.md
      "@typescript-eslint/no-explicit-any": "warn",
      // Enforce path imports for lodash to avoid full-package bundle weight.
      // Use lodash/debounce, lodash/uniq, etc. — not import { x } from 'lodash'.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "lodash",
              message:
                "Use path imports instead (e.g. lodash/debounce, lodash/uniq).",
            },
          ],
        },
      ],
    },
  },
  {
    files: NON_PROJECT_FILES,
    languageOptions: {
      parserOptions: { projectService: false },
    },
    rules: {
      "@typescript-eslint/naming-convention": "off",
    },
  },
];

export default eslintConfig;
