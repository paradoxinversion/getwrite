# Changelog

## [2.1.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v2.0.0...getwrite-v2.1.0) (2026-08-18)


### Features

* **task-13:** first live QA run — four items verified against real disk state ([3a99b13](https://github.com/saboteur-works/getwrite/commit/3a99b13b8a8a25333e45bc7d0f26728533624003))
* **task-1:** scaffold the qa CLI command group ([79a7dac](https://github.com/saboteur-works/getwrite/commit/79a7dacf71c2b2fe2852d4c75f638bb7a0eeb9b7))
* **task-2:** disposable QA workspace creation with containment guard ([979de8b](https://github.com/saboteur-works/getwrite/commit/979de8bfde0ca28fe188e2f80e61591fb9a90bee))
* **task-3:** spawn/stop QA dev server with pre-set GETWRITE_PROJECTS_DIR ([6b2dc78](https://github.com/saboteur-works/getwrite/commit/6b2dc78606c1da1a39dd3593c18987ddfccfa985))
* **task-4:** retain-on-failure-or-unverified workspace cleanup policy ([a264115](https://github.com/saboteur-works/getwrite/commit/a2641152b9988e6dea5dd1c1914ddccf9a82aba1))
* **task-5:** filesystem ground-truth verification module ([22475dd](https://github.com/saboteur-works/getwrite/commit/22475ddd88a9cc6993bb09d7c710b50e04bc0019))
* **task-6:** QA run report writer module ([1abf828](https://github.com/saboteur-works/getwrite/commit/1abf828a53fd6f891adaa70e534ee9179eef3a6e))
* **task-7:** hand-author the agentic QA feature inventory ([cf9edc2](https://github.com/saboteur-works/getwrite/commit/cf9edc2dff4e849745b3e0d41b956e1c61a528c9))
* **task-8:** write the QA agent operating procedure ([49e17ac](https://github.com/saboteur-works/getwrite/commit/49e17acaca98cec13470b5065d38bb67b1eab767))
* **task-9:** wire qa start/verify/report/finish subcommands ([8574fc1](https://github.com/saboteur-works/getwrite/commit/8574fc12387760d88fb9ca18568dcf73604d1f32))


### Bug Fixes

* **ci:** drop the Intel mac runner that never ran ([acd74bd](https://github.com/saboteur-works/getwrite/commit/acd74bd0eabf5416c6272bbd571d745ed63d2583))
* **ci:** drop the Intel mac runner that never ran ([0658785](https://github.com/saboteur-works/getwrite/commit/0658785cfe3155a6ec155357b87cfdb09015950b))
* **qa:** make FR-11 satisfiable — an unexercised item can no longer vanish ([63e42c0](https://github.com/saboteur-works/getwrite/commit/63e42c0d9a7643f914d113c6e708b37c3a0e500f))
* **qa:** make the run report describe the run it actually performed ([1ef122f](https://github.com/saboteur-works/getwrite/commit/1ef122f42eda2546e6acb2a3de509aba848f05b5))
* **qa:** stop the harness deadlocking, lying, and serving an unhydratable URL ([06e087f](https://github.com/saboteur-works/getwrite/commit/06e087f144a86ba0aa9acb7f7e787fed1bea9b7e))
* **task-10:** collapse server.test.ts to one real-server spawn ([415844e](https://github.com/saboteur-works/getwrite/commit/415844ecf8190f40c0eb0e2b7b733e8926acb8c8))
* **task-10:** disable cli vitest file parallelism ([895e910](https://github.com/saboteur-works/getwrite/commit/895e9102ab1a7a6116731d3884ca4de5b61f8615))

## [2.0.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v1.8.0...getwrite-v2.0.0) (2026-08-07)


### ⚠ BREAKING CHANGES

**Desktop projects move out of the application directory to `~/Documents/GetWrite`.**

Earlier desktop builds stored your projects *inside the application itself*. Installing a new version replaces the application — and deletes everything in it. **Back up your work before installing this release.** GetWrite cannot do it for you: the files are gone before the new version first runs.

**macOS** — copy this folder somewhere safe first:

```
/Applications/GetWrite.app/Contents/Resources/projects
```

Right-click GetWrite.app → *Show Package Contents* to get in. After installing 2.0.0, copy your project folders into `~/Documents/GetWrite`.

**Windows** — copy this folder somewhere safe first:

```
%LOCALAPPDATA%\Programs\GetWrite\resources\projects
```

After installing, copy your project folders into `Documents\GetWrite`.

**Linux** — nothing to back up. The AppImage runs from a read-only filesystem, so it could never create that folder and never saved anything. **This is the first build that can store your work at all.**

**If you use encryption**, copy `.getwrite-keyring.json` and `.getwrite-names` from that folder too. They sit alongside the project folders and are easy to miss because they are hidden. An encrypted project without its keyring cannot be recovered by anyone, including us.

### What else changed

You can now choose where GetWrite keeps your projects: **User Preferences → Where your projects are stored**. Changing it points GetWrite at the new folder and requires a restart; it does not move your existing projects, so move those yourself if you want them to come along.

### Features

* **desktop:** default projects to Documents, and let users move them ([42f448d](https://github.com/saboteur-works/getwrite/commit/42f448d13d6cc0ed553c5fa05b13e82107e57cca))


### Bug Fixes

* **desktop:** store projects outside the app bundle ([709cf6b](https://github.com/saboteur-works/getwrite/commit/709cf6b86cd3086be378915bf7e38486b273145a))
* **desktop:** store projects outside the app bundle, in Documents ([5a650a9](https://github.com/saboteur-works/getwrite/commit/5a650a94fe943dc8592d8d0aea55c7d55121aa5c))
* **desktop:** surface a projects-folder failure instead of hiding it ([47062a1](https://github.com/saboteur-works/getwrite/commit/47062a1f437d06d378728692ac7e1bf8bad01a6f))


### Documentation

* **desktop:** state what the migration cannot rescue ([98f2be1](https://github.com/saboteur-works/getwrite/commit/98f2be1d63c6fc5b5578ff726d10b6d5237a6ef7))

## [1.8.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v1.7.0...getwrite-v1.8.0) (2026-07-29)


### Features

* **mobile:** ADR-021 Phase 3 — mobile/phone UX (drawers, touch actions, responsive fixes) ([568a210](https://github.com/saboteur-works/getwrite/commit/568a2100d87568d4a0bad1b9a3c010fb8dd8466b))
* **mobile:** responsive phone/tablet shell — drawers, toggles, touch actions (ADR-021 P3) ([d3ca78f](https://github.com/saboteur-works/getwrite/commit/d3ca78f7ee5d18941068f1a660bf3a2a976ebf75))


### Bug Fixes

* **ci:** use `black` keyword instead of [#000](https://github.com/saboteur-works/getwrite/issues/000) in mask gradients ([ec3fa11](https://github.com/saboteur-works/getwrite/commit/ec3fa1198b48b4ead761280d6fcd0238303a45b8))
* **mobile:** address code-review findings on the P3 mobile-UX branch ([8c092bb](https://github.com/saboteur-works/getwrite/commit/8c092bbdcca92018060213c151431e12a7034815))
* **mobile:** make editor toolbar's horizontal scroll discoverable on phones ([8e230b3](https://github.com/saboteur-works/getwrite/commit/8e230b3192bcb2817db88d539c96c3bb97e96686))
* **mobile:** make the work-area view-switcher tabs scroll horizontally ([33e356c](https://github.com/saboteur-works/getwrite/commit/33e356c7a7c506d527fc53b3e8ecf5530fdb12c6))
* **mobile:** reflow QueryBuilder filter chips onto two lines on phones ([67cec35](https://github.com/saboteur-works/getwrite/commit/67cec353651b680898253e290d7b368b17aea6aa))
* **mobile:** scroll view-switcher on the Tabs root, not the inner list ([d380298](https://github.com/saboteur-works/getwrite/commit/d3802984924528b7dd3456baef4d6addccdcfe2f))
* **mobile:** stack StartPage library header and project-card footer on phones ([c2f7db5](https://github.com/saboteur-works/getwrite/commit/c2f7db5ba4e36c620ecd06d8ef1709e7840818c8))
* **mobile:** stop long tooltips overflowing the viewport into a scroll void ([fb6a841](https://github.com/saboteur-works/getwrite/commit/fb6a841d2c0808b454c41ee0ec40a8df037c4008))

## [1.7.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v1.6.0...getwrite-v1.7.0) (2026-07-27)


### Features

* **auth:** add hosted-auth live smoke harness + CLI migration config ([6a54829](https://github.com/saboteur-works/getwrite/commit/6a54829ce2482052af6a17e3df537c5b8c3cfc36))
* **auth:** drop the Name field from signup ([da61dcd](https://github.com/saboteur-works/getwrite/commit/da61dcd7d3e6197f083ad3755fdad837d48b466e))
* **native:** ADR-021 native-Android spikes (storage + transport collapse) ([21ebf44](https://github.com/saboteur-works/getwrite/commit/21ebf44de298fba72b6ecb0a576d3879600139fd))
* **native:** ADR-021 Phase 0 — native Android walking skeleton (code-complete) ([d0452da](https://github.com/saboteur-works/getwrite/commit/d0452da6ff47311715777039400b0fd4041746b9))
* **native:** ADR-021 Phase 1 — transport breadth (generalized in-process collapse) ([e23f6ae](https://github.com/saboteur-works/getwrite/commit/e23f6ae900adbf6a3543f292c0c303be33ee6eae))
* **native:** ADR-021 Phase 2 — full-app native integration (WebView shell + lib/api collapse) ([4210895](https://github.com/saboteur-works/getwrite/commit/421089573537a9f9d0f4d59b53f2f889c2e509c9))
* **native:** on-device harness loader bundle for Phase 0 Task 7 ([77fd2fe](https://github.com/saboteur-works/getwrite/commit/77fd2feb28ee3d2195a9996c2966b8690f547a3b))
* **task-1:** generalized createTransport helper; refactor search onto it ([1bc1cee](https://github.com/saboteur-works/getwrite/commit/1bc1ceec1a3d5d9a728a4410f31617bb40cae9f5))
* **task-1:** native-export build foundation (ADR-021 Phase 2) ([547450b](https://github.com/saboteur-works/getwrite/commit/547450b20e603a20effe9b61f6ae552f84ed7cda))
* **task-1:** scaffold getwrite-android sibling workspace package ([27d5551](https://github.com/saboteur-works/getwrite/commit/27d5551399e6cace6abb36bf10024d45a457e5f5))
* **task-2:** lift revision core; add native-revision-backend transport ([944700d](https://github.com/saboteur-works/getwrite/commit/944700d4029c0fb8d3f4b9fee3047806d7630efb))
* **task-2:** native transport for projects + project-actions-controller (ADR-021 Phase 2) ([61eb52b](https://github.com/saboteur-works/getwrite/commit/61eb52bb021024aeb60825708834e14e206b3060))
* **task-2:** real @capacitor/filesystem -&gt; CapacitorFilesystemLike bridge ([3fc4880](https://github.com/saboteur-works/getwrite/commit/3fc48800adde58c45338092b9cd080b60c7a506e))
* **task-3:** lift query core; add native-query-backend transport ([e56fe35](https://github.com/saboteur-works/getwrite/commit/e56fe351ce076e8c290d45fa90b8764e818eb92e))
* **task-3:** native transport for resources + resource-excerpts (ADR-021 Phase 2) ([d857006](https://github.com/saboteur-works/getwrite/commit/d8570063bd22b17e6c8c6bce1f49e91dbdbdf753))
* **task-3:** wire nativeFilesystem() to the real Capacitor bridge ([d40c44a](https://github.com/saboteur-works/getwrite/commit/d40c44aadffb07ee9c408a8be15958f8751bc081))
* **task-4:** app-lifetime StorageContext binding for native (FR4, FR5) ([33a11e7](https://github.com/saboteur-works/getwrite/commit/33a11e7ea25c2d113cea655c5d6d4b4bcfe610e0))
* **task-4:** lift metadata-schema core; add native-metadata-schema-backend ([1573289](https://github.com/saboteur-works/getwrite/commit/1573289b4eb19bf4a30e5fd7f1ed342a8f152c8a))
* **task-4:** native transport for tags + preferences + editor-config (ADR-021 Phase 2) ([ae993fa](https://github.com/saboteur-works/getwrite/commit/ae993fa00835eab2fabe77d50193ef4236e00ca2))
* **task-5:** add native-feature-config-backend transport ([fa6208a](https://github.com/saboteur-works/getwrite/commit/fa6208aeca6448829ce015de80934e5227bf7587))
* **task-5:** native transport for project-types + compile + export (ADR-021 Phase 2) ([a39bbb9](https://github.com/saboteur-works/getwrite/commit/a39bbb99dca45f534449406bee261f1568ff806a))
* **task-6:** extend on-device harness with image/audio media throughput checks (ADR-021 Phase 2) ([9197cc9](https://github.com/saboteur-works/getwrite/commit/9197cc9dd80299e1f9dee28fe00ef3460f9ff816))
* **task-6:** on-device verification + baseline-benchmark harness (FR6-FR8) ([8b73fcd](https://github.com/saboteur-works/getwrite/commit/8b73fcd3d336def7b33243d4d9be05ade624918b))
* **task-6:** wire auth-status and update-check through createTransport ([4a74fb8](https://github.com/saboteur-works/getwrite/commit/4a74fb8ecca8b1d78ce9c4eddef54f4d39aafc37))


### Bug Fixes

* **auth:** remediate FR26 review findings H1, H2, M1 ([b4df891](https://github.com/saboteur-works/getwrite/commit/b4df891ded50254dd5571732454b848481a98b51))
* **auth:** remediate FR26 review low-severity findings M2, L1, L2, L3 ([2e325e6](https://github.com/saboteur-works/getwrite/commit/2e325e6be420ac28fb38da0b735e287f4866afa1))
* **native:** build-time-exclude native transport subtree from web bundle (FR2) ([15c925e](https://github.com/saboteur-works/getwrite/commit/15c925e649e0d3a7f08632f24763823ccf5a3f0f))
* **native:** close the bootstrap-vs-first-fetch race with a ready-gate (Option A) ([4769064](https://github.com/saboteur-works/getwrite/commit/4769064162dacf8c63188ac3cb915de2fa0c9c57))
* **native:** collapse fetchRevisionList off raw fetch (the &lt;!DOCTYPE JSON error) ([bc24976](https://github.com/saboteur-works/getwrite/commit/bc249765d8df0ed53054694398431febf615e1f3))
* **native:** correct capacitorFsAdapter error handling surfaced by device gate ([8a28129](https://github.com/saboteur-works/getwrite/commit/8a281290f128c57fe9000f4ceef3d4bcc3c07544))
* **native:** generate frontend/getwrite-config link instead of tracking a git symlink ([347dc7f](https://github.com/saboteur-works/getwrite/commit/347dc7f718a0fba96b08096d19787361ee798f89))
* **native:** make the native export actually run its backends on-device ([c1cc0b5](https://github.com/saboteur-works/getwrite/commit/c1cc0b5e4c53ad0a5e286a3a956fab6701cd91c0))
* **native:** no-op fs.watch/existsSync so the backlinks watcher degrades gracefully ([7031d95](https://github.com/saboteur-works/getwrite/commit/7031d95c78f64d566fe8a5c84c84926f90017739))
* **native:** polyfill setImmediate/clearImmediate for the WebView ([e3af422](https://github.com/saboteur-works/getwrite/commit/e3af4223bfe51aaceda64e69c3f9146b55484c92))
* **native:** project list survives a bad manifest; harness stops polluting /projects ([77e1d19](https://github.com/saboteur-works/getwrite/commit/77e1d19dbe2d58abf71feeab86af196c99f6be56))
* **native:** resolve code-review correctness findings (1-5) ([74007ac](https://github.com/saboteur-works/getwrite/commit/74007ac9e7a3a6fef81d9c24b1af3d61dab1064d))
* **native:** static-import runtime resolver in the search transport seam ([2d8f8ae](https://github.com/saboteur-works/getwrite/commit/2d8f8ae0971554d5554798acf9a0ad14cc8df34c))

## [1.6.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v1.5.0...getwrite-v1.6.0) (2026-07-24)


### Features

* real authentication provider (better-auth + PostgreSQL) — Slice 6 ([855f57b](https://github.com/saboteur-works/getwrite/commit/855f57b64695f4498b583936f21e1fe0bc1f2dba))
* **task-1:** add better-auth/Postgres deps and server-only auth config seam ([4577052](https://github.com/saboteur-works/getwrite/commit/45770522b06f1f3cd97dd2e97c29f06f66596ef7))
* **task-2:** mount better-auth route handler and wire nodemailer SMTP transport ([c7aa0f4](https://github.com/saboteur-works/getwrite/commit/c7aa0f411a2933e87b1dd6045baf838dfc02b8fd))
* **task-3:** add better-auth identity source and async getUserId seam ([f8ef962](https://github.com/saboteur-works/getwrite/commit/f8ef9628507baec3d81f9fe49373687f8d1694c7))
* **task-4:** enforce 401/CSRF on tenant routes and add page-route login gate ([1141964](https://github.com/saboteur-works/getwrite/commit/1141964f58c6fbc5487cc4731ce320ca2260e222))
* **task-5:** gate hosted signup behind an env-configured email allowlist ([75fc13a](https://github.com/saboteur-works/getwrite/commit/75fc13a72e778a2a62d5bcf815b258dc20c6974a))
* **task-6:** add login/signup/verify/reset UI and logout affordances ([e1062cd](https://github.com/saboteur-works/getwrite/commit/e1062cd7e3c81a4991bd106325d952daec6fecba))

## [1.5.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v1.4.0...getwrite-v1.5.0) (2026-07-22)


### Features

* object-store storage backend (ADR-019) ([#158](https://github.com/saboteur-works/getwrite/issues/158)) ([f553583](https://github.com/saboteur-works/getwrite/commit/f553583c9b71691112fbae0c74b5d6095e444b90))

## [1.4.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v1.3.0...getwrite-v1.4.0) (2026-07-22)


### Features

* **io:** extend StorageAdapter with copyFile/cp/appendFile/readFileBuffer ([d2360c1](https://github.com/saboteur-works/getwrite/commit/d2360c11c8ce55523b291482a423ef57ac8fbb1c))
* **task-1:** add validateProjectId guard and respondInvalidProjectId helper ([1a74254](https://github.com/saboteur-works/getwrite/commit/1a742544aa74856df22a1d3c851dac6a8f1b6dde))
* **task-2:** migrate compile routes to tenant-scoped projectId ([ca256ed](https://github.com/saboteur-works/getwrite/commit/ca256ed06ca14c9e699a8efcc0ad82ff2c17f93c))
* **task-3:** migrate export routes to tenant-scoped projectId ([9e088e6](https://github.com/saboteur-works/getwrite/commit/9e088e63b1d5444abfc5ffc35892d05e61736f3e))
* **task-4:** migrate project-level routes to tenant-scoped projectId ([478913e](https://github.com/saboteur-works/getwrite/commit/478913ef023ceaeac23c6923aeebe1692b7179ce))
* **task-5:** migrate tags and query routes to tenant-scoped projectId ([182acdd](https://github.com/saboteur-works/getwrite/commit/182acdda23d6eb80d5158cb23fa19ec0a712498b))
* **task-6:** migrate project-resources routes to tenant-scoped projectId ([db13f8b](https://github.com/saboteur-works/getwrite/commit/db13f8b43aade56b7d524905c15dd5d2118a6995))
* **task-7:** migrate resource routes to tenant-scoped projectId ([ce1befe](https://github.com/saboteur-works/getwrite/commit/ce1befed4a6827658db9d5c82ded79493a6e67f1))
* **task-8:** add selectActiveProjectDirectoryId and migrate first client batch ([bbcbbe6](https://github.com/saboteur-works/getwrite/commit/bbcbbe67944ebaec8feabede525723cf33bb658d))
* **task-9:** migrate WorkArea components to tenant-scoped projectId ([4dfa6f2](https://github.com/saboteur-works/getwrite/commit/4dfa6f26d342c6fce7c1c869a9ae3ed1d1fe9278))
* tenant route enforcement (server-validated projectId) ([5e3c7bc](https://github.com/saboteur-works/getwrite/commit/5e3c7bc7ee9d0ce2b8a69700cc5e1885e6041d04))


### Bug Fixes

* repair media serving URLs under projectId hard cutover ([5919c0c](https://github.com/saboteur-works/getwrite/commit/5919c0caf59b0b25e58a5b0169fbe87f2c27b49f))
* **task-9b:** migrate revision transport to projectId contract ([079c5b9](https://github.com/saboteur-works/getwrite/commit/079c5b936c36b04bb03e7a280b4da53d51e23eaa))
* **task-9c:** migrate resource CRUD transport to projectId contract ([1167370](https://github.com/saboteur-works/getwrite/commit/1167370815dcc352842f554aabb327590712e63a))
* **task-9d:** migrate tags/editor-config/preferences/export/excerpts/ ([3071a0f](https://github.com/saboteur-works/getwrite/commit/3071a0fa6ccdd52b562b1d74f3c945b89d64a63c))
* **task-9e:** migrate remaining transport services, close FR12 landmine ([e978a64](https://github.com/saboteur-works/getwrite/commit/e978a641f964ded8bc60ea7b94c3b8bcb42d6a93))
* **task-9f:** migrate project-actions-controller to projectId contract ([37b8e4f](https://github.com/saboteur-works/getwrite/commit/37b8e4f57c5c295f0fc03ae6e97734494b6c690c))
* **task-9g:** migrate media file URL builders to projectId contract ([2163e79](https://github.com/saboteur-works/getwrite/commit/2163e796b975ff1bca84b1a1a0ce5bf14456194b))

## [1.3.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v1.2.0...getwrite-v1.3.0) (2026-07-15)


### Features

* request→tenant resolution (ADR-018, hosted multi-tenancy slice 2) ([b7ddf5b](https://github.com/saboteur-works/getwrite/commit/b7ddf5b3da842c366cf5787298f1519778c1ecd5))
* **task-1:** add pure tenant-path module with fail-closed userId/data-root guard ([968d487](https://github.com/saboteur-works/getwrite/commit/968d4877e0f6fbf49ca6b4c5e5665461170617b3))
* **task-2:** add IdentitySource interface and env-gated dev identity source ([5458a6c](https://github.com/saboteur-works/getwrite/commit/5458a6c1055ec16a22a5aabd48b838f9ddb4b2fd))
* **task-3:** add resolveTenant composition and provisioning ([f4762cd](https://github.com/saboteur-works/getwrite/commit/f4762cd24f7f0c86da874672d278001e35d136b1))
* **task-4:** wire resolveTenant into withStorageContext ([02db9b9](https://github.com/saboteur-works/getwrite/commit/02db9b911c78911fd6b1e2c0322ee3c1acc9b99c))


### Bug Fixes

* address code-review findings on tenant resolution ([7858ffa](https://github.com/saboteur-works/getwrite/commit/7858ffa6183566d6ddf2c85ccc13416f06311bf3))

## [1.2.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v1.1.0...getwrite-v1.2.0) (2026-07-10)


### Features

* request-scoped, tenant-aware storage (ADR-017 foundational slice) ([51dd5b3](https://github.com/saboteur-works/getwrite/commit/51dd5b361db9db82ebd90731b442a8b1cddea834))
* **task-1:** add AsyncLocalStorage-backed storage-context module ([a9416d3](https://github.com/saboteur-works/getwrite/commit/a9416d34297907cfaaf0123e1c39718b48b1aa0e))
* **task-2:** read projects dir from storage context in resolveProjectsDir ([b923f0b](https://github.com/saboteur-works/getwrite/commit/b923f0b685c3d5555f4bb6b3b8d82bebff3114c8))
* **task-3:** resolve io.ts adapter from ambient storage context ([12dba04](https://github.com/saboteur-works/getwrite/commit/12dba04121a4368c7be568aa7908dbcad840e757))
* **task-4:** add withStorageContext helper, wrap 4 tenant-resolving routes ([ed67026](https://github.com/saboteur-works/getwrite/commit/ed670261794ad3744695b87b8a50a5f08956a480))
* **task-5:** wrap CLI command bodies in runInStorageContext ([b1ddd3b](https://github.com/saboteur-works/getwrite/commit/b1ddd3b4d94769d95e894bb1c30cf8256785ee0f))
* **task-6:** wrap indexer-queue runTask and backlinks-watcher recompute ([21beb3f](https://github.com/saboteur-works/getwrite/commit/21beb3f71fff194dba04cffdb4cb938bfd9e5b1c))

## [1.1.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v1.0.0...getwrite-v1.1.0) (2026-07-08)


### Features

* align ProjectSettingsDialog with ProjectTypesManagerPage design language ([5450d0a](https://github.com/saboteur-works/getwrite/commit/5450d0a5ae094a38963b66e55c7daa42206d0840))
* consolidate project settings into one tabbed dialog ([bdd7664](https://github.com/saboteur-works/getwrite/commit/bdd76640663909a2a2fa0ad8ea04fc89ada99176))
* **task-1:** add forceMount to TabsContent for draft preservation ([39a0820](https://github.com/saboteur-works/getwrite/commit/39a08207445aa8ba195112f737f53ea84d678538))
* **task-2:** section components support single-title + save-without-close ([2f14a52](https://github.com/saboteur-works/getwrite/commit/2f14a524931f8ee5100bc040fdfc85a24074f7f0))
* **task-3:** add consolidated ProjectSettingsDialog component ([3c7b87a](https://github.com/saboteur-works/getwrite/commit/3c7b87ab59fc8339c194c3ebcf108e79bafa7b97))
* **task-4:** collapse ShellSettingsMenu's 5 settings items into one ([a7337c5](https://github.com/saboteur-works/getwrite/commit/a7337c53914eac60fb76b8ea17d3cf14a916f68f))
* **task-5:** rewire AppShell to a single project-settings state ([e6b3093](https://github.com/saboteur-works/getwrite/commit/e6b3093ff4e6ef5edc4b5d7c2eaa95ca15fe856a))
* **task-6:** render ProjectSettingsDialog from ShellModalCoordinator ([db6ac4d](https://github.com/saboteur-works/getwrite/commit/db6ac4db3ec2cd3ce6f0379826156df983158089))

## [1.0.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.54...getwrite-v1.0.0) (2026-06-18)


### Miscellaneous Chores

* cut GetWrite 1.0.0 ([#145](https://github.com/saboteur-works/getwrite/issues/145)) ([95fe63b](https://github.com/saboteur-works/getwrite/commit/95fe63b00386828d1d51bcbec36414ced8b6dad6))

## [0.2.54](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.53...getwrite-v0.2.54) (2026-06-17)


### Bug Fixes

* ensure compile/export output reflects latest content ([#140](https://github.com/saboteur-works/getwrite/issues/140)) ([4439652](https://github.com/saboteur-works/getwrite/commit/4439652870a064e3bf70bbccd4ce7abfa7d8ca8b))

## [0.2.53](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.52...getwrite-v0.2.53) (2026-06-17)


### Features

* Markdown support (serializer, editor source toggle, export/compile) ([#138](https://github.com/saboteur-works/getwrite/issues/138)) ([5851de1](https://github.com/saboteur-works/getwrite/commit/5851de17f32de1eb4388100375296e7e908f340f))

## [0.2.52](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.51...getwrite-v0.2.52) (2026-06-16)


### Features

* **layout:** add GetWrite wordmark to topbar ([6044f6c](https://github.com/saboteur-works/getwrite/commit/6044f6c717cdd54a577065dd4ac405948e2e5a19))
* **layout:** add GetWrite wordmark to topbar ([ca2befb](https://github.com/saboteur-works/getwrite/commit/ca2befb0b4e6a775dd8e22af2dea968a5b87e0c7))

## [0.2.51](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.50...getwrite-v0.2.51) (2026-06-16)


### Features

* **electron:** add app icon and harden desktop shell [task_4bf73ace] ([339227b](https://github.com/saboteur-works/getwrite/commit/339227b787d0ffedc09e5e88aa84e219257425ee))


### Bug Fixes

* **electron:** build x64 mac dmg so Intel Macs can run the app [task_a23320fd] ([c3e1253](https://github.com/saboteur-works/getwrite/commit/c3e12534dd16a37471f2e625f5b9e3d45455293d))
* **electron:** run Next server via utilityProcess to drop phantom Dock icon [task_4bf73ace] ([e1b0722](https://github.com/saboteur-works/getwrite/commit/e1b07222a0b09a89ff31268aacf8ff3b4397b837))

## [0.2.50](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.49...getwrite-v0.2.50) (2026-06-15)


### Features

* desktop update notice + version footer in settings menu ([#132](https://github.com/saboteur-works/getwrite/issues/132)) ([150b7f1](https://github.com/saboteur-works/getwrite/commit/150b7f164a1643034343933d96ab6f81f194fc65))

## [0.2.49](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.48...getwrite-v0.2.49) (2026-06-15)


### Features

* **metadata:** make built-in metadata fields optional per project ([#128](https://github.com/saboteur-works/getwrite/issues/128)) ([73c1729](https://github.com/saboteur-works/getwrite/commit/73c1729d4d3187cbdc03d9b036d0e2d2f2ba74dd))

## [0.2.48](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.47...getwrite-v0.2.48) (2026-06-13)


### Bug Fixes

* **editor:** menu bar Font Family dropdown follows cursor ([107d2eb](https://github.com/saboteur-works/getwrite/commit/107d2eb8dce3af6517978a73e30a2ea77725e992))
* **editor:** track fontFamily in menu bar state so dropdown follows cursor [task_fff9363f] ([827c1be](https://github.com/saboteur-works/getwrite/commit/827c1be4dd7360f5af8955df3e36bdad67bf2fcb))

## [0.2.47](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.46...getwrite-v0.2.47) (2026-06-12)


### Features

* **editor:** add node-type indicator to editor footer ([78fb7e4](https://github.com/saboteur-works/getwrite/commit/78fb7e4d9b045d9c25deb51a3e4a8f176b420e2f))
* **editor:** node-type indicator in editor footer ([f4e7344](https://github.com/saboteur-works/getwrite/commit/f4e7344affc638cfb0ed1b16103b621a05c6bfeb))


### Performance Improvements

* **editor:** skip ProseMirror resolve for non-wrapped textblocks ([90cbea3](https://github.com/saboteur-works/getwrite/commit/90cbea380f2b85900f299c3844eaf67c4671b3ad))

## [0.2.46](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.45...getwrite-v0.2.46) (2026-06-12)


### Features

* drop Workspace requirement from project-type JSON schema (Task 2) ([e8d46ba](https://github.com/saboteur-works/getwrite/commit/e8d46ba40967c3f7baf8efbe6949c95cb59a1197))
* remove Special toggle from project-type editor form (Task 5) ([87543e3](https://github.com/saboteur-works/getwrite/commit/87543e3627ba64daf16d768fbb62bc8429354c28))
* remove Workspace folder requirement from project-type schema (Task 1) ([5527968](https://github.com/saboteur-works/getwrite/commit/5527968bee0e32af5da8f1263d176102adb1a5f3))
* remove Workspace guardrail from project-type draft service (Task 3) ([eca3fa9](https://github.com/saboteur-works/getwrite/commit/eca3fa9592bf60f48a47edb80fd6511d77d413df))
* remove Workspace guardrail warning UI from project types manager (Task 4) ([78fa03b](https://github.com/saboteur-works/getwrite/commit/78fa03bfbf7970f2acc365821ade26e785c61e0a))
* strip deprecated 'special' flag from built-in templates (Task 6) ([a015c51](https://github.com/saboteur-works/getwrite/commit/a015c51948ea5cf85186480f67ae2a15c46080a2))


### Bug Fixes

* make project-types list and editor panes vertically scrollable ([0f0208e](https://github.com/saboteur-works/getwrite/commit/0f0208eec322a696545e5bb4985695c837b79fc1))
* make project-types panes scroll in modal context too ([87de174](https://github.com/saboteur-works/getwrite/commit/87de174045ba360c79887c3d873f80e7b4873605))

## [0.2.45](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.44...getwrite-v0.2.45) (2026-06-10)


### Bug Fixes

* prevent folder slug collisions from overwriting folder descriptors ([56d04a7](https://github.com/saboteur-works/getwrite/commit/56d04a7acc859628a722f9cc545a1226e1cf9f50))
* prevent folder slug collisions from overwriting folder descriptors ([8fcc395](https://github.com/saboteur-works/getwrite/commit/8fcc3954a7176b203a8a43d2b1b5df6348d5c89c))

## [0.2.44](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.43...getwrite-v0.2.44) (2026-05-26)


### Features

* Media View for image and audio resources ([956ee5f](https://github.com/saboteur-works/getwrite/commit/956ee5f641be58c5989463395334bed432191fba))
* **media-view:** add AudioPlayer with brand-styled Slider primitive ([8380c7c](https://github.com/saboteur-works/getwrite/commit/8380c7ca2f31961849caaf60c12c7783add78666))
* **media-view:** add ImageViewer component (fit + zoom/pan) ([13ec213](https://github.com/saboteur-works/getwrite/commit/13ec213ae6f519642e4531e08b5f11985fc6e69b))
* **media-view:** add MediaView container ([e9af601](https://github.com/saboteur-works/getwrite/commit/e9af601b68fea3f7181d6b09682710fca8fcfe96))
* **media-view:** render MediaView in the edit view for media resources ([86cb44c](https://github.com/saboteur-works/getwrite/commit/86cb44c22a1cee0c47e175d4b465cdc428469e8c))
* **media-view:** surface media via a "Media"-labelled edit tab ([b76fd8b](https://github.com/saboteur-works/getwrite/commit/b76fd8bb87953db3919de60ff84d584c8ce764ca))


### Bug Fixes

* **query-builder:** populate select options for Type and Statuses fields ([54b23f0](https://github.com/saboteur-works/getwrite/commit/54b23f08064622ef3eae72dff81ca4c801ea71cb))

## [0.2.43](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.42...getwrite-v0.2.43) (2026-05-26)


### Features

* image and audio resources ([09aa714](https://github.com/saboteur-works/getwrite/commit/09aa7145e792285a9b780f4c763bbd2aca92c216))
* **media:** add drag-and-drop external images into editor ([598aee5](https://github.com/saboteur-works/getwrite/commit/598aee5a4afc255fa505cbe4e1c1bba258b822e3))
* **media:** add file-serving route for image/audio resources ([f5cb5f8](https://github.com/saboteur-works/getwrite/commit/f5cb5f85cca605cdd0ac008de864594f8480e985))
* **media:** add GetWriteImage TipTap extension with resource-id attr ([af15c3d](https://github.com/saboteur-works/getwrite/commit/af15c3de331b5220bae1e0513eead6a12652da9b))
* **media:** add image picker to editor menu bar ([934239f](https://github.com/saboteur-works/getwrite/commit/934239ff88eaa42409f19e8a99ebecc2c361373a))
* **media:** add image/audio upload validation module ([577cd14](https://github.com/saboteur-works/getwrite/commit/577cd14835aabb364c5b60d5d780d6f844cf3360))
* **media:** add multipart upload route for image/audio resources ([c292ca9](https://github.com/saboteur-works/getwrite/commit/c292ca98f58831c4513b825729a2566f1b0d0a8d))
* **media:** display image/audio metadata in the sidebar ([1739781](https://github.com/saboteur-works/getwrite/commit/17397814e6d2172c739acdc218935c8fbb8de036))
* **media:** expose image/audio creation in the resource modal ([01c38dc](https://github.com/saboteur-works/getwrite/commit/01c38dcecbeeeef736ee317c88d139af018efab4))
* **media:** extract image/audio metadata on ingest ([361004d](https://github.com/saboteur-works/getwrite/commit/361004da16cbc54455ab09ebde3bb6bc015740a0))
* **media:** persist image/audio binaries in the resource directory ([28196f4](https://github.com/saboteur-works/getwrite/commit/28196f452397f46574e02157ccc6cf55ed6e8cfd))


### Bug Fixes

* **media:** don't read content.txt for image/audio resources on load ([a1119cd](https://github.com/saboteur-works/getwrite/commit/a1119cd1837f6ce162ad7f5e4a46c19a065c2408))

## [0.2.42](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.41...getwrite-v0.2.42) (2026-05-24)


### Features

* replace flat folder selects with hierarchical tree picker ([96a82e2](https://github.com/saboteur-works/getwrite/commit/96a82e293fb3ce26d5e54100559a1cba80e480e8))
* **resource-tree:** replace flat folder select with tree picker popover ([a240361](https://github.com/saboteur-works/getwrite/commit/a240361ae695d02eb6003e3a0606cbe328b2df81))
* **schema-manager:** use FolderTreePicker for ref-folder scope ([e9aff8f](https://github.com/saboteur-works/getwrite/commit/e9aff8fe41c1797c7f4c4e69ecf992d844531a1e))
* **search:** use FolderTreePicker for the search folder filter ([a911c2d](https://github.com/saboteur-works/getwrite/commit/a911c2d2c6070b7b99abe30cbe28fe711986ffc4))

## [0.2.41](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.40...getwrite-v0.2.41) (2026-05-24)


### Bug Fixes

* **editor:** correct heading style modal init and paste normalization ([3798166](https://github.com/saboteur-works/getwrite/commit/37981660535c2580b3c5d18119c404bea3c708ba))
* **editor:** correct heading style modal init and paste normalization ([548c71f](https://github.com/saboteur-works/getwrite/commit/548c71f026dada7779e8043c245a0189b6adf108))

## [0.2.40](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.39...getwrite-v0.2.40) (2026-05-24)


### Features

* **context-menu:** add Cut/Copy/Paste context menu to Input and Textarea ([9ba174c](https://github.com/saboteur-works/getwrite/commit/9ba174ccccca6440509548f6c6bc8b594f70c939))
* **context-menu:** add Select All and upgrade Copy to Clipboard API ([4788cba](https://github.com/saboteur-works/getwrite/commit/4788cba45806660526644e103c23218f46548b81))
* **context-menu:** add sidebar context menu and smart-folder action ([c3679d8](https://github.com/saboteur-works/getwrite/commit/c3679d8d38b3022b8401a7d7d5d1fc73de7a2922))
* **context-menu:** apply EditContextMenu to QueryBuilder inputs ([28bf124](https://github.com/saboteur-works/getwrite/commit/28bf124739edf862e491c5851518d7bce76115a4))
* **context-menu:** apply EditContextMenu to SchemaManager inputs ([5942440](https://github.com/saboteur-works/getwrite/commit/5942440878b9167774ab17edfaaadc0b21f3b3ca))
* **context-menu:** Edit context menu for inputs and textareas ([6fa2b0c](https://github.com/saboteur-works/getwrite/commit/6fa2b0cfa849c2b761c46ccfced9a0c3eadf75aa))
* **context-menu:** replace custom context menu with shadcn/Radix ContextMenu ([107c07f](https://github.com/saboteur-works/getwrite/commit/107c07fde5fc76efb523f2e4ca05a5a7990bdb68))


### Bug Fixes

* **context-menu:** use Clipboard API for paste instead of execCommand ([0ded3f5](https://github.com/saboteur-works/getwrite/commit/0ded3f5854fa9b855527ef0de6feb43f1d51e880))

## [0.2.39](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.38...getwrite-v0.2.39) (2026-05-24)


### Features

* **indexer:** durable meta writes and graceful shutdown ([f97f453](https://github.com/saboteur-works/getwrite/commit/f97f453e354c5905900b7ccf0044fdae008b612b))
* make DataView resources clickable and open text resources in editor ([cdd6ea3](https://github.com/saboteur-works/getwrite/commit/cdd6ea3c6a2fb982a446c49eb14906860cd04afa))
* persist backlinks on save and decorate wiki-style links in the editor ([8dd2bad](https://github.com/saboteur-works/getwrite/commit/8dd2badfc504c27f4d30814d044ecb88eacd027b))


### Bug Fixes

* **diff:** refetch canonical and isolate historical pane on revision change ([eaddcf1](https://github.com/saboteur-works/getwrite/commit/eaddcf12670170d23f5ebbbf83f9e6b93c8441fa))
* **lint:** resolve AppShell lint warnings and canonical Tailwind classes ([1a6f986](https://github.com/saboteur-works/getwrite/commit/1a6f9866cdc4557aa7d475e6dd95dd2738af215b))
* make index and backlinks writes crash-safe via atomic rename ([ff30830](https://github.com/saboteur-works/getwrite/commit/ff30830bf04e32b24155a8e7605cbf62e2acb792))
* resolve editor warnings and improve resource creation UX ([bb58781](https://github.com/saboteur-works/getwrite/commit/bb58781f30cb914429bb006990fced4573639819))
* sort Start Page projects by latest activity and include root-level resources ([419ff62](https://github.com/saboteur-works/getwrite/commit/419ff62874b0e77f6ae07e243b0ce24c817ca67d))
* stamp updatedAt on autosave and sort Recent Files by last edit ([2e36079](https://github.com/saboteur-works/getwrite/commit/2e360798d8f42b84a9f2e2f7b697c6da2f09a683))
* **stories:** resolve all TypeScript errors in tsconfig.storybook.json scope ([0728126](https://github.com/saboteur-works/getwrite/commit/0728126a290f7f0e835daf761ae9c2d459869f5e))

## [0.2.38](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.37...getwrite-v0.2.38) (2026-05-23)


### Features

* **editor:** add clear option to color submenus ([3365fe8](https://github.com/saboteur-works/getwrite/commit/3365fe8e4d3edab04111f1d1765e031e156e12c9))
* **editor:** add table support and canonical heading/body defaults ([4e730f1](https://github.com/saboteur-works/getwrite/commit/4e730f1e9f4461fd4ed8d657c39f0a25d01286fd))
* **editor:** add table support via TipTap TableKit ([514b631](https://github.com/saboteur-works/getwrite/commit/514b631e64ac4eaec49eafd8587cccd12dc4f840))
* **editor:** enable table column resizing and strip pasted table styles ([030bc48](https://github.com/saboteur-works/getwrite/commit/030bc4837773e1b0b8d4f5e0255856e02db0e385))
* **editor:** establish canonical heading/body defaults and apply them at runtime ([7d90fb0](https://github.com/saboteur-works/getwrite/commit/7d90fb0ff952ad45ba373d9f747509b1ff560fc9))
* **editor:** pin footer, scroll editor between toolbar and footer ([de79dd9](https://github.com/saboteur-works/getwrite/commit/de79dd93f38ddd21267983da2f0be56c493b78ae))
* **preferences:** add live style previews to heading and body settings modals ([fde4350](https://github.com/saboteur-works/getwrite/commit/fde43502f9abff931179065dd7decf29a3cd6f37))


### Bug Fixes

* **editor:** ensure headings use ink color token and render correct tag level ([2b55714](https://github.com/saboteur-works/getwrite/commit/2b55714ec345c29e6266380955467afc655739d3))
* **editor:** reinit TipTap when heading config changes so styles apply live ([fb5ea64](https://github.com/saboteur-works/getwrite/commit/fb5ea6426d1d72467eca2a6077597e1ea1a1a230))
* **editor:** remove hardcoded white heading color from CustomHeading defaults ([8fea866](https://github.com/saboteur-works/getwrite/commit/8fea8667003df919dac4c8095048cfe580829a50))
* **types:** resolve typecheck errors in editorMenuBar test ([a0b4a20](https://github.com/saboteur-works/getwrite/commit/a0b4a202cdace7b9ec92893a907d84e7abf0345c))

## [0.2.37](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.36...getwrite-v0.2.37) (2026-05-22)


### Features

* **SearchFilterPanel:** Convert filter panel to a Radix popover ([bc322ef](https://github.com/saboteur-works/getwrite/commit/bc322effd5e57846214fe0896735bf2845a22893))


### Bug Fixes

* **theme:** Propagate light/dark tokens to document root for portal content ([8022aa4](https://github.com/saboteur-works/getwrite/commit/8022aa49afaa5fd7d72e861bc325034dd9adb4e4))

## [0.2.36](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.35...getwrite-v0.2.36) (2026-05-21)


### Features

* **metadata-query:** AddFieldForm inline mini-form replaces old + Add field button (Task 20) ([1495f9c](https://github.com/saboteur-works/getwrite/commit/1495f9c0417a04baefdee163b9ef55a1e602301c))
* **metadata-query:** cross-path field dedup helper — slugifyName, findExisting, fuzzyMatch (Task 18) ([6e612e5](https://github.com/saboteur-works/getwrite/commit/6e612e55f6e9a86aab7b80469972e6aa678b3afc))
* **metadata-query:** define query AST types and Zod schema (Task 1) ([01fce6f](https://github.com/saboteur-works/getwrite/commit/01fce6f0124daadc97d7cdd3bdc05d41cc7a724f))
* **metadata-query:** deprecate-vs-clear on removeField (Task 24) ([5acfcdb](https://github.com/saboteur-works/getwrite/commit/5acfcdba116435f324a6ba7e54033c35e1e48316))
* **metadata-query:** distinct-value enumeration utility (Task 21) ([ddc189c](https://github.com/saboteur-works/getwrite/commit/ddc189caa6eb096ebcf36db7cbad5eb1ac69a286))
* **metadata-query:** extend backlinks extractor to include resource-ref sidecar values (Task 4) ([374fafc](https://github.com/saboteur-works/getwrite/commit/374fafc8b6dbf9ec8c2bf99051c4881f2d32bda7))
* **metadata-query:** FieldPicker dropdown — three-layer field enumeration with search and source badges (Task 14) ([53c9c00](https://github.com/saboteur-works/getwrite/commit/53c9c00f7808760ee92b6cfc872c88aaee505428))
* **metadata-query:** FilterChip component — three-slot field/operator/value chip (Task 11) ([7cc6cc8](https://github.com/saboteur-works/getwrite/commit/7cc6cc82466d73762c087ac5d7c1f8c68c5ce071))
* **metadata-query:** FilterGroup container — combinator header, drag-reorder, and match count (Task 15) ([516ada6](https://github.com/saboteur-works/getwrite/commit/516ada673ef2ea89f44f1c7ba09f3c78136296b1))
* **metadata-query:** HTTP API routes for query evaluate and saved CRUD (Task 7) ([9043f7a](https://github.com/saboteur-works/getwrite/commit/9043f7a59fedd4cc6b8a4496063a4787442bae19))
* **metadata-query:** in-memory query cache keyed by metadataRevision (Task 9) ([a0c78fd](https://github.com/saboteur-works/getwrite/commit/a0c78fd5a7116198eb7ea642069420b9923a21ca))
* **metadata-query:** intrinsic field registry and decision refs in tasks (Tasks 2 + docs) ([f62b98e](https://github.com/saboteur-works/getwrite/commit/f62b98ed5bbdfa93bf7450dd07d1e4c3a68a69bc))
* **metadata-query:** OperatorMenu component with AST stub emission (Task 12) ([8becbbf](https://github.com/saboteur-works/getwrite/commit/8becbbf61667bd6a087b1ec01ff3aa9fd99c1749))
* **metadata-query:** OptionsRemovalPreview for updateFieldOptions (Task 23) ([9df75d8](https://github.com/saboteur-works/getwrite/commit/9df75d8b2edeb26c662c26fa6129681ce7e01105))
* **metadata-query:** prefilled SchemaManager + FieldPicker fuzzy dedup (Task 19) ([b92b6ba](https://github.com/saboteur-works/getwrite/commit/b92b6ba86487d95f411ed092c83896f5f70c7b0c))
* **metadata-query:** project metadata-revision counter (Task 3) ([30b5adc](https://github.com/saboteur-works/getwrite/commit/30b5adc97a8d1143ee6db6897d4ba5552f846ef1))
* **metadata-query:** query AST evaluator — no caching, no refs (Task 5) ([6cc9454](https://github.com/saboteur-works/getwrite/commit/6cc9454a94bd1a5896ecf609e4d219e8dde47b51))
* **metadata-query:** QueryBuilder top-level — global combinator pill, group CRUD, and match-count footer (Task 16) ([a627532](https://github.com/saboteur-works/getwrite/commit/a6275329f119f7613e50ff728b5f1a5cc268a387))
* **metadata-query:** QueryBuilder with smart folder filtering and resource-ref typeahead ([078d706](https://github.com/saboteur-works/getwrite/commit/078d70643fdd28849a511f4c9417e38c6115185c))
* **metadata-query:** Redux slice for queries — transport, guards, and thunks (Task 10) ([1f4aff2](https://github.com/saboteur-works/getwrite/commit/1f4aff28d93e3546915dfda3ba7254aaad28635c))
* **metadata-query:** ref node resolution with cycle detection (Task 8) ([2863801](https://github.com/saboteur-works/getwrite/commit/286380119ca85e2ce96ef2ea4cee26802e5aa8b1))
* **metadata-query:** save-query dialog launched from QueryBuilder (Task 25) ([a6e97f7](https://github.com/saboteur-works/getwrite/commit/a6e97f7ceb3e993250ae8636b03f3bb8db379c46))
* **metadata-query:** saved-query persistence module (Task 6) ([6e57fe2](https://github.com/saboteur-works/getwrite/commit/6e57fe240d101c5349063a14b3d9403b2858e2db))
* **metadata-query:** saved-query ref chips in the chip UI (Task 27) ([f1e9f92](https://github.com/saboteur-works/getwrite/commit/f1e9f924b24b7397bddbec75b29a331e2087d854))
* **metadata-query:** SchemaManager migration preview for type changes (Task 22) ([f15b1ec](https://github.com/saboteur-works/getwrite/commit/f15b1ec6842ab331e87e55baf4ffd2f74de9a315))
* **metadata-query:** SmartFolders in ResourceTree + fix DialogTitle/Dialog test failures (Tasks 26 & fixup) ([d70b523](https://github.com/saboteur-works/getwrite/commit/d70b523def8afc5a5638a38c4e23e0bec6661c4c))
* **metadata-query:** Text/AST escape hatch with round-trip bridge (Task 17) ([01a6730](https://github.com/saboteur-works/getwrite/commit/01a673018cc747693ea073975d40cbdc2645fce2))
* **metadata-query:** ValuePicker component — type-driven value inputs with ref hover preview (Task 13) ([f088668](https://github.com/saboteur-works/getwrite/commit/f088668ddf62b41a5a9b07db524fe59e5be232c0))
* **metadata-query:** wire QueryBuilder into AppShell — full query integration ([75199b0](https://github.com/saboteur-works/getwrite/commit/75199b08c01a39331cc7869dee505557a880716e))


### Bug Fixes

* **metadata-query:** close QueryBuilder when navigating to non-smart folder ([08179e0](https://github.com/saboteur-works/getwrite/commit/08179e09044509bfbf738c68c8382de1eccf06a2))
* **metadata-query:** resource-ref query matching — flatten userMetadata + name fallback + typeahead ([0a0e6c2](https://github.com/saboteur-works/getwrite/commit/0a0e6c206cafb192462428d7374be6ed20807bab))
* **metadata-query:** resource-ref typeahead respects includeSubfolders in QueryBuilder ([0ae8122](https://github.com/saboteur-works/getwrite/commit/0ae8122bf737fa288dcf0784915deb48326610e7))

## [0.2.35](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.34...getwrite-v0.2.35) (2026-05-20)


### Features

* **storybook:** add Borders foundation story ([222d7ed](https://github.com/saboteur-works/getwrite/commit/222d7edfb790e119161f9f5bc06d255e11c68f17))
* **storybook:** add brand palette section and clarify --color-gw-dim in Colors story ([344445f](https://github.com/saboteur-works/getwrite/commit/344445f186fb3d750187b20f6275ad195fb68eb8))
* **storybook:** add card composition example to Borders story ([2900099](https://github.com/saboteur-works/getwrite/commit/2900099743b07b1c358518c0f30a24574c881042))
* **storybook:** add Density foundations story ([1d6644d](https://github.com/saboteur-works/getwrite/commit/1d6644dc88102a44ebd49b92aa133635e174e4a7))
* **storybook:** add Focus States foundations story ([bf3a697](https://github.com/saboteur-works/getwrite/commit/bf3a6977fddaaa25d11f750ac060f8e1b894685b))
* **storybook:** add font weights and wordmark construction to Typography story ([94b77c6](https://github.com/saboteur-works/getwrite/commit/94b77c619998b375496ba288cb9e2aea8987572b))
* **storybook:** add Layout Tokens foundation story ([24726f2](https://github.com/saboteur-works/getwrite/commit/24726f22ea77b55c9aa676df5cd1a583e7237804))
* **storybook:** add Motion foundation story ([e7c558d](https://github.com/saboteur-works/getwrite/commit/e7c558d903677fa34af0808ddc94faa322e7082b))
* **storybook:** add reduced motion section to Motion story ([6b50824](https://github.com/saboteur-works/getwrite/commit/6b50824d230f2e5c2e773ef9476db905e5ad9bc5))
* **storybook:** add Spacing foundation story ([3f2af79](https://github.com/saboteur-works/getwrite/commit/3f2af7979c5c96284430a5c234180ac806ba2942))
* **storybook:** add Surface Hierarchy foundations story ([c7cade2](https://github.com/saboteur-works/getwrite/commit/c7cade2089ef4b577388b25d13d26aeab8f6adf7))
* **storybook:** add Typography foundation story ([03df19d](https://github.com/saboteur-works/getwrite/commit/03df19d5bbb64afb59cf267232536c3d3cbb5efa))
* **storybook:** foundation enhancement — full design token coverage + a11y fixes ([6e7a52d](https://github.com/saboteur-works/getwrite/commit/6e7a52dee43873ab35773c74df33035947c4e0ff))
* **storybook:** rename Layout Tokens story title to Layout ([7e37bbc](https://github.com/saboteur-works/getwrite/commit/7e37bbc32255618258832143dcdab9c88fa4cd5a))
* **storybook:** rework Colors foundation story ([91fb48d](https://github.com/saboteur-works/getwrite/commit/91fb48dd54a2db108cde78ef469a156ecb63a618))


### Bug Fixes

* **a11y:** gate DialogTitle on renderInModal in dual-mode page components ([bc927fe](https://github.com/saboteur-works/getwrite/commit/bc927febcc45c8b87acd5f5c506c06e657bf787c))
* **storybook:** add Dialog context decorator to all stories missing it ([5d2c084](https://github.com/saboteur-works/getwrite/commit/5d2c084ee38848abc4e9e7d663504893ad4133a7))
* **storybook:** allow canvas to scroll past viewport height ([62e0f13](https://github.com/saboteur-works/getwrite/commit/62e0f132b13dca1070405018d18b9bb90b44ba06))

## [0.2.34](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.33...getwrite-v0.2.34) (2026-05-20)


### Features

* **design-system:** second-pass simplification — new primitives, menu hook, autocomplete migrations, CI hex gate ([bbacc4e](https://github.com/saboteur-works/getwrite/commit/bbacc4ea30b55d620647ad265763bc0030fbbef2))
* **design-system:** simplify design system — second pass ([34a31f1](https://github.com/saboteur-works/getwrite/commit/34a31f11f9fc84b9e42bdefe97034650015af1a8))


### Bug Fixes

* **a11y:** add DialogTitle to SchemaManager (metadata fields dialog) ([9ce62cc](https://github.com/saboteur-works/getwrite/commit/9ce62ccff6b2fab15e803f3213fc915d8cf42371))
* **a11y:** add DialogTitle to UserPreferencesPage and ProjectTypesManagerPage ([3534fe6](https://github.com/saboteur-works/getwrite/commit/3534fe612bffd04dd2de357759b7c056610b7d85))
* **searchbar:** restore snippet layout and match highlighting in search results ([cb0ed22](https://github.com/saboteur-works/getwrite/commit/cb0ed22b543b6e1b3eb12fb7673232e94e044563))

## [0.2.33](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.32...getwrite-v0.2.33) (2026-05-19)


### Features

* **ui:** canonical Button primitive + full call-site migration (Task 4) ([ce6dc31](https://github.com/saboteur-works/getwrite/commit/ce6dc31be97213ad097009928ab8e18838b1e549))
* **ui:** canonical Card primitive + full call-site migration (Task 6) ([2d4268b](https://github.com/saboteur-works/getwrite/commit/2d4268bc7c18cc483cbb5ff239934c041979cc27))
* **ui:** canonical CollapsibleSection primitive + SidebarSection merge (Task 8) ([bc5f557](https://github.com/saboteur-works/getwrite/commit/bc5f557498917eb00a49034cfa24c252e57e08d7))
* **ui:** canonical Dialog primitive + full modal migration (Task 5) ([56712ee](https://github.com/saboteur-works/getwrite/commit/56712ee4e0639d724c93212f1f76e47eb9f6e220))
* **ui:** canonical Input/Textarea/Select/Checkbox primitives + full call-site migration (Task 7) ([8f04836](https://github.com/saboteur-works/getwrite/commit/8f04836df80e4a716d7ca564f3dce20564427380))
* **ui:** Chip active/pressed state + TagsSection/SearchFilterPanel migration (Task 9) ([4157e33](https://github.com/saboteur-works/getwrite/commit/4157e33c90063486d9bd6572a80f5d8b4a5ae72c))
* **ui:** replace hardcoded hex values with CSS tokens (Task 10) ([9764729](https://github.com/saboteur-works/getwrite/commit/9764729b1b17c3410e63b1ef54b68bd5c86fda59))
* **ui:** scaffold simplify-design-system — spec, audit, decisions, and cva/shadcn foundation ([2cbf4f1](https://github.com/saboteur-works/getwrite/commit/2cbf4f1aa99c3c5c5ad084b50c30282b9920ad72))
* **ui:** Simplify Design System — canonical primitives + full phase-one migration ([f620be4](https://github.com/saboteur-works/getwrite/commit/f620be430bbe78c99041735a71362d88474f6390))


### Bug Fixes

* **a11y:** remove manual id from DialogTitle asChild in CreateProjectModal ([c7d6d42](https://github.com/saboteur-works/getwrite/commit/c7d6d426384544714414bad107429251e1c33b46))
* **a11y:** wrap modal titles with Radix DialogTitle ([f46f120](https://github.com/saboteur-works/getwrite/commit/f46f120a1f7fd6dd8b769d6e3f0d386ef4f397a7))
* **e2e:** add searchSlice to Storybook mock store and align e2e assertions with actual component behaviour ([c1ab700](https://github.com/saboteur-works/getwrite/commit/c1ab7005e4422699c35259c535940e06e2c050f5))

## [0.2.32](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.31...getwrite-v0.2.32) (2026-05-19)


### Features

* add full-text search API route, search snippet model, and user preference for result limit ([95cf9e5](https://github.com/saboteur-works/getwrite/commit/95cf9e554730c3c68627a44905d0cb654a02a319))
* add SearchFilterPanel with folder, status, and tag filters ([3c8a462](https://github.com/saboteur-works/getwrite/commit/3c8a4622f73388ba0e8b805ef4fe5794fd8f5ea5))
* **search:** full-text search with ranking, filters, and scrollable results ([9555ac3](https://github.com/saboteur-works/getwrite/commit/9555ac38e1003e1a3bbf45bcabd4e03db4923216))
* **search:** proximity scoring for multi-term queries ([fc686b5](https://github.com/saboteur-works/getwrite/commit/fc686b5b3c552e6589b04f89e920200d1dc7e2b1))
* **search:** stop word filtering and background reindex of existing content ([87a7c3b](https://github.com/saboteur-works/getwrite/commit/87a7c3b30fbc2bffd50539bff72607826a34886a))
* **search:** title boosting — resources named after query terms rank first ([f81b239](https://github.com/saboteur-works/getwrite/commit/f81b23901a92107921fa64cd711837b9e048f19b))
* wire SearchBar to full-text search API via Redux slice ([3373815](https://github.com/saboteur-works/getwrite/commit/337381570b52d4b72611e9b4b55266a087664a06))


### Bug Fixes

* **search:** AND semantics for multi-term queries; center snippet on full phrase ([d7ae273](https://github.com/saboteur-works/getwrite/commit/d7ae27362e64251b274c03c201b9977572a8577e))
* **search:** read status from userMetadata.status, not top-level statuses array ([4ae8900](https://github.com/saboteur-works/getwrite/commit/4ae8900218715c7003a0dd3cdee5cfd093dfa545))
* **search:** remove hardcoded 8-result cap and add scrollable results list ([0d5d045](https://github.com/saboteur-works/getwrite/commit/0d5d04540d0bb6ec294568d00861c67c0de826e0))
* **search:** show snippet text and highlight matched terms in results ([283675c](https://github.com/saboteur-works/getwrite/commit/283675ce1bf49303d56fbf23f1887ea914730b92))

## [0.2.31](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.30...getwrite-v0.2.31) (2026-05-19)


### Features

* add normalizePastedHTML pure function with full test coverage ([e817a9e](https://github.com/saboteur-works/getwrite/commit/e817a9ec3a16d7f4c448e75e2b913a4ad8df82ef))
* normalize pasted text and replace StripExternalPasteColor ([e4e17e3](https://github.com/saboteur-works/getwrite/commit/e4e17e3f3fd8535349415ed0f4c78d769f35f845))
* replace StripExternalPasteColor with NormalizePastedText extension ([b080a1d](https://github.com/saboteur-works/getwrite/commit/b080a1d32737b17035135162f9c18e2e63bb4951))

## [0.2.30](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.29...getwrite-v0.2.30) (2026-05-19)


### Features

* **editor:** add StripExternalPasteColor extension to strip color on external paste ([725e521](https://github.com/saboteur-works/getwrite/commit/725e521564bb2ef194dafefa0fd23d9aff6a792c))
* **editor:** strip inline color from externally pasted text ([fd2550b](https://github.com/saboteur-works/getwrite/commit/fd2550b02548f1901edebc2c8be4201720dd3c06))

## [0.2.29](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.28...getwrite-v0.2.29) (2026-05-19)


### Features

* **api:** add POST /api/project/metadata-schema route (Task 5) ([6191a7d](https://github.com/saboteur-works/getwrite/commit/6191a7dc057419dba7c200309ed4eb89dcd25983))
* **chip:** add chip BEM CSS classes to getwrite-utilities.css ([a810d28](https://github.com/saboteur-works/getwrite/commit/a810d28d542367d5dbbb39e9073e3ad456ce9b0a))
* **chip:** add onDismiss prop with lucide X icon and propagation guard ([4fbb3f6](https://github.com/saboteur-works/getwrite/commit/4fbb3f67cb0c271fbae1e79484629afac7e929b6))
* **chip:** add tooltip prop with brand styling and WithTooltip story ([83135ce](https://github.com/saboteur-works/getwrite/commit/83135ce5a6dbcf8adfc4e127b003620e2518d928))
* **chip:** implement reusable Chip component with tests and Storybook story ([4339798](https://github.com/saboteur-works/getwrite/commit/43397984046466f410758583d43c050ba4e17c78))
* **dynamic-metadata:** dynamic metadata schema + multi-resource-ref field type ([6c8c54c](https://github.com/saboteur-works/getwrite/commit/6c8c54cd32e062cbf5e4ca324b2081ce2664cc24))
* **metadata:** add dynamic sidebar controls and stabilize related tests ([5e6f56b](https://github.com/saboteur-works/getwrite/commit/5e6f56b0093fd339e28b123a27d9a1e6ed840dcc))
* **models:** add metadata-schema CRUD model layer (Task 4) ([677f9f2](https://github.com/saboteur-works/getwrite/commit/677f9f205f2d3a9deb05751d54456df808f31fe8))
* **multi-resource-ref:** Task 1 — add type to schema union + spec and tasks ([bda6a94](https://github.com/saboteur-works/getwrite/commit/bda6a940bcbac5d3ca3907494bd8af318a6db95f))
* **multi-resource-ref:** Task 10 — maxSelections number input in SchemaManager ([a26955f](https://github.com/saboteur-works/getwrite/commit/a26955fb9f5de677201b7080a7e3673f90e8efc7))
* **multi-resource-ref:** Task 11 — Storybook stories for MultiResourceRefInput ([b4abd1d](https://github.com/saboteur-works/getwrite/commit/b4abd1decd24caa84198363bfbe001adac600bed))
* **multi-resource-ref:** Task 2 — add refFolder, includeSubfolders, maxSelections to schema ([c585191](https://github.com/saboteur-works/getwrite/commit/c585191d6db3cc58a49626c92880ee61d05bd9c1))
* **multi-resource-ref:** Task 3 — update-ref-properties across model, route, transport, and Redux ([2483359](https://github.com/saboteur-works/getwrite/commit/24833598da4af3684fec79f5b2b45bfb1dc87148))
* **multi-resource-ref:** Task 4 — MultiResourceRefInput chip-based control ([fcce8cd](https://github.com/saboteur-works/getwrite/commit/fcce8cd3ff4d92d597569e9eef8e00ce68e21169))
* **multi-resource-ref:** Task 5 — folder-scoped autocomplete candidates ([6202d0b](https://github.com/saboteur-works/getwrite/commit/6202d0baf76165d2fb4c344bb1c186d4612f5301))
* **multi-resource-ref:** Task 6 — max-selections enforcement ([a3cfff7](https://github.com/saboteur-works/getwrite/commit/a3cfff740cfaa628265fd30f5e4aa4e02289fc57))
* **multi-resource-ref:** Task 7 — wire MultiResourceRefInput into MetadataSidebar ([a1f660b](https://github.com/saboteur-works/getwrite/commit/a1f660bf2f749183234a30ea7e322f993e7e368a))
* **multi-resource-ref:** Task 8 — multi-resource-ref in SchemaManager type dropdown ([27b866c](https://github.com/saboteur-works/getwrite/commit/27b866c3ea9a0e478f77760bb05440df9bd1b7e6))
* **multi-resource-ref:** Task 9 — folder picker + Include Subfolders in SchemaManager ([15318e6](https://github.com/saboteur-works/getwrite/commit/15318e603b51fa88b52480540353812dfbbfe691))
* **redux:** add metadata schema CRUD thunks and transport service (Task 6) ([4226e79](https://github.com/saboteur-works/getwrite/commit/4226e79f0d347487090b68adb8ac2db15f0c3c59))
* **redux:** store metadataSchema in projectsSlice and expose selector (Task 3) ([9b290b7](https://github.com/saboteur-works/getwrite/commit/9b290b7f39f56569ba6b6b66e71b9549b75b0942))
* **schema-manager:** add field type selector; fix resource-ref autocomplete ([b587871](https://github.com/saboteur-works/getwrite/commit/b587871af269ff990e0da316455fe94897a9bcf8))
* **schema-manager:** build SchemaManager modal UI component (Task 12) ([df33bab](https://github.com/saboteur-works/getwrite/commit/df33bab47c46eea473442e84797d680ea5c9a5ba))
* **schema-manager:** implement field key rename with sidecar migration ([7d9ac78](https://github.com/saboteur-works/getwrite/commit/7d9ac78b62f14cc7715ddd5658171c67d1f4a5ae))
* **schemas:** add DEFAULT_METADATA_SCHEMA constant with seven built-in fields (Task 2) ([e6b56ec](https://github.com/saboteur-works/getwrite/commit/e6b56ec4f2e5d846d5a2b1bf5fba628f16ceed4c))
* **schemas:** add Zod schemas and TS types for dynamic metadata schema (Task 1) ([ca37782](https://github.com/saboteur-works/getwrite/commit/ca3778299abad129abaebe1685739b863fbea249))
* **settings:** wire SchemaManager into settings menu (Task 13) ([97adf2d](https://github.com/saboteur-works/getwrite/commit/97adf2d3fa559e5fa09616dd44bc931eba2a6b96))
* **sidebar:** add "Add field" footer button to MetadataSidebar (Task 11) ([61917cc](https://github.com/saboteur-works/getwrite/commit/61917ccc36294d835a086461e27372fc6a3d17b6))
* **sidebar:** lazy POV migration to ResourceRef on first edit (Task 7) ([4e2eff2](https://github.com/saboteur-works/getwrite/commit/4e2eff2d8b6a2a2547caf64d0ea4e9585ca0bcd6))
* **sidebar:** schema-driven MetadataSidebar rewrite (Task 10) ([cc04767](https://github.com/saboteur-works/getwrite/commit/cc04767c61086202f56f75860952c12b4e5b2ce4))
* **trash:** nullify resource-ref values project-wide on delete (Task 8) ([324b5da](https://github.com/saboteur-works/getwrite/commit/324b5da46747ceeda0fc22f9a8132c3a44c0e412))


### Bug Fixes

* **chip:** resolve nested interactive controls a11y violation ([dae139a](https://github.com/saboteur-works/getwrite/commit/dae139a8e0582bbc660b04ad2366821890ae4bab))
* **dynamic-metadata:** forward metadataSchema on project open ([638da71](https://github.com/saboteur-works/getwrite/commit/638da71b1307984e79a0a6641a643f6e159d3b43))
* **multi-resource-ref:** subfolder resources missing from autocomplete ([e7362ce](https://github.com/saboteur-works/getwrite/commit/e7362ce09893b092981e29b97cdf8767d036baa8))
* **pov:** expand autocomplete to all resources instead of characters-only ([9d5ddaa](https://github.com/saboteur-works/getwrite/commit/9d5ddaab0b71a8bcf112a0f91bc004ceb169f601))
* **schema-manager:** sync userMetadata key rename into Redux resources ([b342b06](https://github.com/saboteur-works/getwrite/commit/b342b064c8c20024645c34576d1039ea2d3bd71d))
* **sidebar:** sticky title and Add Field; scrollable content between ([a6b8efe](https://github.com/saboteur-works/getwrite/commit/a6b8efecc81440878749c1b9d9c21417d2429f7b))

## [0.2.28](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.27...getwrite-v0.2.28) (2026-05-17)


### Features

* **timeline:** adaptive chip variants, lane layout, and rich tooltips ([4737ce2](https://github.com/saboteur-works/getwrite/commit/4737ce296ec8dcf57ae08b24159afa1db1d3315a))
* **timeline:** add POV legend, chip hover/focus, scene count, and row separators ([7451ed7](https://github.com/saboteur-works/getwrite/commit/7451ed7a00da6840a5ec45af569b2a672ef7a9ec))
* **timeline:** apply STYLE.md spec — chips, toolbar, tooltip, layout ([9206ea9](https://github.com/saboteur-works/getwrite/commit/9206ea939c4831aa2cdbc9df5005cea74e8b3d8d))
* **timeline:** finalize Timeline View to match STYLE.md spec ([1fdfc14](https://github.com/saboteur-works/getwrite/commit/1fdfc146e14ab6d332af6ac3131e28a90021cfae))

## [0.2.27](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.26...getwrite-v0.2.27) (2026-05-17)


### Bug Fixes

* **editor:** added missing editor extensions ([e174fbc](https://github.com/saboteur-works/getwrite/commit/e174fbc2f4f002997864dfd8b2e84aa7c540049f))
* **editor:** finalize editor for V1 — list bugs, toolbar consolidation, focus fixes, view switching ([e518501](https://github.com/saboteur-works/getwrite/commit/e518501b44ee76d3cb75df8a312395ef6ff73e75))
* **editor:** fix all bullet/ordered list bugs (V1 blocker) ([23fb7e1](https://github.com/saboteur-works/getwrite/commit/23fb7e141e2100039df4e7c02216c60fae10f326))
* **editor:** fix immediate focus loss on font-size and line-height inputs ([d1db3e7](https://github.com/saboteur-works/getwrite/commit/d1db3e7c2b19aa83947535a6d610f49678664db3))
* **workarea:** allow data and timeline views when a text resource is selected ([b756f47](https://github.com/saboteur-works/getwrite/commit/b756f477ce70e5dca72d82014f2c6c15b366f20a))

## [0.2.26](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.25...getwrite-v0.2.26) (2026-05-17)


### Features

* **data-view:** add folder breakdown section to resource stats ([5bdcf65](https://github.com/saboteur-works/getwrite/commit/5bdcf65ef0b16e32e3e271db26d2661a2a900d4b))
* **data-view:** add folder jump button and fix live data in breakdown ([fe139b7](https://github.com/saboteur-works/getwrite/commit/fe139b7837238fa12fd2b2669c37e5e78b8367f5))
* **data-view:** add last-edited timestamps and sort toggle to resource list ([359978c](https://github.com/saboteur-works/getwrite/commit/359978ca7c95f6e4be6906ee7e6d35a61c2d3573))
* **data-view:** add word count goal progress bar ([760e1e4](https://github.com/saboteur-works/getwrite/commit/760e1e49955495b3919f0950a890c39336027521))
* **data-view:** finalize Data view with stats, breakdown, and resource list ([8ab53b3](https://github.com/saboteur-works/getwrite/commit/8ab53b3b260f77b24e66db9d4a553e88670b8262))
* **data-view:** make DataView sections collapsible ([35afc91](https://github.com/saboteur-works/getwrite/commit/35afc914226dcaf60cd9f38dfe3cca25e2a646be))
* **data-view:** make Resources and Breakdown sections scrollable ([b3b8770](https://github.com/saboteur-works/getwrite/commit/b3b8770dbd19168dba400ee4bd89896d0880b816))
* **data-view:** surface stub resources as 'needs content' in resource list ([49d333a](https://github.com/saboteur-works/getwrite/commit/49d333a127465a0981f6da0410af3a0f05fd14a6))
* **word-count:** centralise word counting and fix HTML inflation bug ([57f5c00](https://github.com/saboteur-works/getwrite/commit/57f5c007e1b8207448847e1994db96ef85e45d85))


### Bug Fixes

* **data-view:** add consistent vertical spacing between sections ([1825e49](https://github.com/saboteur-works/getwrite/commit/1825e49ec2408b3fa78e3478d4e69e9d12300bb8))
* **data-view:** prevent duplicate 'Unknown' keys in breakdown section ([bcd280d](https://github.com/saboteur-works/getwrite/commit/bcd280dc8b0085e0d87a2d48d237dcabd8b2f2d3))

## [0.2.25](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.24...getwrite-v0.2.25) (2026-05-16)


### Features

* **organizer:** Organizer v1 ([428448a](https://github.com/saboteur-works/getwrite/commit/428448a929ddb49ac1b5198411756805ac21c38f))

## [0.2.24](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.23...getwrite-v0.2.24) (2026-05-16)


### Bug Fixes

* **organizer:** scope view to selected folder and surface folders in selector ([5de3bb2](https://github.com/saboteur-works/getwrite/commit/5de3bb2319d30bb8d889c2a567c20be19eedb19f))

## [0.2.23](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.22...getwrite-v0.2.23) (2026-05-16)


### Bug Fixes

* **sidebar:** implement resource copy/duplicate and fix delete store sync ([6c5e0aa](https://github.com/saboteur-works/getwrite/commit/6c5e0aa307a01dcbfe19da6a628c6300c37a307e))
* **sidebar:** resource copy/duplicate, orphan surfacing, and tree selection ([a5e02ff](https://github.com/saboteur-works/getwrite/commit/a5e02ffacba287306637394a29adaf0451fd3cac))
* **tree:** also re-parent orphans whose parent is a non-folder resource ([c5d1ba2](https://github.com/saboteur-works/getwrite/commit/c5d1ba24614a206d58fd1ca9fbfd6cc593003f9a))
* **tree:** guard getItem against undefined during delete/rebuild timing gap ([86bdaaa](https://github.com/saboteur-works/getwrite/commit/86bdaaace7074b2075e0a772e8c388dc84f5933c))
* **tree:** surface orphaned resources at root and prevent create-on-non-folder orphans ([c7cef68](https://github.com/saboteur-works/getwrite/commit/c7cef68f97875cbc738f91197dca6de7ef0f67f6))

## [0.2.22](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.21...getwrite-v0.2.22) (2026-05-14)


### Bug Fixes

* **p0:** close canonical-guard and indexer-drain data-safety gaps ([c6c96fb](https://github.com/saboteur-works/getwrite/commit/c6c96fb62b6b16e3ae94a12aef1b4aaba1e20042))
* **p0:** close canonical-guard and indexer-drain data-safety gaps ([88ff1dd](https://github.com/saboteur-works/getwrite/commit/88ff1ddf46e690244dea59462264f1f25382f408))

## [0.2.21](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.20...getwrite-v0.2.21) (2026-05-14)


### Features

* add rename for resources and folders ([37b48e5](https://github.com/saboteur-works/getwrite/commit/37b48e529ace0cfb38797809539a84e18d2902e2))
* **close-project:** surface sync blockers in close-project confirm dialog ([4802df3](https://github.com/saboteur-works/getwrite/commit/4802df3092b3c1024b00d0900f65b8a0fe2cf322))
* **metadata:** add synopsis field to MetadataSidebar with full persistence ([1be7fde](https://github.com/saboteur-works/getwrite/commit/1be7fdef4177d18e7a8127428ec04501108ebb67))
* **metadata:** collapsible sections in MetadataSidebar ([b5fdb36](https://github.com/saboteur-works/getwrite/commit/b5fdb36c1af5ecc82e226c5f26cd63abb4e618f4))
* **metadata:** flexible duration units and end date/time with user override ([25b9a3b](https://github.com/saboteur-works/getwrite/commit/25b9a3b3c9a12fb0f57d75bd34c673c6272b0036))
* **revisions:** auto-create named canonical revision on text resource creation and add configurable default revision name setting ([93fcab4](https://github.com/saboteur-works/getwrite/commit/93fcab45024c2e5f9dad985edbbd9fbe9fca576c))


### Bug Fixes

* **e2e:** correct two test bugs uncovered by first lint+e2e run ([a1dad8e](https://github.com/saboteur-works/getwrite/commit/a1dad8eff8070a8f5d24f711324bd98a91a84cc9))
* **ordering:** make orderIndex a required invariant and fix the four-bug chain that caused Resource Tree reordering after metadata saves ([1efc897](https://github.com/saboteur-works/getwrite/commit/1efc897f472271857c259920aed99f6019574a81))
* **resource-tree:** tighten indentation, use constant, truncate long names ([acf09c7](https://github.com/saboteur-works/getwrite/commit/acf09c743c4eb2f9995ee7e6acf5fd287b43615e))
* **topbar:** omit project title when no project is loaded ([59d1ac3](https://github.com/saboteur-works/getwrite/commit/59d1ac3c76231c157af5970e7024d1307cce92b8))
* update tests broken by cleanup refactor ([dfa4579](https://github.com/saboteur-works/getwrite/commit/dfa4579a72337f4df6230bda65262642b3d2a109))

## [0.2.20](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.19...getwrite-v0.2.20) (2026-05-10)


### Bug Fixes

* remove deb target from Linux electron build ([57e114d](https://github.com/saboteur-works/getwrite/commit/57e114d171a9fe2bef4813acb9aba2925593d4be))

## [0.2.19](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.18...getwrite-v0.2.19) (2026-05-10)


### Bug Fixes

* trigger electron release build ([18185f9](https://github.com/saboteur-works/getwrite/commit/18185f9a6a07528432003a7a5bb0c89ae6e6424e))

## [0.2.18](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.17...getwrite-v0.2.18) (2026-05-10)


### Bug Fixes

* include Linux builds in releases 2 ([cfb6f5f](https://github.com/saboteur-works/getwrite/commit/cfb6f5f599057e7758ec99dcd12196543821c428))

## [0.2.17](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.16...getwrite-v0.2.17) (2026-05-10)


### Bug Fixes

* include Linux builds in releases ([b1e9e49](https://github.com/saboteur-works/getwrite/commit/b1e9e49761c26a358a5412c3dde9252f4d1ba5df))

## [0.2.16](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.15...getwrite-v0.2.16) (2026-05-10)


### Bug Fixes

* include Linux builds in releases ([c4042c7](https://github.com/saboteur-works/getwrite/commit/c4042c713ace47110271c56075d85bf5b33ad5fe))

## [0.2.15](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.14...getwrite-v0.2.15) (2026-05-10)


### Features

* enhance project type editor with word count goal and status management ([30eb075](https://github.com/saboteur-works/getwrite/commit/30eb075e0db6a81c58bab539d06b797b8dff3fd6))

## [0.2.14](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.13...getwrite-v0.2.14) (2026-04-25)


### Features

* added body and word count goal config ([32bfbdb](https://github.com/saboteur-works/getwrite/commit/32bfbdb080b57d6a9c6cb02683387e42791feaa3))
* added subfolders to templates ([0ab51a5](https://github.com/saboteur-works/getwrite/commit/0ab51a538c1d03f364327af70520d4bd764edc8e))

## [0.2.13](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.12...getwrite-v0.2.13) (2026-04-23)


### Features

* implement electron ([f56778f](https://github.com/saboteur-works/getwrite/commit/f56778f0049f1f78a7ba475f49bac08fb5d321a3))

## [0.2.12](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.11...getwrite-v0.2.12) (2026-04-23)


### Features

* implement new timeline view ([86f9371](https://github.com/saboteur-works/getwrite/commit/86f93713a686a9c802ec8e4c34352e5336952e58))


### Bug Fixes

* fixed error on updating metadata with new resources before reload ([f3df451](https://github.com/saboteur-works/getwrite/commit/f3df451bc2f0cba13a061e1509b386a6628781a1))
* fixed sidebar metadata regression ([156acee](https://github.com/saboteur-works/getwrite/commit/156acee28fdead1f74b40f9ff9cc703b06e9ae05))

## [0.2.11](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.10...getwrite-v0.2.11) (2026-04-16)


### Features

* implemented tag UI and stories; wired tag workflow into sidebar ([47a2a7e](https://github.com/saboteur-works/getwrite/commit/47a2a7e82ed209017c4c30dcbf83fe1e7268bbda))
* implemented tag UI and stories; wired tag workflow into sidebar ([7178be4](https://github.com/saboteur-works/getwrite/commit/7178be4c94ee088a0130c940e2bfe13172c2bb79))

## [0.2.10](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.9...getwrite-v0.2.10) (2026-04-16)


### Features

* implemented full diff view ([e504117](https://github.com/saboteur-works/getwrite/commit/e50411740e550acdb1314ed1bc8d196d717ae01e))

## [0.2.9](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.8...getwrite-v0.2.9) (2026-04-16)


### Features

* rework resource export flow ([e9fb245](https://github.com/saboteur-works/getwrite/commit/e9fb245bf7ce4510a77429978d7d7c8c34f24715))

## [0.2.8](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.7...getwrite-v0.2.8) (2026-04-15)


### Features

* Add basic PDF export with font fallback ([0059ac8](https://github.com/saboteur-works/getwrite/commit/0059ac8823e0c6d99455bfc2cf83521b7d60f69f))
* Add docx support ([57ae423](https://github.com/saboteur-works/getwrite/commit/57ae423e2b9ffadfeaffa68663b131de7b96d635))
* added export functionality with headers ([9737552](https://github.com/saboteur-works/getwrite/commit/9737552111d592a9dec2de70a55d341e7e784031))
* added project settings menu button and compile option ([a608461](https://github.com/saboteur-works/getwrite/commit/a608461e0c3fee967914ab3faaa50a37f58fc3ab))
* added selection, type, and naming controls to compile ([2308e28](https://github.com/saboteur-works/getwrite/commit/2308e281960e6c4f59e71d90170bdcc66cbfc57f))
* implement new compile resource tree and UI ([b12fa5b](https://github.com/saboteur-works/getwrite/commit/b12fa5bf527a6f0601a638cc9b526a064fbf4a71))


### Bug Fixes

* updated resource collection handling to prevent undefined titles or parents ([d6fa486](https://github.com/saboteur-works/getwrite/commit/d6fa486b627c9aa8aab0d4b86d4b67d4bbf1121a))

## [0.2.7](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.6...getwrite-v0.2.7) (2026-04-08)


### Features

* added editorConfigSlice and read store in TipTapEditor for custom heading styles ([19dd60c](https://github.com/saboteur-works/getwrite/commit/19dd60c10d5b67ba499cea0626dae5fe54f399b6))
* added project heading editor menu ([879893b](https://github.com/saboteur-works/getwrite/commit/879893b0a9f4d813768aec551f04d22f44f44754))
* implement CustomHeading extension ([97f7835](https://github.com/saboteur-works/getwrite/commit/97f78353435c65a6106c66aa6ffb7e3e87d00ca5))
* pass template config to created project ([d8967e3](https://github.com/saboteur-works/getwrite/commit/d8967e32c4cb6d218570aa568d12cce0f0cc63c0))
* started heading settings panel ([323cb38](https://github.com/saboteur-works/getwrite/commit/323cb38045e1496152c673f1aa536cd72fe9523e))


### Bug Fixes

* fixed FolderSchema and  ProjectTypeFolderSchema metadataInputType enums ([c8fd265](https://github.com/saboteur-works/getwrite/commit/c8fd265e0bee9fe6b6e908215500996dad8d342c))

## [0.2.6](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.5...getwrite-v0.2.6) (2026-04-06)


### Bug Fixes

* fixed dependencies ([10bab0e](https://github.com/saboteur-works/getwrite/commit/10bab0e745ec1fac74be7fdd61876f060f5a4cfb))
* fixed dependencies ([ccd4029](https://github.com/saboteur-works/getwrite/commit/ccd40293a8c10486b6411a7912cac8aaa897bbb1))

## [0.2.5](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.4...getwrite-v0.2.5) (2026-04-04)


### Features

* implemented dynamic font family loading for the editor ([45e4f2f](https://github.com/saboteur-works/getwrite/commit/45e4f2f7dae70a276ef1687a8ad6ac4018af79be))

## [0.2.4](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.3...getwrite-v0.2.4) (2026-04-03)


### Features

* implement paragraph leading extension ([15de02f](https://github.com/saboteur-works/getwrite/commit/15de02f70916616ceaa2a763492eceb7ed1af647))

## [0.2.3](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.2...getwrite-v0.2.3) (2026-04-03)


### Features

* made resource-related metadata dynamic in sidebar ([cb709fe](https://github.com/saboteur-works/getwrite/commit/cb709fea84486afce33269d401abffbf2830354d))
* made resource-related metadata dynamic in sidebar ([0094c97](https://github.com/saboteur-works/getwrite/commit/0094c971a50434e295bedd37947008c7753d44fe))

## [0.2.2](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.1...getwrite-v0.2.2) (2026-04-02)


### Bug Fixes

* ensure special folders in metadata sidebar render correctly ([9a1aa85](https://github.com/saboteur-works/getwrite/commit/9a1aa85b161ba663befaa453489ae3e1c58749cd))
* split folder and resource dispatches after  project creation ([0a95841](https://github.com/saboteur-works/getwrite/commit/0a958414df9a6490dc45579a7dd95a2875cb8217))

## [0.2.1](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.2.0...getwrite-v0.2.1) (2026-04-02)


### Bug Fixes

* fixed resource tree reordering error when moving items down ([d846ab5](https://github.com/saboteur-works/getwrite/commit/d846ab52da47dacfd9a2217fdbdca44142b9b889))
* fixed resources not rendering on creation from CreateResourceModal ([c7f576d](https://github.com/saboteur-works/getwrite/commit/c7f576d9ba45c1953ab8dbb48ba3c5b58a6e8265))

## [0.2.0](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.1.1...getwrite-v0.2.0) (2026-04-01)


### ⚠ BREAKING CHANGES

* changed resource level `metadata` field to `userMetadata`

### Features

* changed resource level `metadata` field to `userMetadata` ([3a0b169](https://github.com/saboteur-works/getwrite/commit/3a0b169c8b5bd00e011fc1602d41acde623dcaa1))

## [0.1.1](https://github.com/saboteur-works/getwrite/compare/getwrite-v0.1.0...getwrite-v0.1.1) (2026-04-01)


### Features

* **003:** add projectTypes loader, unit tests; fix tasks checklist; mark T006 complete ([2d21a52](https://github.com/saboteur-works/getwrite/commit/2d21a526196796863849e18d72dc0502da37b8d4))
* add blockquote extension ([15c42d3](https://github.com/saboteur-works/getwrite/commit/15c42d389b7249bad8b7c2b8dc5571e417b71d6d))
* add close functionality to ProjectTypesManagerPage for improved navigation ([ea26cd4](https://github.com/saboteur-works/getwrite/commit/ea26cd4ac65df8e6169655f2377f6558af424313))
* add experimental tree data and story ([c099d74](https://github.com/saboteur-works/getwrite/commit/c099d743a5ad78cb5eb7b5dbdd2636f893f66b7c))
* add HelpPage component and integrate help modal in AppShell ([ebf1dbe](https://github.com/saboteur-works/getwrite/commit/ebf1dbed8adafaf2677088964ac1d9605b03874c))
* add MenuBar component for text formatting and block manipulation ([fbce5b4](https://github.com/saboteur-works/getwrite/commit/fbce5b4cb0c9a6120a71772ab1f2f88fc2d1e364))
* add PATCH endpoint to set canonical revision and update Redux logic ([2957be8](https://github.com/saboteur-works/getwrite/commit/2957be80d646db0123e560b5f8bdef66b5851e07))
* add project closing functionality with confirmation dialog and UI updates ([bd50cfc](https://github.com/saboteur-works/getwrite/commit/bd50cfc73d1cf38bc9ddcf0be9cae846a51ba3b4))
* add rename api route ([25b3a72](https://github.com/saboteur-works/getwrite/commit/25b3a72f31459547704c30f3dc423d4113037dba))
* add ResourceCommandPalette component for enhanced resource selection and keyboard navigation ([0059260](https://github.com/saboteur-works/getwrite/commit/0059260b81c341e530ca197f99628a76b311105d))
* add timestamp tracking for project cards with relative display ([b279484](https://github.com/saboteur-works/getwrite/commit/b2794847a6057d0dfa8ca20cb6138058a2b39af2))
* add toast notifications for canonical revision actions and enhance revision name resolution ([b0f8404](https://github.com/saboteur-works/getwrite/commit/b0f8404a10bb8027c553a4edc7eaa955d1a2772d))
* added editor menu and icon components and state manager ([c2a3aab](https://github.com/saboteur-works/getwrite/commit/c2a3aab0a41bdcc6e6a4697f7ba4f04b4f660f99))
* added font size and family support ([4054a89](https://github.com/saboteur-works/getwrite/commit/4054a8954bc29c95b43156a11779656035920515))
* added GET revision ([7e48cec](https://github.com/saboteur-works/getwrite/commit/7e48cec93d9c07cd67c22b3b48238cc54ee7f750))
* added highlighter and codeblock extensions ([3a08dd8](https://github.com/saboteur-works/getwrite/commit/3a08dd898784557ac7ead17060058f9d99a5a44c))
* added list format support ([df77eb2](https://github.com/saboteur-works/getwrite/commit/df77eb234a0616f42d4c7461370a4b58fbb54aa9))
* added mathematics (latex) support ([5178af1](https://github.com/saboteur-works/getwrite/commit/5178af1178e116cb93472880f02eea30f6dc77c1))
* added placeholder and selection support ([72eba14](https://github.com/saboteur-works/getwrite/commit/72eba14eb6da39b807e2808e6b2894ae0d2f2b0e))
* added resources slice ([28e8bad](https://github.com/saboteur-works/getwrite/commit/28e8bad2ab5ecf44ee78b8ecb48b0e6e27c372d3))
* added revision control and routes ([0448132](https://github.com/saboteur-works/getwrite/commit/04481320c8c8929261947a6017933a4ef3785a01))
* added route for updating sidecar data ([ad176b2](https://github.com/saboteur-works/getwrite/commit/ad176b2ad1ae69dd789e851f50bffb63640ea954))
* added text align functionality ([9245f97](https://github.com/saboteur-works/getwrite/commit/9245f97e7669e3202c3a7c19616455625b4ccf87))
* added tooltips to editor menu icons ([5b0d746](https://github.com/saboteur-works/getwrite/commit/5b0d746e5d504b0dc9544cfc1b3ef277353aff5d))
* added UniqueID extension ([d19fae6](https://github.com/saboteur-works/getwrite/commit/d19fae6a0170cfab9e6eaa6a71ebeed5778c3466))
* added updateResource to resourcesSlice ([ca5181e](https://github.com/saboteur-works/getwrite/commit/ca5181e564f7c7ca3cd0b22e34027f457e5d135a))
* **api:** implemented route to get resource content from filesystem ([6003199](https://github.com/saboteur-works/getwrite/commit/6003199131e91c4d68aab70d05f0b9adb3206f5b))
* **cli:** add project create example, add project command and tests ([96fdd22](https://github.com/saboteur-works/getwrite/commit/96fdd2253e5ee240041904411b039ebe2c3ea758))
* **cli:** add prune-revisions wrapper and usage docs ([f747039](https://github.com/saboteur-works/getwrite/commit/f7470395580978f7f17405f430c0f56ec69fadd2))
* **EditView:** Implemented fetching of resource content from FS ([34b0f2b](https://github.com/saboteur-works/getwrite/commit/34b0f2b4177a2af9f8c317b932c1b74a4d730e57))
* enhance AppShell layout and add knowledge tome skill documentation ([ff4a2e9](https://github.com/saboteur-works/getwrite/commit/ff4a2e92dadc4a538f0d9e45eed80c3b4724b604))
* enhance autosave functionality with improved status indicators and retry option ([6191929](https://github.com/saboteur-works/getwrite/commit/6191929ad6534efbae2b849fb37ed434334cc720))
* enhance dark mode support in user preferences and project types UI ([7979e38](https://github.com/saboteur-works/getwrite/commit/7979e3842e1217ed51f3d9c25558a2a09a535cd6))
* enhance EditView with document title and subtitle display, and add corresponding styles ([541b94a](https://github.com/saboteur-works/getwrite/commit/541b94af8ed03150ab707286a6d95168eb65a50b))
* enhance layout and overflow handling in RevisionControl and EditView components ([b6d97e3](https://github.com/saboteur-works/getwrite/commit/b6d97e3a12ea8ed7a3dd3c8b788e78a7b4b3f341))
* **frontend:** expose project-types API and fetch in CreateProjectModal ([12a7441](https://github.com/saboteur-works/getwrite/commit/12a7441dad88ffdf1fe1e3fdd5266dbf8a7b7489))
* implement app-wide appearance preferences management and UI integration ([fbdbc2b](https://github.com/saboteur-works/getwrite/commit/fbdbc2b45576e8fe4887eb50fde045a34ecc3e54))
* implement autosave functionality and revision tracking in EditView ([4db70d1](https://github.com/saboteur-works/getwrite/commit/4db70d15fb31861f22fb40ae52582fe654986230))
* implement project preferences API and integrate user preferences management ([f953d56](https://github.com/saboteur-works/getwrite/commit/f953d5676ed4aa263daabcd9239c41c60cd4b775))
* implement project type management UI and associated types ([7b0d635](https://github.com/saboteur-works/getwrite/commit/7b0d63583be36704935a823316b31b8bc08f7dc6))
* implement revisions management with Redux slice and async actions ([011e05d](https://github.com/saboteur-works/getwrite/commit/011e05d6177c98cfdba6b1587c3a6f26802db35a))
* implement text bg color ([22c6377](https://github.com/saboteur-works/getwrite/commit/22c6377bb011d2911dbd779e96cda7efa4ba8a18))
* implement toast notification system for user feedback across the app ([43037ad](https://github.com/saboteur-works/getwrite/commit/43037add7a60d850d3f8dacb2896d849cff3052e))
* implement user preferences management with color mode settings ([1951aa7](https://github.com/saboteur-works/getwrite/commit/1951aa78e83f6241941d2cbbc3aa325f033a9278))
* implemented text color editing ([fe36e36](https://github.com/saboteur-works/getwrite/commit/fe36e36fa73e5ffc117dfe15c62ee998d154708a))
* implemented ui rollback ([ef31beb](https://github.com/saboteur-works/getwrite/commit/ef31bebd9b414ae8dbc8a8ce652918adc7a8a5c3))
* **indexer:** background queue for indexing; async enqueue on revision create; tests ([f8334e5](https://github.com/saboteur-works/getwrite/commit/f8334e5b95e1d58d1d4cd217d153e1c4643a5a4b))
* **indexer:** export flushIndexer; docs: add indexing feature docs; tests: await flushIndexer in affected tests ([c9255a7](https://github.com/saboteur-works/getwrite/commit/c9255a7559335200f49709b2c439a553908901a2))
* **migration:** migrate CreateProjectModal to canonical Project type ([4d60f0a](https://github.com/saboteur-works/getwrite/commit/4d60f0ae8a47d3c951f76dd91abe2c06d454b313))
* **migration:** scaffold adapter, normalize store, migrate placeholders and StartPage ([04f1ec0](https://github.com/saboteur-works/getwrite/commit/04f1ec065bb5dea96fc588338d8aed8137216ca5))
* **models:** add Project model and tests (T007) ([4bca57e](https://github.com/saboteur-works/getwrite/commit/4bca57ee7785943ec2b9ca65418bbc4b9c96b7fb))
* **models:** add project-config loader and tests (T008) ([c1516d6](https://github.com/saboteur-works/getwrite/commit/c1516d6e908c075823429e5b23278d219ea255c8))
* **models:** add Resource models + unit tests (T011) ([4e3c24c](https://github.com/saboteur-works/getwrite/commit/4e3c24c202e77b0a43411f0eb25d9c2159a579df))
* **models:** add resource templates and duplication (T027) + tests ([cf63e17](https://github.com/saboteur-works/getwrite/commit/cf63e176801b245c2ba2357edbfb69d77f2d4549))
* **models:** add revision prune helper + tests (T006) ([4ab0204](https://github.com/saboteur-works/getwrite/commit/4ab02048be7b03deb88874abbdcf3874b7d351f7))
* **models:** add sidecar read/write helpers + tests (T005) ([8d27eec](https://github.com/saboteur-works/getwrite/commit/8d27eecbc2efbf07edcbfb1a52e939973ebe041f))
* **models:** add soft-delete/restore/purge (T026) + tests ([308f437](https://github.com/saboteur-works/getwrite/commit/308f4377212d5c8e303e59e2bdc03c33b48b8782))
* **models:** add UUID util (generate + validate) (T004) ([ab8d466](https://github.com/saboteur-works/getwrite/commit/ab8d4662bc89bbb8f7685472f3181300b04c9613))
* **models:** add zod runtime schemas for data models (T002) ([bb36b7b](https://github.com/saboteur-works/getwrite/commit/bb36b7b8b0e026afc910da76f20f4e5690c4c96b))
* **models:** per-resource async mutex to prevent concurrent revision ops ([b8d424b](https://github.com/saboteur-works/getwrite/commit/b8d424b38a4b4d38292546edb203967c38e09eea))
* **models:** pluggable IO adapter (default fs) and refactor revision to use adapter ([3e497fe](https://github.com/saboteur-works/getwrite/commit/3e497fe0e284bfb90abc1151de21eda044c8626f))
* **models:** project-creator + tests (T009) ([3c96ad4](https://github.com/saboteur-works/getwrite/commit/3c96ad4d280096f0e5489d6ae059363581eee04c))
* **previews:** add preview generation and persistence (T028); tests and docs ([044f0c4](https://github.com/saboteur-works/getwrite/commit/044f0c4e1603f5201f1314efa2194dd8ecc4b933))
* **project-creator:** set folder.orderIndex from spec order (T013) ([7a797bb](https://github.com/saboteur-works/getwrite/commit/7a797bbf9d58cab78fa16a05564ed0d4781f33df))
* **project-manager:** Started project manager module ([4268a59](https://github.com/saboteur-works/getwrite/commit/4268a59cff8973767b0dff9318cb34877f3bf8b1))
* **project-resources:** Created skeleton route to fetch project resources ([92dfb16](https://github.com/saboteur-works/getwrite/commit/92dfb161a9a2aab71115cc98f055e4ed8b43a893))
* **project-types:** migrate UI to canonical project view + adapter; update DataView, TimelineView, StartPage ([3a9c937](https://github.com/saboteur-works/getwrite/commit/3a9c9371b28cf3acb978983ac672aae0dd0cab66))
* **project-types:** wire Create modal to scaffolder and prevent double-submits (T008, T009) ([803852e](https://github.com/saboteur-works/getwrite/commit/803852e364356d368c175d62a669ef5f998c2fbb))
* **spec-005:** complete phase 1 setup scaffolding ([4593ce9](https://github.com/saboteur-works/getwrite/commit/4593ce9b858f0dcfc2872d32f72ae6d6fb04f8a9))
* **spec-005:** complete phase 2 foundational baselines ([b6a2795](https://github.com/saboteur-works/getwrite/commit/b6a2795c7d598649c6558053addded03f0dd0f82))
* **spec-005:** complete phase 4 seam extraction and warning cleanup ([db790a8](https://github.com/saboteur-works/getwrite/commit/db790a8635a29aa1e17103fbd0b118e09d5fd1c0))
* **spec-005:** complete phase 5 shell seams ([4a2b0ae](https://github.com/saboteur-works/getwrite/commit/4a2b0aee11c16eb4ec4eaf0891ce0009c45498a3))
* **spec-005:** complete phase 6 invariant validation ([96bca83](https://github.com/saboteur-works/getwrite/commit/96bca839a4e9b12a8222d3d78e487ce1c1230ae4))
* **spec-005:** complete phase 7 menu and help seams ([0964aed](https://github.com/saboteur-works/getwrite/commit/0964aedbd6d604be8a6bfcb62744d5f015c57650))
* **spec-005:** complete phase 8 polish and validation ([988b718](https://github.com/saboteur-works/getwrite/commit/988b7185c22b4b63d3a3ea93da1c540a5e2490f3))
* **spec-005:** complete T007-T009 guardrails and factory extraction ([c014ed9](https://github.com/saboteur-works/getwrite/commit/c014ed9a29873531e625effd1f63e7a14e91d5d0))
* **spec-005:** complete T010 and T011 model seams ([39db1bd](https://github.com/saboteur-works/getwrite/commit/39db1bdd050f6a52aa7109e9a97ab5253abada39))
* **spec-005:** complete T012 template service extraction ([33ad93a](https://github.com/saboteur-works/getwrite/commit/33ad93a5cf0d117b06f77fd106560fd5f9260dd2))
* **spec-005:** complete T013 template delegation trim ([28a1ed6](https://github.com/saboteur-works/getwrite/commit/28a1ed6f7915fa7388d1542328468af2d6f85524))
* **spec-005:** complete T014 revision transport and normalization extraction ([81b0c8c](https://github.com/saboteur-works/getwrite/commit/81b0c8c34ca78aad713ac0977581a0a7a5da7fdb))
* **spec-005:** complete T015-T018 redux seam extraction ([c43ed90](https://github.com/saboteur-works/getwrite/commit/c43ed90e6dfbdab4c79b5485009bea7fe14dcddf))
* **spec-005:** start refactor app trouble spots execution ([266c9cf](https://github.com/saboteur-works/getwrite/commit/266c9cf72349e5b97d4b1904d32b86cb82a357f7))
* **store:** persist reorder via Redux thunk; AppShell dispatches persistReorder ([ffa7140](https://github.com/saboteur-works/getwrite/commit/ffa714094abd44fde8ba281284a527bf7860118e))
* **tree:** accept Project prop and render persisted resources (T011) ([e0ada2d](https://github.com/saboteur-works/getwrite/commit/e0ada2d39860eed2f90856be8c9eb84b7d0e75e7))
* **tree:** drive ResourceTree from Redux (projectId) and wire page create/delete to store; pass projectId from AppShell ([f6278f8](https://github.com/saboteur-works/getwrite/commit/f6278f849e1c77c227e510228055e8ea3e460da5))
* **ui:** persist created/opened project to Redux (setProject + setSelectedProjectId) ([2427ce4](https://github.com/saboteur-works/getwrite/commit/2427ce4f611930c00971a31b8dbaaa5b5242e16a))
* update AppShell topbar layout with improved separator styles and help button repositioning ([41fafa9](https://github.com/saboteur-works/getwrite/commit/41fafa956b769dfe3fc2f2bc6f932b6858353467))
* update ResourceTree to support multiple resource types with corresponding icons ([483f61e](https://github.com/saboteur-works/getwrite/commit/483f61e96314ff253c99a57395901c8866d5d6a6))


### Bug Fixes

* **cli:** pass name string to Command constructor ([0284956](https://github.com/saboteur-works/getwrite/commit/0284956155734edebb18ffa4642243ef1dc231f4))
* **CompilePreviewModal:** detect folder-like resources by parent relationships and use title/name fallbacks ([aa70829](https://github.com/saboteur-works/getwrite/commit/aa7082954ba362189c38b8ee6e834067bd30fb2c))
* correct import statement and ensure resources are included in Default story ([6c4fba8](https://github.com/saboteur-works/getwrite/commit/6c4fba8dd3b5be65ba6916ed7f3a81fc05f6603a))
* enhance accessibility and improve tests for ResourceTree and reorder persistence ([7cca2e4](https://github.com/saboteur-works/getwrite/commit/7cca2e450d97ba148b6ab4b7c0840e40a7256027))
* **frontend:** add project-types load error UI + retry to CreateProjectModal ([9306268](https://github.com/saboteur-works/getwrite/commit/9306268178c6cb40ba43d12b96a0e608bcc48493))
* **frontend:** normalize legacy/canonical resource fields in ResourceTree and TimelineView; update tests ([b919c2b](https://github.com/saboteur-works/getwrite/commit/b919c2b0d9b5278af39e34f0cb1718ccd1c4b172))
* **frontend:** resolve remaining typecheck guardrail errors ([123780c](https://github.com/saboteur-works/getwrite/commit/123780ca9796b8e21eaaf9fe6c599bf28abf4848))
* guard ResourceTree localOrder effect to avoid render loop; add Storybook fetch mock for CreateProjectModal ([bac550a](https://github.com/saboteur-works/getwrite/commit/bac550a5a067804ee1cf4aa0023704a8420727ee))
* include rootPath in setProject dispatch for ResourceTree test ([02c5581](https://github.com/saboteur-works/getwrite/commit/02c5581004665490aa3d7832d970581fbf98b3b9))
* include rootPath in setProject dispatch for ResourceTree test ([84f4c92](https://github.com/saboteur-works/getwrite/commit/84f4c92ca3b21952caa67acce56ba963e5460af2))
* make ViewSwitcher work with folders ([756b3f1](https://github.com/saboteur-works/getwrite/commit/756b3f136a4240e41bd217b7ee9a80a701943a4f))
* **models:** remove markdown fences and unsafe comment sequences in revisionStorage; narrow error typing ([1ea165d](https://github.com/saboteur-works/getwrite/commit/1ea165d3932b5d6b9445faa50ea1f8a0a721b47a))
* **models:** safe JSDoc and return shape in pruneExecutor; update test to match writeRevision ([05dd8dc](https://github.com/saboteur-works/getwrite/commit/05dd8dcd6a711aa46a9cd12bbcd295b2e9334a8c))
* **models:** zod schema typing fixes ([f55f197](https://github.com/saboteur-works/getwrite/commit/f55f197445e5da73e1d3942c1ece7464d1ac73de))
* **OrganizerCard:** cast legacy fields/metadata to avoid union type errors ([f8f2b8c](https://github.com/saboteur-works/getwrite/commit/f8f2b8c9a4ca3e275cfb230dd1af16db3b133088))
* **project-types:** remove $schema field ([721ba54](https://github.com/saboteur-works/getwrite/commit/721ba5462b081e724f37c7a1d852d1592581a2f2))
* **project-types:** set correct template directory ([85ec908](https://github.com/saboteur-works/getwrite/commit/85ec9081ce4961aa68bdab9cb5b8a46ef40ad904))
* **projectTypes:** resolve templates dir at runtime to support tests and app ([12255e7](https://github.com/saboteur-works/getwrite/commit/12255e779f4d9aa472ace5f5d6cfd9a23aac0d71))
* remove max-width from canonical revision article styling ([f4c9f94](https://github.com/saboteur-works/getwrite/commit/f4c9f9428c84448193088875f4cb31f0a45a8724))
* **resource-selection:** fixed resouce/folder selection ([8b7a50e](https://github.com/saboteur-works/getwrite/commit/8b7a50e7dc15db99667e79069c8e3114b3bb0b59))
* **resource-templates:** handle directory-based resources when duplicating (recursive copy) ([ef6f93d](https://github.com/saboteur-works/getwrite/commit/ef6f93dd7a3e3f13fd35849b198ff3ea61ce70c4))
* **resource-templates:** remove extra export ([dad6c24](https://github.com/saboteur-works/getwrite/commit/dad6c24672887aad29bc1de1ffd48fe6e176e3cf))
* **resource:** await writeSidecar in writeResourceToFile to ensure sidecars are written before returning ([7f30721](https://github.com/saboteur-works/getwrite/commit/7f307218e6dcf1c76cdd9416c7118ae7ebf1f0c5))
* **resources:** fix resource create ([d4f727f](https://github.com/saboteur-works/getwrite/commit/d4f727f1bf389a6a937518dddee4d9cd9e7c8300))
* **resources:** Fixed updateResource var refs ([193a307](https://github.com/saboteur-works/getwrite/commit/193a3079bdc452740d94757272659fc9d18fbe4e))
* **schemas:** move node:fs import to dynamic import inside server-only function ([c69cd4c](https://github.com/saboteur-works/getwrite/commit/c69cd4c527eeaf4650e29ccba32a47a958cf1600))
* **stories:** correct JSX syntax and expose simulateReorder properly ([87c091c](https://github.com/saboteur-works/getwrite/commit/87c091c4ca9a20d5ae7841cf70e1d3991b322dc0))
* **styles:** quality fixes from Task 6 review — palette transition, icon sizes, overflow ([e589d15](https://github.com/saboteur-works/getwrite/commit/e589d15de1b44cce3a996ae25935622ade324007))
* **styles:** remove duplicate saboteur-base.css import from getwrite-theme.css ([f63eb89](https://github.com/saboteur-works/getwrite/commit/f63eb89400277ce4f7a463e3d51c165c5082f111))
* **styles:** remove unused React import from StartPage ([c0613fa](https://github.com/saboteur-works/getwrite/commit/c0613fa78f8c59b868a4f1ca306737a245907080))
* **styles:** resolve post-migration regressions — editor text, resource tree, toolbar, modals ([66a1a90](https://github.com/saboteur-works/getwrite/commit/66a1a90544e11ae508c0733ad3dca4032efb3fc3))
* **styles:** use named tracking tokens and clean conflicting button utilities in StartPage ([24fa4dc](https://github.com/saboteur-works/getwrite/commit/24fa4dc709752457a2cfb8b215fee4616d098610))
* **styles:** use text-gw-secondary className on View icon in RevisionControl action buttons ([232b667](https://github.com/saboteur-works/getwrite/commit/232b66714dc07a9de06130a4896f094db0dfb2ee))
* **tests:** adjust flows and resourceTree tests to wrapper/ui shapes; fix TimelineView variable ([053422e](https://github.com/saboteur-works/getwrite/commit/053422e93083d514d3dba3d73ba25cbda15ffc20))
* **tiptap-utils:** include text nodes when extracting plain text for backlinks ([3caab96](https://github.com/saboteur-works/getwrite/commit/3caab9663975ce2ac640fdbd309872af4376492c))
* update fetch mock implementation to handle URL and Request types correctly ([dea55b9](https://github.com/saboteur-works/getwrite/commit/dea55b98def6b2d17d89badf52aee66d6c0d8daa))
* update MetadataSidebar test to include resource dispatches ([7637814](https://github.com/saboteur-works/getwrite/commit/7637814393105081547e9a07ca2267ef2985abb1))
* update resource structure and type definitions in flow tests ([8a8deea](https://github.com/saboteur-works/getwrite/commit/8a8deea13290e945c55c04c833ae5d037854014f))
* update StartPage test to correct rootPath values and import test from vitest ([f1935ba](https://github.com/saboteur-works/getwrite/commit/f1935baba2d7da7a2227222cc960eebdde69e14c))
* updated parent-child resource creation logic ([48cd7c7](https://github.com/saboteur-works/getwrite/commit/48cd7c71ee9174d3f380a5959c680acecca6f194))
* updated tree item styling so items dropped into folders have the same indentation ([f321a63](https://github.com/saboteur-works/getwrite/commit/f321a63b7c6bd3b3058f728617f593d7020dee69))
