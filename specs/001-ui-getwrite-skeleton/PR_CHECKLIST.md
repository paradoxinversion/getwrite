# Demo branch PR checklist — GetWrite UI skeleton

Use this checklist when opening the demo/feature PR for the `001-ui-getwrite-skeleton` branch.

- [ ] PR title follows: `feat(ui): scaffold GetWrite UI skeleton (#ISSUE)`
- [ ] Description includes summary, scope, and screenshots (see DRAFT_PR.md)
- [ ] Storybook: built and static export included in the repo or accessible link
- [ ] Unit tests: `pnpm test` passes locally and CI reports green
- [ ] Storybook tests: `pnpm run test-storybook` passes locally
- [ ] E2E tests: Playwright artifacts present and passing (`frontend/playwright-report/`)
- [ ] Accessibility: basic a11y checks run (Storybook addon / axe) and issues documented
- [ ] Visual: screenshots for key views attached under `specs/001-ui-getwrite-skeleton/screenshots/`
- [ ] Design sign-off: designer review / approval noted in PR comments
- [ ] Reviewer checklist: tag reviewers and include testing steps
- [ ] CI: confirm pipeline includes tests and Playwright artifact upload

Notes:

- If Storybook is not hosted, reviewers can open the local static build at `frontend/storybook-static/index.html`.
- Attach Playwright trace/video/screenshot artifacts to the PR if CI doesn't surface them automatically.
