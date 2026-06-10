---
name: agenthub-issue-triage
description: >
  Use when investigating or fixing seedcmp AgentHub, IM Web, TangSeng bridge, or Clowder
  connector issues, especially `sections/ui/.ai/issues/ISSUE-*` and
  `sections/im_web/.ai/V3.0/issues/V3-*`. Trigger for bugs involving native IM,
  agent/project groups, proposal/deployment/artifact cards, direct/group chat,
  Clowder routing, streaming, OAuth, cat templates, or live smoke failures. Not for
  generic frontend work, one-off styling, product docs, or new features with no issue
  record. Output: issue evidence packet with classification, root cause, boundary map,
  touched files, verification commands/results, smoke evidence, and follow-up decision.
---

# AgentHub Issue Triage

## Why This Is A Skill

Recent seedcmp work repeatedly followed the same loop: read an issue, avoid dirty files from other sessions, locate IM/Clowder boundaries, add a red test, fix, and report verification. Generic `debugging`, `tdd`, and `console-dev` still apply, but they do not carry the seedcmp-specific issue locations, test commands, and IM/Clowder boundary map.

## Scope

Use this for:

- `sections/ui/.ai/issues/ISSUE-*.md`
- `sections/im_web/.ai/V3.0/issues/V3-*.md`
- AgentHub UI bugs involving agents, project groups, proposal cards, artifact preview, deployment cards, direct/group chat, Clowder stream replies, OAuth, or role templates
- Live smoke failures with evidence under `sections/ui/.ai/tests-e2e/` or `sections/im_web/.ai/V3.0/tests-e2e/`

Do not use this for:

- Pure copywriting or roadmap docs
- Pure visual polish with no issue record
- Broad architecture planning before an issue exists
- Non-seedcmp projects

Grey case:

- If a user reports a bug verbally but no issue exists, create or update the nearest issue record first unless the fix is an emergency one-line Direct Fix.

## Workflow

1. Load the issue and nearest plan.
   - For `sections/ui`: read `sections/ui/.ai/issues/ISSUE-*.md` and matching `sections/ui/.ai/plans/ISSUE-*.md` if present.
   - For V3: read `sections/im_web/.ai/V3.0/issues/V3-*.md` and matching `sections/im_web/.ai/V3.0/plan/V3-*`.
   - If the issue body says `AI修复模式：Plan First`, use `writing-plans` before code edits; if it says `Direct Fix`, keep the fix narrow but still use a red/targeted regression check.

2. Guard the worktree.
   - Run `git status --short`.
   - Identify dirty files owned by other sessions.
   - If the target files are dirty, read them carefully and work with the current state. Do not revert.

3. Classify the issue.
   - `Direct Fix`: clear root and narrow file set.
   - `Plan First`: multiple boundaries or missing contract.
   - `Investigation`: root unknown, must produce only evidence first.
   - Preserve the classification in the issue or evidence packet; do not silently switch modes.

4. Map the boundary.
   - UI pages: `sections/ui/pages/**`
   - UI components: `sections/ui/components/**`
   - Native service/state: `sections/ui/services/native-im/**`, `sections/ui/stores/**`
   - Tests: `sections/ui/tests/native-im.test.mjs`
   - TangSeng bridge: `sections/im/TangSengDaoDaoServer/modules/clowder/**`, `modules/common/**`, `modules/robot/**`, `modules/message/**`
   - Clowder API: `sections/clowder-ai/packages/api/src/**`
   - IM Web V3: `sections/im_web/apps/chat/**`, `sections/im_web/packages/**`
   - External Clowder workspace if used by V3 plans: `/media/leng/DiskB1/exp/clowder-ai/packages/api/**`

