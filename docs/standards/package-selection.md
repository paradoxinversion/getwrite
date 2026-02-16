# Package Selection Standard

This document applies when selecting, adding, or referencing third-party packages.

It applies only during implementation or dependency-related tasks.

---

## 1. No Fabricated Packages

- Do not invent package names.
- Do not reference unofficial forks unless explicitly instructed.
- Use well-established, actively maintained packages.
- If uncertain whether a package exists, ask for clarification.

---

## 2. Existing Dependencies First

Before suggesting a new package:

- Check if the repository already includes a suitable dependency.
- Prefer extending existing dependencies over adding new ones.
- Do not duplicate functionality already covered by current packages.

---

## 3. Version Discipline

When suggesting a package version:

- Prefer the latest stable version.
- Avoid pre-release or beta versions unless explicitly requested.
- Ensure compatibility with:
    - Existing project dependencies
    - Declared runtime environment
    - TypeScript version (if applicable)

Do not guess version numbers if the project already defines them.

If compatibility is unclear, ask before proceeding.

---

## 4. Minimal Dependency Principle

- Do not introduce a dependency for trivial functionality.
- Prefer native platform capabilities when reasonable.
- Avoid large frameworks for narrow use cases.

---

## 5. No Implicit Upgrades

- Do not upgrade existing dependencies unless explicitly requested.
- Do not modify lockfiles or workspace configuration without instruction.
- Do not change peer dependency ranges without approval.

---

## 6. Justification Requirement

When proposing a new dependency:

- Briefly state its purpose.
- Explain why it is necessary.
- Confirm that no existing dependency satisfies the need.

---

## 7. Registry Verification Rule

Before finalizing a new dependency or version:

- Verify that the package exists in the official registry.
- Verify that the proposed version exists and is stable.
- Confirm the latest stable version unless the project requires a specific range.

If registry verification cannot be performed:

- State that the version is unverified.
- Ask the user to confirm the version before proceeding.

Do not guess exact minor or patch versions.

If the repository already defines a version:

- Use the declared version exactly.
- Do not modify version ranges without instruction.

---

## 8. Peer Dependency Compatibility Rule

When selecting or upgrading a package in ecosystems with peer dependencies
(e.g., React, Next.js, Vite, TypeScript plugins):

### 1. Check Peer Requirements

Before finalizing a dependency:

- Identify its declared peer dependencies.
- Confirm compatibility with:
    - React version
    - Next.js version
    - Vite version
    - TypeScript version
    - Node runtime version

Do not assume compatibility across major versions.

---

### 2. Respect Framework Authority

If the project uses a framework (e.g., Next.js):

- Treat the framework’s recommended dependency versions as authoritative.
- Do not upgrade React, TypeScript, or core build tools independently.
- Do not mix framework-major versions.

---

### 3. No Silent Major Upgrades

Do not:

- Introduce a dependency that forces a major upgrade of React, Next, or Vite.
- Propose a package version incompatible with the current framework major.
- Suggest ecosystem upgrades unless explicitly requested.

If compatibility requires a framework upgrade:

- Pause and inform the user.
- Do not proceed automatically.

---

### 4. TypeScript Alignment

When working in TypeScript projects:

- Ensure the dependency provides type definitions.
- Prefer packages with bundled types over DefinitelyTyped if available.
- Do not introduce types that require a higher TS version than currently installed.

If the TypeScript version is unknown, ask before assuming.

---

### 5. Vite Plugin Compatibility

When suggesting Vite plugins:

- Confirm compatibility with the current Vite major.
- Avoid plugins marked as legacy or unmaintained.
- Do not mix incompatible Vite plugin ecosystems.

---

If peer compatibility cannot be verified:

- State that compatibility is unverified.
- Ask for confirmation before finalizing the dependency.

---

End of Package Selection Standard.
