<!--
Sync Impact Report

- Version change: 0.1.0 → 0.2.1
- Modified principles (expanded for web-first):
  - Code Quality & Maintainability (no change in intent, added web-specific guidance)
  - Testing Standards → added API contract, browser compatibility and load testing
  - User Experience Consistency → added responsive, accessibility, cross-browser guidance
  - Performance & Resource Constraints → added server-side, scalability, caching guidance
  - MVP Simplicity → clarified web-MVP expectations and incremental deployment
- Added/updated sections: Development Workflow (CI/CD, staging, deployments), Additional Constraints
- Removed sections: none
- Templates reviewed (web impact):
  - .specify/templates/plan-template.md — ⚠ pending: update recommended to include web
    deployment checklist (envs, migrations, rollback plan)
  - .specify/templates/spec-template.md — ⚠ pending: add web-specific non-functional reqs
  - .specify/templates/tasks-template.md — ⚠ pending: add tasks for deployment, infra, load tests
  - .specify/templates/commands/* — ⚠ directory not present; review if added
- Follow-up TODOs:
  - TODO(RATIFICATION_STAKEHOLDERS): confirm ratification stakeholders and deployment owners
  - TODO(TEMPLATES): update spec/plan/tasks templates with web deployment/gov checks
-->

# getwrite Constitution

## Core Principles

### Code Quality & Maintainability

All production code MUST be readable, well-structured, and documented. Language-idiomatic style
and automated format/linter rules MUST be enforced (e.g., formatter + linter in CI). Public APIs
and internal module boundaries MUST have clear contracts and lightweight documentation. Rationale:
high maintainability reduces long-term cost and speeds iteration.

### Testing Standards (Non‑Negotiable Where Practical)

Testing is a first-class requirement. For all new features the team MUST define automated tests
that validate behavior at three levels: unit, integration/contract, and end-to-end for user journeys.
Tests MUST be written as part of the implementation cycle (TDD encouraged): tests written → tests
fail → implementation → tests pass. Test coverage targets are set per-feature in specs but core
libraries SHOULD aim for high unit coverage. Rationale: reliable change, safer refactors.

### User Experience Consistency

User-facing interactions MUST follow a consistent UX pattern defined for the project: predictable
flows, clear error messages, and accessible defaults. For the web-first product the UX MUST be
responsive across common viewport sizes, support assistive technologies (WCAG considerations),
and preserve predictable navigation and affordances across browsers and devices. Error states
MUST surface actionable guidance and server/client error boundaries MUST be clearly documented.
Rationale: consistent, accessible UX reduces user confusion and support overhead.

### Performance & Resource Constraints

Performance goals MUST be explicit in each feature spec (e.g., p95 latency, throughput, memory
budget). For a web app these goals MUST include server-side metrics (p95, p99 latency, requests/s),
concurrency and cost expectations. Non-functional requirements MUST call out caching strategy,
CDN use, rate limiting, and acceptable scalability targets. Performance regressions on critical
paths are blocked by CI benchmarks, load tests, or automated performance checks. Rationale:
web performance and scalability directly affect user experience and operating cost.

### MVP Simplicity & Incremental Design

The team MUST prioritize delivering a minimal, usable web MVP that supports the core user
journeys. Features SHOULD be sliced into independent user stories that can be delivered,
validated, and deployed independently. Architectural complexity (multi-tenant databases,
distributed caches, multi-region deployments) MUST be deferred until justified by measurable
demand. For the MVP, pre-production/staging environments are OUT OF SCOPE: teams MAY rely on
local validation and smoke tests. The MVP MUST store user data on the user's local system
(file-based or embedded storage) to preserve single-user, offline-capable operation. The MVP
SHOULD still have basic automation for linting and tests; full deployment pipelines and staging
environments are required only when moving beyond MVP. The MVP MUST include a simple,
documented deployment and rollback approach suitable for single-user/local hosting. Rationale:
reduce time-to-value while enabling safe, repeatable deployments when needed.

## Additional Constraints

- Target platforms: web application (server + browser) is the product direction. The project
  MUST define supported browser versions and server environments (cloud/self-hosted) in each
  plan. Mobile web / responsive behavior is required where applicable.
- Data persistence (MVP): for the MVP data MUST be stored on the user's local system (file-based
  or embedded storage) to preserve single-user, offline-capable operation. Migration paths from
  local storage to server-backed storage MUST be documented for future multi-user deployments.
- Data persistence (post-MVP): when moving beyond MVP, server-backed storage becomes the default
  and data migration, retention, backups, and rollback plans MUST be documented and tested.
- Security & Privacy: TLS for all network traffic in any hosted deployments, secure session
  handling, CSRF and XSS mitigation, input validation, and least-privilege principles for
  services. Authentication, authorization, and user data privacy MUST be specified in feature
  specs. Compliance requirements (e.g., applicable data residency or privacy laws) MUST be called
  out when relevant.
- Observability: services MUST emit structured logs, traces, and metrics where applicable. A
  minimal monitoring and alerting plan (health checks, SLOs/SLA targets for critical services)
  is required for hosted production deployments; these are OPTIONAL for the MVP when the app is
  single-user and locally hosted.

## Development Workflow

- Branching: feature branches per user story; merge to `main` via PR with at least one approving
  reviewer for non-trivial changes. Releases MUST be cut from `main` or release branches per the
  project's release policy.
- Environments & CI/CD: the project MUST maintain at minimum three environments: `dev` (iterative),
- Environments & CI/CD: for the MVP, pre-production/staging environments are OUT OF SCOPE. CI
  pipelines MUST run linting and unit tests at minimum. For post-MVP hosted deployments the
  project SHOULD maintain `dev`, `staging`, and `prod` environments; CI pipelines MUST run API
  contract tests, security scans, and automated smoke tests for release pipelines.
- Deployment & Runbooks: each production service MUST have a runbook describing deployment steps,
  health checks, common failure modes, and rollback instructions. Operational owners and on-call
  responsibilities SHOULD be documented for team members deploying to production.
- Reviews: code reviews MUST verify tests, style, infra changes, and adherence to constitution
  principles. PRs that change infra or deployment behavior MUST include a deployment checklist.

## Governance

Amendments: changes to this constitution MUST be proposed as a spec and reviewed in a PR. A
PATCH bump is for wording/clarifications; a MINOR bump is for added principles or materially
expanded guidance (this change → 0.1.0 → 0.2.1); a MAJOR bump is for removals or incompatible
redefinitions. All amendments MUST include a migration/compatibility plan if they affect templates,
CI gates, or deployment automation.

Compliance: project templates and feature specs MUST reference the constitution checks. The
Contributing/README guidance SHOULD point to this file for governance, release, and acceptance
criteria.

**Version**: 0.2.1 | **Ratified**: 2026-02-15 | **Last Amended**: 2026-02-15
