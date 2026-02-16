# Quickstart — UI dev environment (UI-only)

This quickstart bootstraps the UI developer environment for the `001-ui-getwrite-skeleton` feature. It assumes Node.js >=18 and npm or pnpm installed.

Stack (decided during planning):

- Next.js 16.1.6 + TypeScript 5.9.3
- TailwindCSS 4.1
- Storybook for component dev
- TinyMCE editor (integrated as a component)
- Testing: Testing Library + Vitest

Recommended local steps (example using npm):

1. Install dependencies:

```bash
npm install
```

2. Start the dev server:

```bash
npm run dev
```

3. Start Storybook for component development:

```bash
npm run storybook
```

4. Run unit + component tests (Vitest + Testing Library):

```bash
npm run test
```

Notes:

- For this milestone the repository may be scaffolded with a minimal Next.js app and a `components/` directory. The editor is integrated as a placeholder component; no content persistence is implemented.
- Use Storybook to iterate on components and obtain designer sign-off before wiring into pages.
