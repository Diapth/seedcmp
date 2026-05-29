# V3-11: Tracked Vue Sidecar Build Artifacts Can Shadow Source Components

## Status

Resolved on 2026-05-29

## Severity

Medium

## Finding

`sections/im_web/apps/chat/src` still contains tracked Vue-generated sidecar files such as `ChatView.vue.js`, `App.vue.js`, and other `*.vue.js` artifacts next to their source `.vue` files.

## Impact

- Source and generated output can drift after edits, making reviews misleading.
- Vite, TypeScript, or tests can accidentally resolve a stale JavaScript artifact when a future import omits the `.vue` extension.
- Generated files add noise to diffs and make it harder to see the actual UI source of truth.

## Expected

- Vue single-file components should be represented by `.vue` source files only.
- Generated `*.vue.js` and `*.vue__VLS_*.vue.js` files should not be tracked in git.
- The ignore rules should prevent new local sidecar artifacts from appearing as untracked changes.

## Acceptance

- A source hygiene test fails while tracked Vue sidecar artifacts exist.
- All tracked `sections/im_web/**/*.vue.js` sidecar files are removed.
- `.gitignore` ignores future Vue sidecar artifacts.
- Chat unit tests and production build still pass.

## Resolution

- Added `apps/chat/tests/sourceTreeHygiene.test.ts` to assert that Vue sidecar artifacts are not tracked.
- Removed the 9 tracked sidecar artifacts under `sections/im_web/apps/chat/src`.
- Added repository ignore rules for future `sections/im_web/**/*.vue.js` and `sections/im_web/**/*.vue__VLS_*.vue.js` artifacts.

## Verification

- `git ls-files 'sections/im_web/**/*.vue.js' 'sections/im_web/**/*.vue__VLS_*.vue.js'` returns no tracked sidecar artifacts.
- `pnpm --filter chat test:unit -- sourceTreeHygiene.test.ts` passes: 49 files, 139 tests.
- `pnpm --filter chat build` passes: `vue-tsc && vite build` completes successfully.