5. Add or identify the red test before implementation.
   - Preferred UI command: `cd sections/ui && npm run test:native-im`
   - Targeted UI command: `cd sections/ui && npm run test:native-im -- --test-name-pattern='<case>'`
   - V3 IM Web targeted command: `cd sections/im_web/apps/chat && pnpm exec vitest run <tests> --pool=threads --poolOptions.threads.singleThread=true`
   - V3 IM Web gates: `cd sections/im_web && pnpm type-check`, `cd sections/im_web && pnpm build`, `cd sections/im_web && pnpm test:unit`
   - TangSeng bridge gate: `cd sections/im/TangSengDaoDaoServer && go test ./modules/clowder ./modules/common ./modules/robot -run '<case>' -count=1`
   - Clowder connector gate: `cd sections/clowder-ai && pnpm build` or the package-specific `node --test test/im-web-*.test.js` command used by the issue.

6. Fix at the source boundary.
   - Normalize IDs once, not in every component.
   - Keep direct cat/thread IDs explicit.
   - Keep Clowder stream chunks mergeable into one durable message.
   - Keep project group/proposal/deployment cards idempotent.
   - Keep browser code away from Clowder secrets; signed server-to-server calls belong in TangSeng or Clowder.
   - Do not copy Clowder connector internals into IM Web; integrate through bridge contracts and routes.

7. Capture browser evidence when the issue touches interaction or rendering.
   - For `sections/ui` issues, save screenshots or JSON under `sections/ui/.ai/tests-e2e/` with the issue number in the path.
   - For V3 issues, save evidence under `sections/im_web/.ai/V3.0/tests-e2e/`.
   - Useful local endpoints: AgentHub UI `http://localhost:5173`, IM Web `http://localhost:3000`, TangSeng API `http://100.79.157.76:8090/v1`, Clowder API `http://127.0.0.1:3004`, preview gateway `http://127.0.0.1:4100`.
   - For live V3 smoke, record `RUN_V3_CLOWDER_SMOKE`, `TARGET_URL`, `CLOWDER_URL`, test accounts, agents, and group name.

8. Verify and write the packet.
   - Include issue path, classification, root cause, boundary, files touched, tests run, output summary, browser evidence path, residual risk, and whether follow-up is required.
   - If a required live environment is unavailable, state the exact blocked smoke and the substitute evidence used.
   - If the issue template requires phase commits, commit only the completed, verified phase and mention the commit hash in the issue; do not stage unrelated dirty files.

## Output Template

```markdown
## Issue Evidence Packet

Issue: `sections/ui/.ai/issues/ISSUE-XXX_*.md`
Classification: Direct Fix / Plan First / Investigation

Root cause:
- ...

Boundary:
- UI / native service / TangSeng bridge / Clowder API / IM Web V3:

Touched files:
- ...

Verification:
- Command: `...`
- Result: pass/fail summary

Browser evidence:
- Path: `...`
- Scope: mock / native service / live TangSeng / live Clowder

Residual risk:
- ...

Follow-up:
- None / immediate / needs owner decision
```

## Common Mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| Treating the issue title as the whole spec | Wrong fix or partial fix | Read issue body, plan, and current tests |
| Editing dirty files blindly | Clobbers another session | Start with `git status --short` and read dirty files |
| Fixing UI only | Native store/test still broken | Add `native-im.test.mjs` coverage when IM state changes |
| Declaring fixed from H5 mock only | Real Clowder/TangSeng path can still fail | State whether evidence is mock, native service, or live smoke |
| Adding fallback layers for every data shape | Duplicates and stale state | Normalize at boundary and keep one canonical shape |
| Losing target message IDs in stream replies | Duplicate assistant bubbles | Preserve prompt target and merge chunk/final events |
| Calling Clowder directly from browser for convenience | Leaks secrets and bypasses TangSeng ownership | Use TangSeng bridge endpoints for browser-facing calls |
| Treating skipped live smoke as pass | False confidence in multi-service flows | Mark it blocked/skipped and cite targeted substitutes |
| Saving browser evidence outside `.ai/tests-e2e` | Evidence disappears from the issue trail | Use the issue-numbered evidence directory |

## Related Skills

- Use `debugging` first when root cause is unknown.
- Use `tdd` when writing the red test and implementation.
- Use `console-dev` for new UI states or layout changes.
- Use `quality-gate` before claiming the issue is complete.
- Use `cross-thread-sync` if another active session owns overlapping files.
