# V3-13: Browser Evidence Binaries Can Grow The Repository Quickly

## Status

Mitigated on 2026-06-01; historical artifact migration deferred

## Severity

Low

## Finding

V3 browser verification has checked in many screenshot binaries under `.ai/V3.0/tests-e2e` and `.ai/V3.0/issues/imgs`. Text summaries are useful for review, but long-running browser smoke work can keep adding PNG/JPG/WebM/trace artifacts and make the git repository heavier over time.

## Evidence

`git ls-files 'sections/im_web/.ai/V3.0/**/*.png' 'sections/im_web/.ai/V3.0/**/*.jpg' 'sections/im_web/.ai/V3.0/**/*.jpeg' 'sections/im_web/.ai/V3.0/**/*.webm' 'sections/im_web/.ai/V3.0/**/*.zip' | wc -l` currently reports 175 tracked binary evidence files.

## Resolution

- Added ignore rules so future V3 evidence runs keep binary artifacts out of normal git status.
- Keep `summary.md`, `summary.json`, and `result.json` as the default checked-in evidence format.

## Remaining Work

Historical screenshots are still tracked in the repository history. Migrating them to Git LFS, object storage, or CI artifacts should be handled as a separate repository-maintenance task because it may rewrite history or remove existing review evidence from HEAD.

## 2026-06-01 Reverification

Current tracked binary evidence count:

```bash
git ls-files 'sections/im_web/.ai/V3.0/**/*.png' 'sections/im_web/.ai/V3.0/**/*.jpg' 'sections/im_web/.ai/V3.0/**/*.jpeg' 'sections/im_web/.ai/V3.0/**/*.webm' 'sections/im_web/.ai/V3.0/**/*.zip' | wc -l
```

Result: `281` tracked historical binary evidence files.

Current ignore behavior:

```bash
git check-ignore -v sections/im_web/.ai/V3.0/tests-e2e/tmp-run/example.png
git check-ignore -v sections/im_web/.ai/V3.0/tests-e2e/tmp-run/summary.md
git check-ignore -v sections/im_web/apps/chat/test-results/example/error-context.md
git check-ignore -v sections/im_web/apps/chat/test-results/example/screenshot.png
```

Result:

- Future V3 screenshot binaries under `.ai/V3.0/tests-e2e` are ignored by the repository root `.gitignore`.
- Text summaries under `.ai/V3.0/tests-e2e` are not ignored and can still be checked in.
- Playwright `test-results/` outputs are ignored.

Close/deferral note:

- The forward-growth risk is mitigated.
- Removing or migrating the 281 already tracked evidence binaries should be a deliberate repository-maintenance task, not part of a feature regression fix, because it may remove existing review evidence from HEAD or require history/LFS migration.
