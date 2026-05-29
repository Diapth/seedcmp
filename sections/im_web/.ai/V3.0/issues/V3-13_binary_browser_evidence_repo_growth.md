# V3-13: Browser Evidence Binaries Can Grow The Repository Quickly

## Status

Partially resolved on 2026-05-29

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
