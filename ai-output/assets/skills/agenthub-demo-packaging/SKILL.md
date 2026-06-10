---
name: agenthub-demo-packaging
description: >
  Use when creating or updating seedcmp AgentHub / IM / Clowder demo scripts, PRD,
  technical docs, README sections, roadmap assets, PDF exports, or acceptance narratives.
  Trigger for demo packaging, delivery docs, artifact previews, multi-agent project group
  walkthroughs, deployment/preview stories, or cross-device evidence. Not for code
  implementation, bug fixing, unsourced marketing copy, or slides unless the user asks for
  actual slide production. Output: sourced demo package with claim map, scenario script,
  artifact matrix, state coverage, browser evidence checklist, and doc/PDF export checklist.
---

# AgentHub Demo Packaging

## Why This Is A Skill

Recent work repeatedly turned AgentHub implementation details into demo materials: PRD, technical docs, README, PDF exports, and `演示内容.md`. The failure mode is easy: writing a smooth story that does not prove real UI capability. This skill forces a source map and artifact matrix before polishing the narrative.

## Inputs

Prefer these sources in order:

- `演示内容.md`
- `assets/roadmap/*.md`
- `README.md`
- `sections/ui/.ai/issues/*.md`
- `sections/ui/.ai/plans/*.md`
- `sections/ui/assets/*`
- `sections/ui/specs/001-im-web-ui-optimization/**`
- `sections/im_web/.ai/V3.0/**` when the demo touches legacy IM Web or Clowder connector behavior

Use live or recorded browser evidence when claims involve working UI. Good evidence paths include `sections/ui/.ai/tests-e2e/`, `sections/im_web/.ai/V3.0/tests-e2e/`, and issue-linked screenshots or JSON summaries.

## Workflow

1. Build the source map.
   - List which document or issue proves each demo claim.
   - Mark unverified claims as `needs source`.
   - Separate `implemented`, `mocked`, `planned`, and `blocked by environment`.

2. Define the demo spine.
   - Login/register
   - Agent directory or role template selection from Clowder-backed data
   - Create or select coordinator/PM agent
   - Single direct chat verification
   - Coordinator suggests missing roles or project group
   - Project group creation/reuse and member sync
   - Multi-agent group collaboration with sender identity
   - Generated artifacts preview with real paths
   - Context pin or quote-based revision
   - Deployment card, target environment, preview URL, and source download
   - Mobile or cross-device check

3. Build an artifact matrix.
   - Include at least three meaningful formats when the story is about delivery: `pptx`, `docx`, `xlsx`, `md`, `html`, `pdf`, image, code.
   - Each artifact needs business purpose, preview path, and expected user action.
   - For generated app/code artifacts, include preview URL, source path/download, and deployment status.

4. Include state machines, not only happy path.
   - Project group card: pending, creating, created/reused, failed/retry, cancelled.
   - Deployment card: pending, submitting, queued/running, succeeded, failed/retry, cancelled.
   - Agent reply: pending feedback, streaming, final, file card.
   - Artifact preview: available, loading, unsupported, path missing, retry.
   - Clowder connection: ready, unavailable, permission denied, queue full, degraded.

5. Add cross-device proof.
   - Desktop wide view.
   - Mobile narrow view.
   - State what should remain visible within 5 seconds: active module, active conversation, next action, message input.
   - For chat flows, prove refresh keeps message/order/unread state rather than relying on the initial view only.

6. Package docs.
   - Update the Markdown source first.
   - Export PDF only after source docs are stable.
   - Keep generated PDFs under `assets/roadmap/` or another explicit artifact directory, not repo root.
   - If a PDF is stale or unverified, label it as such instead of presenting it as final.

7. Add acceptance evidence.
   - Include exact commands or scripts used for build/smoke when available.
   - For V3 examples, cite `cd sections/im_web && pnpm type-check`, `pnpm build`, targeted Vitest, TangSeng Go tests, Clowder connector tests, or Playwright smoke only if actually run.
   - For AgentHub H5 examples, cite `cd sections/ui && npm run test:native-im`, browser screenshots, and the issue evidence path.

## Output Template

```markdown
## Demo Package

Scenario:
- ...

Source map:
| Claim | Source | Status | Confidence |
|---|---|---|---|

Artifact matrix:
| Artifact | Format | Purpose | Preview path/action | Evidence |
|---|---|---|---|---|

Demo script:
1. ...

State coverage:
- ...

Cross-device proof:
- Desktop:
- Mobile:

Acceptance evidence:
- ...

Open gaps:
- ...
```

## Common Mistakes

| Mistake | Consequence | Fix |
|---|---|---|
| Starting from a pretty story | Demo claims drift from implementation | Build source map first |
| Showing only chat text | AgentHub looks like a chatbot, not a workbench | Include project group, artifacts, preview, and deployment |
| Saying "files are generated" without format purpose | Artifact preview looks fake | Give each file a business role |
| Ignoring failure/retry states | Product feels brittle | Include card state machines |
| Forgetting mobile | Cross-platform claim is unproven | Add 375px or mobile route check |
| Exporting PDF too early | Source and PDF diverge | Freeze Markdown before PDF export |
| Mixing planned work into implemented demo | Stakeholders cannot trust the package | Mark planned/blocked separately in the source map |
| Using screenshots with no path or timestamp | Evidence cannot be audited | Link the evidence directory and capture command |
| Hiding Clowder unavailable states | Demo fails the moment services are down | Include degraded/permission/queue-full states |

## Related Skills

- Use `console-dev` if new demo UI states must be implemented.
- Use `quality-gate` if the demo package claims a feature is complete.
- Use `paper-slides` or `ppt-master` only when the user asks for actual slides, not merely a demo script.
